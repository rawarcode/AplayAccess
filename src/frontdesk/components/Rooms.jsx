import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Layout/Sidebar';
import Modal from '../../components/modals/Modal';
import { getFdBookings, getFdRooms } from '../../lib/frontdeskApi';
import Toast, { useToast } from '../../components/ui/Toast';
import BookingDetailModal from './BookingDetailModal';
import { fmtTime, fmtMoney, localDateStr } from '../../lib/format';

// ─── helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => localDateStr();

function getCat(room) {
  if (room.category) return room.category;
  const n = (room.name || '').toLowerCase();
  if (n.includes('cottage'))  return 'cottage';
  if (n.includes('pavilion')) return 'pavilion';
  // Name-fallback for tents — same pattern as the cottage/pavilion
  // heuristics above. Without this, a tent row whose DB `category`
  // column is unset gets classified as 'room', which made the
  // existing tent-only-render-when-active filter (and the summary
  // tent-exclusion in `counts`) silently miss it. Matches "tent",
  // "camping", and "campsite" name variants.
  if (n.includes('tent') || n.includes('camp')) return 'tent';
  return 'room';
}

const CATEGORY_GROUPS = [
  { key: 'room',     label: 'Rooms',     icon: 'fa-bed'            },
  { key: 'cottage',  label: 'Cottages',  icon: 'fa-umbrella-beach' },
  { key: 'pavilion', label: 'Pavilions', icon: 'fa-archway'        },
  // Tents only render when there's active / upcoming activity —
  // handled by the renderer filter below (grp.key === 'tent').
  { key: 'tent',     label: 'Tents',     icon: 'fa-campground'     },
];

function countdown(ms) {
  if (ms <= 0) return null;
  const totalMins = Math.floor(ms / 60000);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0)              return `${hrs}h`;
  return `${mins}m`;
}

// ─── Slot windows ─────────────────────────────────────────────────────────────
// Day Visit   = today 06:00 – today 18:00
// Overnight   = today 18:00 – tomorrow 07:00 (or yesterday 18:00 – today 07:00
//               if the viewer is currently in the small-hours window)
// A booking "occupies" a slot iff its [checkIn, checkOut) range overlaps the
// slot window. This correctly handles 24hr bookings that straddle both slots.
function dayWindow(now) {
  const d = now;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6,  0, 0, 0);
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0, 0, 0);
  return [start, end];
}

function overnightWindow(now) {
  const d = now;
  // Before 7 AM the "current overnight" is last night, not tonight.
  if (d.getHours() < 7) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 18, 0, 0, 0);
    const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(),      7, 0, 0, 0);
    return [start, end];
  }
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(),     18, 0, 0, 0);
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1,  7, 0, 0, 0);
  return [start, end];
}

function bookingRange(b) {
  if (!b?.checkIn || !b?.checkOut) return null;
  const ci = new Date(b.checkIn.replace(' ', 'T'));
  const co = new Date(b.checkOut.replace(' ', 'T'));
  if (isNaN(ci.getTime()) || isNaN(co.getTime())) return null;
  return { ci, co };
}

function overlapsWindow(b, ws, we) {
  const r = bookingRange(b);
  return !!r && r.ci < we && r.co > ws;
}

// Label classifier for the upcoming-bookings panel badge.
// 24hr bookings are their own category; legacy untyped bookings fall back
// to check-in hour.
function bookingSlotLabel(b) {
  const type = b?.bookingType ?? '';
  if (type === '24hr') return '24 Hour';
  if (type === 'night') return 'Overnight';
  if (type === 'day')   return 'Day Visit';
  const r = bookingRange(b);
  if (!r) return 'Booking';
  return r.ci.getHours() >= 18 ? 'Overnight' : 'Day Visit';
}

// ─── Single-unit slot status ──────────────────────────────────────────────────
function getSlotStatus(roomName, bookings, slot) {
  const now      = new Date();
  const [ws, we] = slot === 'day' ? dayWindow(now) : overnightWindow(now);

  // Pending bookings are excluded from the room board entirely — they
  // haven't paid yet, auto-cancel after 5 min of inactivity, and don't
  // represent a committed room hold. Once a pending booking is paid
  // (status → Confirmed), it shows up as 'incoming'.
  //
  // Checked-In bookings are FORCE-INCLUDED even when their scheduled
  // window doesn't overlap the current slot (e.g. checkout passed
  // before the slot started, or a 24hr booking that already started
  // its second window). The guest is physically holding the room
  // until manual checkout — without this, an overdue stay shows the
  // room as VACANT and staff would walk in another guest on top.
  const matching = bookings.filter(b => {
    if (b.roomType !== roomName) return false;
    if (b.status === 'Cancelled' || b.status === 'Completed' || b.status === 'Pending') return false;
    if (b.status === 'Checked In') return true;
    return overlapsWindow(b, ws, we);
  });

  // Priority: currently in progress > confirmed future.
  // Checked-In always counts as in-progress regardless of clock —
  // they're physically in the room until staff hits checkout.
  let inProgress = null, incoming = null;
  for (const b of matching) {
    const r = bookingRange(b);
    if (!r) continue;
    if (b.status === 'Checked In') {
      if (!inProgress) inProgress = { b, ...r };
      continue;
    }
    if (now >= r.ci && now < r.co) {
      if (!inProgress) inProgress = { b, ...r };
    } else if (now < r.ci) {
      if (!incoming) incoming = { b, ...r };
    }
  }

  if (inProgress) {
    const { b, co } = inProgress;
    const ms = co - now;
    const overdue = ms < 0;
    return {
      status:    'occupied',
      booking:   b,
      vacatesAt: b.checkOut,
      remaining: overdue ? 'OVERDUE' : countdown(ms),
      urgency:   overdue ? 'overdue' : (ms < 30 * 60000 ? 'soon' : 'normal'),
    };
  }
  if (incoming) {
    const { b, ci } = incoming;
    return { status: 'incoming', booking: b, arrivesAt: b.checkIn, eta: countdown(ci - now) };
  }
  return { status: 'vacant' };
}

// ─── Multi-unit aggregate status (cottages, pavilions with quantity > 1) ──────
function getMultiSlotStatus(roomName, quantity, bookings, slot) {
  const now      = new Date();
  const [ws, we] = slot === 'day' ? dayWindow(now) : overnightWindow(now);
  let occupied = 0, incoming = 0;

  // Same Pending exclusion as single-unit. Same Checked-In force-include
  // (an overdue Checked-In on one cottage of a multi-unit room must
  // still count toward occupied — otherwise the available count
  // overstates capacity and staff hand out an already-occupied unit).
  bookings.filter(b => {
    if (b.roomType !== roomName) return false;
    if (b.status === 'Cancelled' || b.status === 'Completed' || b.status === 'Pending') return false;
    if (b.status === 'Checked In') return true;
    return overlapsWindow(b, ws, we);
  }).forEach(b => {
    const r = bookingRange(b);
    if (!r) return;
    if (b.status === 'Checked In') { occupied++; return; }
    if (now >= r.ci && now < r.co) occupied++;
    else if (now < r.ci)           incoming++;
  });

  const booked = occupied + incoming;
  const vacant = Math.max(0, quantity - booked);
  const status = occupied > 0 ? 'occupied' : incoming > 0 ? 'incoming' : 'vacant';
  return { multi: true, quantity, occupied, incoming, vacant, status };
}

const getDayStatus        = (roomName, bookings)           => getSlotStatus(roomName, bookings, 'day');
const getOvernightStatus  = (roomName, bookings)           => getSlotStatus(roomName, bookings, 'night');
const getMultiDayStatus   = (roomName, quantity, bookings) => getMultiSlotStatus(roomName, quantity, bookings, 'day');
const getMultiNightStatus = (roomName, quantity, bookings) => getMultiSlotStatus(roomName, quantity, bookings, 'night');

// ─── status card config ───────────────────────────────────────────────────────
// "pending" intentionally absent — Pending bookings are excluded from
// the Rooms board (see getSlotStatus + getMultiSlotStatus). They don't
// hold the room and frequently auto-cancel.
const STATUS_CONFIG = {
  vacant:   { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white', label: 'VACANT',   icon: 'fa-check-circle'  },
  occupied: { bg: 'bg-rose-500',    border: 'border-rose-600',    text: 'text-white', label: 'OCCUPIED', icon: 'fa-door-closed'   },
  incoming: { bg: 'bg-sky-500',     border: 'border-sky-600',     text: 'text-white', label: 'ARRIVING', icon: 'fa-person-walking' },
};

// ─── VacantModal — shown when card has no active booking (vacant) ────────────
function VacantModal({ room, bookings = [], onClose, onWalkIn }) {
  const now = new Date();
  const dayRate = Number(room.day_rate ?? 0);
  const overnightRate = Number(room.overnight_rate ?? 0);
  const r24Rate = Number(room.rate_24hr ?? 0);
  const hasAnyRate = dayRate > 0 || overnightRate > 0 || r24Rate > 0;
  // Next reservation = soonest confirmed/incoming booking on this
  // room name with check-in still in the future. Same exclusion rules
  // as MultiUnitModal so the two modals can't surface conflicting
  // info about the same room.
  const nextBooking = bookings
    .filter(b =>
      b.roomType === room.name &&
      b.status !== 'Cancelled' &&
      b.status !== 'Completed' &&
      b.status !== 'Pending'
    )
    .map(b => ({ b, r: bookingRange(b) }))
    .filter(x => x.r && x.r.ci > now)
    .sort((a, b) => a.r.ci - b.r.ci)[0];

  return (
    <Modal open onClose={onClose} label={`Room ${room.name} — vacant`} maxWidth="max-w-sm">
      <div className="bg-emerald-500 rounded-lg p-4 mb-4 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-2 py-1 rounded-full bg-black/25 text-white">
          <i className="fas fa-check-circle text-xs"></i> VACANT
        </span>
        {room.type && <span className="text-sm text-white/80">{room.type}</span>}
      </div>

      {/* Quick-reference strip — rates + next reservation. Same shape
          as MultiUnitModal's strip; see the comment there for why we
          surface this even on a clearly-empty modal. */}
      {(hasAnyRate || nextBooking) && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
          {hasAnyRate && (
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide mb-1">Rates</p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-slate-700">
                {dayRate > 0       && <span><span className="text-slate-500">Day</span> <strong>{fmtMoney(dayRate)}</strong></span>}
                {overnightRate > 0 && <span><span className="text-slate-500">Overnight</span> <strong>{fmtMoney(overnightRate)}</strong></span>}
                {r24Rate > 0       && <span><span className="text-slate-500">24-hour</span> <strong>{fmtMoney(r24Rate)}</strong></span>}
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide mb-1">Next Reservation</p>
            {nextBooking ? (
              <p className="text-xs text-slate-700">
                <i className="fas fa-clock text-slate-400 mr-1"></i>
                {fmtTime(nextBooking.b.checkIn)} ({bookingSlotLabel(nextBooking.b)})
                {' · '}
                <span className="text-slate-600">{guestName(nextBooking.b) || nextBooking.b.guest || 'Guest'}</span>
                {nextBooking.r.ci.toDateString() !== now.toDateString() && (
                  <span className="text-slate-400"> · {nextBooking.r.ci.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-slate-400">No upcoming reservations on the books.</p>
            )}
          </div>
        </div>
      )}

      {/* Walk-in button */}
      <button
        type="button"
        onClick={onWalkIn}
        className="w-full mb-4 inline-flex items-center justify-center gap-2 min-h-11 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        <i className="fas fa-person-walking" aria-hidden="true"></i>
        Walk-in Booking for {room.name}
      </button>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full inline-flex items-center justify-center min-h-11 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        Close
      </button>
    </Modal>
  );
}

function guestName(booking) {
  if (!booking) return null;
  const match = booking.specialRequests?.match(/^Walk-in:\s*([^,]+)/);
  return match?.[1]?.trim() || booking.guest || booking.guest_name || null;
}

function fmtDateLabel(dt) {
  if (!dt) return '—';
  const d    = new Date(dt.replace(' ', 'T'));
  const now  = new Date();
  const tom  = new Date(now); tom.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d.toDateString() === now.toDateString())  return `Today · ${time}`;
  if (d.toDateString() === tom.toDateString())  return `Tomorrow · ${time}`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ' · ' + time;
}

// ─── MultiUnitCard — for cottages / pavilions with quantity > 1 ──────────────
function MultiUnitCard({ room, info, onOpen }) {
  const { quantity, occupied, incoming, vacant } = info;

  const dots = [];
  for (let i = 0; i < quantity; i++) {
    if (i < occupied)                 dots.push('bg-rose-500');
    else if (i < occupied + incoming) dots.push('bg-sky-500');
    else                              dots.push('bg-emerald-400');
  }

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); } }}
      className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-col gap-2 cursor-pointer transition-all duration-200 hover:border-slate-300 hover:shadow-md hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800 text-xs leading-tight truncate">{room.name}</p>
        <span className="text-[10px] font-bold text-slate-400 ml-1 shrink-0">×{quantity}</span>
      </div>

      {/* Dot grid */}
      <div className="flex flex-wrap gap-0.5">
        {dots.slice(0, 24).map((c, i) => <span key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
        {quantity > 24 && <span className="text-[9px] text-slate-400 self-center ml-0.5">+{quantity - 24}</span>}
      </div>

      {/* Counts — compact inline. "Pend" chip removed along with the
          pending filter tab — pending bookings don't hold the room. */}
      <div className="flex flex-wrap gap-1">
        {[
          occupied > 0 && { n: occupied, label: 'Occ',  cls: 'bg-rose-100 text-rose-700' },
          incoming > 0 && { n: incoming, label: 'Arr',  cls: 'bg-sky-100 text-sky-700' },
          vacant   > 0 && { n: vacant,   label: 'Free', cls: 'bg-emerald-100 text-emerald-700' },
        ].filter(Boolean).map(({ n, label, cls }) => (
          <span key={label} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>{n} {label}</span>
        ))}
      </div>
    </div>
  );
}

// ─── MultiUnitModal — details + per-booking list for multi-unit rooms ────────
function MultiUnitModal({ room, info, bookings, slot, onClose, onWalkIn, onOpenBooking }) {
  const now = new Date();
  const [ws, we] = slot === 'day' ? dayWindow(now) : overnightWindow(now);

  // Pending bookings are excluded in line with getSlotStatus —
  // they don't hold the room and auto-cancel, so surfacing them in
  // the detail modal was just noise.
  //
  // Checked-In rows are force-included regardless of slot overlap —
  // an overdue Checked-In or a 24hr stay whose window doesn't fall
  // inside the current Day/Night slot still occupies the unit, and
  // getMultiSlotStatus counts them toward the header's "Occ" badge.
  // Without this special-case, the modal body could read "No active
  // bookings" while the header simultaneously showed "1 Occ" —
  // because the count and the body filter would disagree on whether
  // a checked-in 24hr stay belongs in this slot's view.
  const occupied = [], incoming = [];
  bookings
    .filter(b => {
      if (b.roomType !== room.name) return false;
      if (b.status === 'Cancelled' || b.status === 'Completed' || b.status === 'Pending') return false;
      if (b.status === 'Checked In') return true;
      return overlapsWindow(b, ws, we);
    })
    .forEach(b => {
      const r = bookingRange(b);
      if (!r) return;
      // Checked-In always classifies as occupied — mirrors the count
      // logic. A Checked-In whose checkOut is in the past (overdue)
      // or whose window doesn't overlap the current slot is still
      // physically inside the unit until staff check them out.
      if (b.status === 'Checked In')   { occupied.push(b); return; }
      if (now >= r.ci && now < r.co)     occupied.push(b);
      else if (now < r.ci)               incoming.push(b);
    });

  const cat = getCat(room);
  const icon = cat === 'cottage' ? 'fa-umbrella-beach' : cat === 'pavilion' ? 'fa-archway' : 'fa-bed';

  const KIND = {
    occupied: { pill: 'bg-rose-500 text-white', label: 'OCCUPIED', row: 'bg-rose-50 border-rose-200 hover:bg-rose-100' },
    incoming: { pill: 'bg-sky-500 text-white',  label: 'ARRIVING', row: 'bg-sky-50 border-sky-200 hover:bg-sky-100'    },
  };

  function renderRow(b, kind) {
    const guest = guestName(b) || b.guest || b.guest_name || 'Guest';
    const typeLabel = bookingSlotLabel(b);
    const cfg = KIND[kind];
    return (
      <button
        key={b.bookingId}
        onClick={() => onOpenBooking(b)}
        className={`w-full text-left rounded-lg border p-3 transition-all ${cfg.row}`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${cfg.pill}`}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{b.id}</span>
        </div>
        <p className="font-semibold text-slate-900 text-sm leading-tight">
          <i className="fas fa-user text-slate-400 text-xs mr-1"></i>{guest}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-600">
          <span><i className="fas fa-clock mr-1 opacity-60"></i>{fmtTime(b.checkIn)} → {fmtTime(b.checkOut)}</span>
          <span className="text-slate-300">·</span>
          <span>{typeLabel}</span>
          <span className="text-slate-300">·</span>
          <span>{b.guests} guest{b.guests !== 1 ? 's' : ''}</span>
        </div>
      </button>
    );
  }

  const total = occupied.length + incoming.length;

  return (
    <Modal open onClose={onClose} label={`Room ${room.name} — booking details`} maxWidth="max-w-lg">
      {/* Header strip with counts */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <i className={`fas ${icon} text-slate-500`}></i>
          <span className="font-semibold text-slate-800 text-sm">{room.name}</span>
          <span className="text-[10px] font-bold text-slate-400">×{info.quantity}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {info.occupied > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">{info.occupied} Occ</span>}
          {info.incoming > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">{info.incoming} Arr</span>}
          {info.vacant   > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{info.vacant} Free</span>}
        </div>
      </div>

      {/* Booking list */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {occupied.map(b => renderRow(b, 'occupied'))}
        {incoming.map(b => renderRow(b, 'incoming'))}
        {total === 0 && (
          <div className="py-6 text-center text-slate-400 text-sm">
            <i className="fas fa-calendar-check block text-2xl mb-1 text-slate-300"></i>
            No active bookings in this slot.
          </div>
        )}
      </div>

      {/*
        Quick-reference strip — rates + next reservation.
        Surfaces info staff routinely need WHILE this modal is open
        (rate quote on the phone, next-arrival timing for housekeeping
        turnaround, conflict check before walking someone in). Renders
        regardless of occupancy state — useful in both the empty-slot
        case (avoids the modal looking blank) and the occupied case
        (next arrival matters more here, since the current guest's
        checkout has to happen before it).
      */}
      {(() => {
        const dayRate = Number(room.day_rate ?? 0);
        const overnightRate = Number(room.overnight_rate ?? 0);
        const r24Rate = Number(room.rate_24hr ?? 0);
        // Next reservation = soonest confirmed/incoming booking on
        // this room name with check-in still in the future. Excludes
        // Cancelled, Completed, Pending — same exclusion the modal's
        // own occupancy tally above uses, kept consistent so what's
        // shown here can't contradict the count badges.
        const nextBooking = bookings
          .filter(b =>
            b.roomType === room.name &&
            b.status !== 'Cancelled' &&
            b.status !== 'Completed' &&
            b.status !== 'Pending'
          )
          .map(b => ({ b, r: bookingRange(b) }))
          .filter(x => x.r && x.r.ci > now)
          .sort((a, b) => a.r.ci - b.r.ci)[0];

        const hasAnyRate = dayRate > 0 || overnightRate > 0 || r24Rate > 0;
        if (!hasAnyRate && !nextBooking) return null;

        return (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
            {hasAnyRate && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide mb-1">Rates</p>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-slate-700">
                  {dayRate > 0       && <span><span className="text-slate-500">Day</span> <strong>{fmtMoney(dayRate)}</strong></span>}
                  {overnightRate > 0 && <span><span className="text-slate-500">Overnight</span> <strong>{fmtMoney(overnightRate)}</strong></span>}
                  {r24Rate > 0       && <span><span className="text-slate-500">24-hour</span> <strong>{fmtMoney(r24Rate)}</strong></span>}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide mb-1">Next Reservation</p>
              {nextBooking ? (
                <p className="text-xs text-slate-700">
                  <i className="fas fa-clock text-slate-400 mr-1"></i>
                  {fmtTime(nextBooking.b.checkIn)} ({bookingSlotLabel(nextBooking.b)})
                  {' · '}
                  <span className="text-slate-600">{guestName(nextBooking.b) || nextBooking.b.guest || 'Guest'}</span>
                  {nextBooking.r.ci.toDateString() !== now.toDateString() && (
                    <span className="text-slate-400"> · {nextBooking.r.ci.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-slate-400">No upcoming reservations on the books.</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Walk-in + close */}
      <div className="mt-4 flex flex-col gap-2">
        {info.vacant > 0 ? (
          <button
            type="button"
            onClick={onWalkIn}
            className="w-full inline-flex items-center justify-center gap-2 min-h-11 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            <i className="fas fa-person-walking" aria-hidden="true"></i>
            Walk-in Booking for {room.name}
          </button>
        ) : (
          <div className="text-center text-rose-600 text-sm font-semibold py-2 bg-rose-50 rounded-lg">
            <i className="fas fa-ban mr-1" aria-hidden="true"></i>All units are booked for this slot.
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full inline-flex items-center justify-center min-h-11 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

// ─── RoomCard ─────────────────────────────────────────────────────────────────
function RoomCard({ room, info, onClick }) {
  const config = STATUS_CONFIG[info.status];
  const guest  = guestName(info.booking);

  return (
    <div onClick={onClick}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className={`
        ${config.bg} ${config.border} ${config.text}
        border-2 rounded-lg p-3 flex flex-col gap-1.5
        shadow-sm cursor-pointer transition-all duration-200
        hover:opacity-90 hover:scale-[1.015]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2
        ${info.status === 'occupied' && (info.urgency === 'soon' || info.urgency === 'overdue') ? 'animate-pulse' : ''}
      `}
    >
      {/* Top row: status badge + soon/overdue chip */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-black/20 text-white">
          <i className={`fas ${config.icon} text-[9px]`}></i>{config.label}
        </span>
        {info.status === 'occupied' && info.urgency === 'overdue' && (
          <span className="text-[10px] font-bold bg-yellow-300 text-rose-900 px-1.5 py-0.5 rounded-full">! OVERDUE</span>
        )}
        {info.status === 'occupied' && info.urgency === 'soon' && (
          <span className="text-[10px] font-bold bg-white/30 px-1.5 py-0.5 rounded-full">⚡ Soon</span>
        )}
      </div>

      {/* Room name + guest */}
      <div>
        <p className="text-sm font-bold leading-tight">{room.name}</p>
        {guest && (
          <p className="text-[11px] font-medium truncate mt-0.5 opacity-85">
            <i className="fas fa-user mr-1 opacity-60 text-[9px]"></i>{guest}
          </p>
        )}
      </div>

      {/* Status detail */}
      <div className="text-[11px] font-semibold opacity-90 leading-tight">
        {info.status === 'vacant'   && <span><i className="fas fa-circle-check mr-1 text-[9px]"></i>Vacant</span>}
        {info.status === 'occupied' && (
          <span>
            <i className="fas fa-clock mr-1 text-[9px]"></i>Out {fmtTime(info.vacatesAt)}
            {info.remaining && <span className="ml-1 opacity-75">({info.remaining})</span>}
          </span>
        )}
        {info.status === 'incoming' && (
          <span>
            <i className="fas fa-arrow-right mr-1 text-[9px]"></i>Arrives {fmtTime(info.arrivesAt)}
            {info.eta && <span className="ml-1 opacity-75">(in {info.eta})</span>}
          </span>
        )}
      </div>

    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────────
// `embedded` prop: see Bookings.jsx for the rationale — when true,
// the front-desk Sidebar + top bar are skipped so an outer shell
// (AdminShell) can wrap the page body instead.
export default function FDRooms({ embedded = false }) {
  const Shell = embedded ? Fragment : Sidebar;
  const navigate = useNavigate();
  const [rooms, setRooms]       = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filter, setFilter]     = useState('all');
  const [selectedSlot, setSelectedSlot] = useState(null); // { room, info }
  const [selectedMulti, setSelectedMulti] = useState(null); // { room, info, slot }
  const [toast, showToast, clearToast, toastType] = useToast();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getFdRooms(), getFdBookings()])
      .then(([rm, bk]) => { setRooms(rm); setBookings(bk); setLastRefresh(new Date()); })
      .catch(() => showToast('Failed to load room data.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  // Upcoming bookings: Confirmed only. Pending bookings are excluded —
  // they haven't committed funds yet and auto-cancel after 5 min, so
  // surfacing them in a staff-facing "upcoming" list creates noise.
  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return bookings
      .filter(b => {
        if (['Cancelled', 'Completed', 'Checked In', 'Pending'].includes(b.status)) return false;
        return new Date(b.checkIn.replace(' ', 'T')) >= now;
      })
      .sort((a, b) => new Date(a.checkIn.replace(' ', 'T')) - new Date(b.checkIn.replace(' ', 'T')));
  }, [bookings]);

  // Compute day and overnight info for every room
  const roomInfos = useMemo(() => rooms.map(r => {
    const qty = r.quantity ?? 1;
    return {
      room:      r,
      dayInfo:   qty > 1 ? getMultiDayStatus(r.name, qty, bookings)   : getDayStatus(r.name, bookings),
      nightInfo: qty > 1 ? getMultiNightStatus(r.name, qty, bookings) : getOvernightStatus(r.name, bookings),
    };
  }), [rooms, bookings]);

  // Summary counts. Counts UNITS not slot-cards: single-unit rooms
  // classify by max-severity status across both slots (occupied >
  // incoming > vacant); multi-unit rooms take the max occupied/incoming
  // counts across their two slots so a 24hr booking on one cottage
  // only contributes 1 to occupied (not 2 from being in both windows).
  //
  // Two pseudo-room categories are excluded from the Vacant tally:
  //   - 'tent' — bring-your-own-pitch service, large idle inventory
  //     (hidden from card display entirely when no activity, matched
  //     here so the summary reflects what's on screen).
  //   - 'admission' — the "Entrance Only" pseudo-room (qty 999) used
  //     by walk-in code paths to record gate-only admissions. It's
  //     not a bookable physical unit and was visible to staff
  //     (front_desk/owner) on this endpoint — without this skip it
  //     padded Vacant with +999.
  // Both still contribute to Occupied/Incoming when they have actual
  // activity (admission rarely will, since walk-ins immediately
  // become bookings; tents may).
  const isExcludedFromVacancy = (room) => {
    const cat = getCat(room);
    return cat === 'tent' || cat === 'admission';
  };
  const counts = useMemo(() => {
    const c = { vacant: 0, occupied: 0, incoming: 0 };
    roomInfos.forEach(({ room, dayInfo, nightInfo }) => {
      const skipVacant = isExcludedFromVacancy(room);
      if (dayInfo.multi) {
        const occ = Math.max(dayInfo.occupied, nightInfo.occupied);
        const inc = Math.max(dayInfo.incoming, nightInfo.incoming);
        c.occupied += occ;
        c.incoming += inc;
        if (!skipVacant) c.vacant += Math.max(0, dayInfo.quantity - occ - inc);
      } else {
        const status =
          (dayInfo.status === 'occupied' || nightInfo.status === 'occupied') ? 'occupied'
        : (dayInfo.status === 'incoming' || nightInfo.status === 'incoming') ? 'incoming'
        : 'vacant';
        if (status === 'vacant' && skipVacant) return;
        c[status] += 1;
      }
    });
    return c;
  }, [roomInfos]);

  // Filter applies to both sections (show only rooms where at least one slot matches)
  const filteredInfos = useMemo(() => {
    if (filter === 'all') return roomInfos;
    return roomInfos.filter(({ dayInfo, nightInfo }) =>
      dayInfo.status === filter || nightInfo.status === filter
    );
  }, [roomInfos, filter]);

  // After 6PM PH time, overnight is the active shift — show it first, fade day
  // Before 6AM, overnight is still active (ends 7AM)
  const currentHour  = new Date().getHours();
  const isNightShift = currentHour >= 18 || currentHour < 6;

  // Don't fade a section if it still has occupied rooms (e.g. 24hr bookings in progress)
  const hasOccupiedDay   = roomInfos.some(({ dayInfo })   => dayInfo.status === 'occupied');
  const hasOccupiedNight = roomInfos.some(({ nightInfo }) => nightInfo.status === 'occupied');

  const FILTERS = [
    { key: 'all',      label: 'All Rooms', color: 'bg-slate-700 text-white'   },
    { key: 'vacant',   label: 'Vacant',    color: 'bg-emerald-500 text-white' },
    { key: 'occupied', label: 'Occupied',  color: 'bg-rose-500 text-white'    },
    { key: 'incoming', label: 'Arriving',  color: 'bg-sky-500 text-white'     },
  ];

  return (
    <Shell>
      <Helmet><title>Rooms — Frontdesk</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} />
      {selectedSlot && (
        selectedSlot.info.booking ? (
          <BookingDetailModal
            booking={selectedSlot.info.booking}
            onClose={() => setSelectedSlot(null)}
            onUpdated={() => load()}
            showToast={showToast}
          />
        ) : (
          <VacantModal
            room={selectedSlot.room}
            bookings={bookings}
            onClose={() => setSelectedSlot(null)}
            onWalkIn={() => navigate('/frontdesk/walkin', { state: { preselectedRoom: selectedSlot.room } })}
          />
        )
      )}
      {selectedMulti && !selectedSlot && (
        <MultiUnitModal
          room={selectedMulti.room}
          info={selectedMulti.info}
          bookings={bookings}
          slot={selectedMulti.slot}
          onClose={() => setSelectedMulti(null)}
          onWalkIn={() => {
            const r = selectedMulti.room;
            setSelectedMulti(null);
            navigate('/frontdesk/walkin', { state: { preselectedRoom: r } });
          }}
          onOpenBooking={(b) => {
            // Hand off to BookingDetailModal, keep selectedMulti so closing
            // returns here. Board only ever surfaces non-Pending bookings
            // now, so the info status is always 'incoming' (or the child
            // modal resolves to 'occupied' based on booking time).
            setSelectedSlot({ room: { name: b.roomType, id: b.roomId }, info: { booking: b, status: 'incoming' } });
          }}
        />
      )}
      {/* Mobile + tablet stack the room grid above the Upcoming Bookings
          panel; lg+ side-by-side. Previous fixed flex with a w-80 right
          panel crushed the room grid down to ~40px on phone widths. */}
      <main className="p-4 md:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">

        {/* ── LEFT: Room grid ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-400">
              Last updated: {lastRefresh.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}
              <span className="ml-2 text-slate-300">· Auto-refreshes every 10s</span>
            </p>
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700">
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
          </div>

          {/* Summary bar — single column on phone, three cols at sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Vacant',   count: counts.vacant,   bg: 'bg-emerald-500', icon: 'fa-check-circle'   },
              { label: 'Occupied', count: counts.occupied, bg: 'bg-rose-500',    icon: 'fa-door-closed'    },
              { label: 'Arriving', count: counts.incoming, bg: 'bg-sky-500',     icon: 'fa-person-walking' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3 text-white shadow`}>
                <i className={`fas ${s.icon} text-2xl opacity-80`}></i>
                <div>
                  <p className="text-3xl font-extrabold leading-none">{loading ? '—' : s.count}</p>
                  <p className="text-xs font-medium opacity-90 mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`inline-flex items-center min-h-11 px-4 py-1.5 rounded-full text-sm font-medium transition-all border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                  filter === f.key
                    ? `${f.color} border-transparent shadow`
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <i className="fas fa-spinner fa-spin text-3xl mb-3 block"></i>Loading room status...
            </div>
          ) : filteredInfos.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <i className="fas fa-door-open text-3xl mb-3 block"></i>No rooms match this filter.
            </div>
          ) : (
            <div className="space-y-10">
              {/* Sections swap order: after 6PM overnight comes first */}
              {(isNightShift ? ['night', 'day'] : ['day', 'night']).map(slot => {
                const isDay   = slot === 'day';
                // Fade the off-shift section UNLESS it still has occupied rooms (24hr bookings)
                const faded   = isDay
                  ? (isNightShift && !hasOccupiedDay)
                  : (!isNightShift && !hasOccupiedNight);
                const infoKey = isDay ? 'dayInfo' : 'nightInfo';
                const slotItems = filteredInfos.filter(item => filter === 'all' || item[infoKey].status === filter);

                return (
                  <div key={slot} className={faded ? 'opacity-50' : ''}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
                        isDay
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-indigo-50 border border-indigo-200'
                      }`}>
                        <i className={`fas ${isDay ? 'fa-sun text-amber-500' : 'fa-moon text-indigo-500'}`}></i>
                        <span className={`font-semibold text-sm ${isDay ? 'text-amber-800' : 'text-indigo-800'}`}>
                          {isDay ? 'Day Visit' : 'Overnight Stay'}
                        </span>
                        <span className={`text-xs ${isDay ? 'text-amber-600' : 'text-indigo-600'}`}>
                          {isDay ? '6:00 AM – 6:00 PM' : '6:00 PM – 7:00 AM'}
                        </span>
                      </div>
                      {(() => {
                        const slotOccupied = isDay ? hasOccupiedDay : hasOccupiedNight;
                        const offShift = isDay ? isNightShift : !isNightShift;
                        if (!offShift) return (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                          </span>
                        );
                        if (slotOccupied) return (
                          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <i className="fas fa-clock text-[10px]"></i>
                            In progress
                          </span>
                        );
                        return (
                          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {isDay ? 'Ended' : 'Not yet'}
                          </span>
                        );
                      })()}
                    </div>
                    {slotItems.length === 0
                      ? <p className="text-slate-400 text-sm py-4">No rooms match this filter.</p>
                      : (
                        <div className="space-y-5">
                          {CATEGORY_GROUPS.map(grp => {
                            let items = slotItems.filter(({ room }) => getCat(room) === grp.key);
                            // Tent is a bring-your-own-pitch service with
                            // lots of inventory (qty 20) — rendering its
                            // card when nobody is using it would put an
                            // empty "20 Free" tile on the board every day.
                            // Only surface the tent section when there's
                            // genuine activity on it.
                            if (grp.key === 'tent') {
                              items = items.filter(item => {
                                const info = item[infoKey];
                                return info.multi
                                  ? (info.occupied > 0 || info.incoming > 0)
                                  : (info.status !== 'vacant');
                              });
                            }
                            if (!items.length) return null;
                            return (
                              <div key={grp.key}>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                  <i className={`fas ${grp.icon} text-[10px]`}></i>{grp.label}
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {items.map(item => {
                                    const info = item[infoKey];
                                    return info.multi ? (
                                      <MultiUnitCard key={`${slot}-${item.room.id}`} room={item.room} info={info}
                                        onOpen={() => setSelectedMulti({ room: item.room, info, slot })} />
                                    ) : (
                                      <RoomCard key={`${slot}-${item.room.id}`} room={item.room} info={info}
                                        onClick={() => setSelectedSlot({ room: item.room, info })} />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    }
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-8 space-y-2">
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Vacant — ready for guests</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span> Occupied — shows time until vacant</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500 inline-block"></span> Arriving — confirmed, not yet checked in</span>
              <span className="flex items-center gap-1.5"><span className="text-base">⚡</span> Soon — vacating within 30 minutes</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Upcoming Bookings panel ──────────────────────────────────── */}
        <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col">
          {/* Panel header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <i className="fas fa-calendar-alt text-sky-500"></i>
              Upcoming Bookings
            </h2>
            {!loading && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                upcomingBookings.length > 0 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {upcomingBookings.length}
              </span>
            )}
          </div>

          {/* Scrollable list. On mobile/tablet the panel stacks below
              the room grid in normal document flow, so the maxHeight
              cap (which creates nested scrolling) only applies at lg+
              where the panel sits beside the grid and needs to fit
              within the viewport. */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 lg:max-h-[calc(100vh-180px)]">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <i className="fas fa-spinner fa-spin block text-2xl mb-2"></i>Loading…
              </div>
            ) : upcomingBookings.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <i className="fas fa-calendar-check block text-3xl mb-3 text-slate-300"></i>
                <p className="text-sm font-medium">No upcoming bookings</p>
                <p className="text-xs mt-1">All clear for now</p>
              </div>
            ) : upcomingBookings.map(b => {
              const isToday   = b.checkIn?.slice(0, 10) === todayStr();
              const slotLabel = bookingSlotLabel(b);
              const is24hr    = slotLabel === '24 Hour';
              const overnight = slotLabel === 'Overnight';
              const name      = b.guest || b.guest_name || 'Guest';

              // Pending bookings no longer reach this list (filtered out
              // in upcomingBookings above), so all entries are Confirmed.
              return (
                <button
                  key={b.bookingId}
                  onClick={() => setSelectedSlot({ room: { name: b.roomType, id: b.roomId }, info: { booking: b, status: 'incoming' } })}
                  className={`w-full text-left rounded-xl border p-3 transition-all hover:shadow-md active:scale-[0.99] ${
                    isToday
                      ? 'border-sky-200 bg-sky-50 hover:bg-sky-100'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* Top row: status badge + booking type */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
                      <i className="fas fa-check-circle text-[9px]"></i>
                      {b.status}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      is24hr
                        ? 'bg-violet-50 text-violet-600'
                        : overnight
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'bg-amber-50 text-amber-600'
                    }`}>
                      <i className={`fas ${is24hr ? 'fa-clock' : overnight ? 'fa-moon' : 'fa-sun'} text-[9px]`}></i>
                      {slotLabel}
                    </span>
                  </div>

                  {/* Guest name */}
                  <p className="font-semibold text-slate-900 text-sm truncate leading-tight">
                    <i className="fas fa-user text-slate-400 text-xs mr-1"></i>
                    {name}
                  </p>

                  {/* Room */}
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    <i className="fas fa-door-open text-slate-300 mr-1"></i>
                    {b.roomType}
                  </p>

                  {/* Check-in time */}
                  <p className={`text-xs font-semibold mt-1.5 ${isToday ? 'text-sky-600' : 'text-slate-600'}`}>
                    <i className="fas fa-clock mr-1 opacity-60"></i>
                    {fmtDateLabel(b.checkIn)}
                  </p>

                  {/* Bottom row: guests + ref */}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-400">
                      <i className="fas fa-users mr-1"></i>
                      {b.guests} guest{b.guests !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{b.id}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </main>
    </Shell>
  );
}
