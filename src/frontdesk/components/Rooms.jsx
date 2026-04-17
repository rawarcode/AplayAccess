import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Layout/Sidebar';
import Modal from '../../components/modals/Modal';
import { getFdBookings, getFdRooms } from '../../lib/frontdeskApi';
import Toast, { useToast } from '../../components/ui/Toast';
import BookingDetailModal from './BookingDetailModal';
import { fmtTime } from '../../lib/format';

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

function getCat(room) {
  if (room.category) return room.category;
  const n = (room.name || '').toLowerCase();
  if (n.includes('cottage'))  return 'cottage';
  if (n.includes('pavilion')) return 'pavilion';
  return 'room';
}

const CATEGORY_GROUPS = [
  { key: 'room',     label: 'Rooms',     icon: 'fa-bed'            },
  { key: 'cottage',  label: 'Cottages',  icon: 'fa-umbrella-beach' },
  { key: 'pavilion', label: 'Pavilions', icon: 'fa-archway'        },
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

// Classify by booking_type field from backend (night, 24hr, 24hr-pm are overnight-slot)
function isOvernightBooking(b) {
  const type = b.bookingType ?? '';
  if (type === 'night' || type === '24hr-pm') return true;
  if (type === 'day') return false;
  // 24hr bookings starting at 6AM belong to the day slot; 24hr-pm already handled above
  if (type === '24hr') return false;
  // Fallback for legacy bookings without bookingType: check if check-in is 6PM+
  const ci = new Date(b.checkIn.replace(' ', 'T'));
  return ci.getHours() >= 18;
}

// ─── Day slot status ───────────────────────────────────────────────────────────
// Looks at today's bookings that check out by 5PM (day visits)
function getDayStatus(roomName, bookings) {
  const now     = new Date();
  const today   = todayStr();

  const dayBk = bookings.filter(b =>
    b.roomType === roomName &&
    b.checkIn?.slice(0, 10) === today &&
    b.status !== 'Cancelled' &&
    b.status !== 'Completed' &&
    !isOvernightBooking(b)
  );

  for (const b of dayBk) {
    const ci = new Date(b.checkIn.replace(' ', 'T'));
    const co = new Date(b.checkOut.replace(' ', 'T'));

    if (now >= ci && now < co) {
      const ms = co - now;
      return {
        status:    'occupied',
        booking:   b,
        vacatesAt: b.checkOut,
        remaining: countdown(ms),
        urgency:   ms < 30 * 60000 ? 'soon' : 'normal',
      };
    }
    if (now < ci) {
      return {
        status:    b.status === 'Pending' ? 'pending' : 'incoming',
        booking:   b,
        arrivesAt: b.checkIn,
        eta:       countdown(ci - now),
      };
    }
  }

  return { status: 'vacant' };
}

// ─── Overnight slot status ─────────────────────────────────────────────────────
// Looks at tonight's overnight booking (6PM today → 6AM tomorrow)
// or a currently-in-progress overnight (started yesterday 6PM, ends 6AM today)
function getOvernightStatus(roomName, bookings) {
  const now   = new Date();
  const today = todayStr();

  const ovBk = bookings.filter(b => {
    if (b.roomType !== roomName || b.status === 'Cancelled' || b.status === 'Completed') return false;
    if (!isOvernightBooking(b)) return false;
    const ci = new Date(b.checkIn.replace(' ', 'T'));
    const co = new Date(b.checkOut.replace(' ', 'T'));
    // Relevant if currently in progress OR check-in is today (tonight)
    return (now >= ci && now < co) || ci.toISOString().slice(0, 10) === today;
  });

  for (const b of ovBk) {
    const ci = new Date(b.checkIn.replace(' ', 'T'));
    const co = new Date(b.checkOut.replace(' ', 'T'));

    if (now >= ci && now < co) {
      const ms = co - now;
      return {
        status:    'occupied',
        booking:   b,
        vacatesAt: b.checkOut,
        remaining: countdown(ms),
        urgency:   ms < 30 * 60000 ? 'soon' : 'normal',
      };
    }
    if (now < ci) {
      return {
        status:    b.status === 'Pending' ? 'pending' : 'incoming',
        booking:   b,
        arrivesAt: b.checkIn,
        eta:       countdown(ci - now),
      };
    }
  }

  return { status: 'vacant' };
}

// ─── Multi-unit aggregate status (cottages, pavilions with quantity > 1) ──────
function getMultiDayStatus(roomName, quantity, bookings) {
  const now   = new Date();
  const today = todayStr();
  let occupied = 0, incoming = 0, pending = 0;

  bookings.filter(b =>
    b.roomType === roomName &&
    b.checkIn?.slice(0, 10) === today &&
    b.status !== 'Cancelled' &&
    b.status !== 'Completed' &&
    !isOvernightBooking(b)
  ).forEach(b => {
    const ci = new Date(b.checkIn.replace(' ', 'T'));
    const co = new Date(b.checkOut.replace(' ', 'T'));
    if (now >= ci && now < co)        occupied++;
    else if (now < ci) {
      if (b.status === 'Pending')     pending++;
      else                            incoming++;
    }
  });

  const booked = occupied + incoming + pending;
  const vacant = Math.max(0, quantity - booked);
  // summarised status for filter matching
  const status = occupied > 0 ? 'occupied' : incoming > 0 ? 'incoming' : pending > 0 ? 'pending' : 'vacant';
  return { multi: true, quantity, occupied, incoming, pending, vacant, status };
}

function getMultiNightStatus(roomName, quantity, bookings) {
  const now   = new Date();
  const today = todayStr();
  let occupied = 0, incoming = 0, pending = 0;

  bookings.filter(b => {
    if (b.roomType !== roomName || b.status === 'Cancelled' || b.status === 'Completed') return false;
    if (!isOvernightBooking(b)) return false;
    const ci = new Date(b.checkIn.replace(' ', 'T'));
    const co = new Date(b.checkOut.replace(' ', 'T'));
    return (now >= ci && now < co) || ci.toISOString().slice(0, 10) === today;
  }).forEach(b => {
    const ci = new Date(b.checkIn.replace(' ', 'T'));
    const co = new Date(b.checkOut.replace(' ', 'T'));
    if (now >= ci && now < co)        occupied++;
    else if (now < ci) {
      if (b.status === 'Pending')     pending++;
      else                            incoming++;
    }
  });

  const booked = occupied + incoming + pending;
  const vacant = Math.max(0, quantity - booked);
  const status = occupied > 0 ? 'occupied' : incoming > 0 ? 'incoming' : pending > 0 ? 'pending' : 'vacant';
  return { multi: true, quantity, occupied, incoming, pending, vacant, status };
}

// ─── status card config ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  vacant:   { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white',      label: 'VACANT',   icon: 'fa-check-circle'  },
  occupied: { bg: 'bg-rose-500',    border: 'border-rose-600',    text: 'text-white',      label: 'OCCUPIED', icon: 'fa-door-closed'   },
  incoming: { bg: 'bg-sky-500',     border: 'border-sky-600',     text: 'text-white',      label: 'ARRIVING', icon: 'fa-person-walking' },
  pending:  { bg: 'bg-amber-400',   border: 'border-amber-500',   text: 'text-slate-900',  label: 'PENDING',  icon: 'fa-clock'         },
};

// ─── VacantModal — shown when card has no active booking (vacant) ────────────
function VacantModal({ room, onClose, onWalkIn }) {
  return (
    <Modal open onClose={onClose} title={room.name} maxWidth="max-w-sm">
      <div className="bg-emerald-500 rounded-lg p-4 mb-4 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-2 py-1 rounded-full bg-black/25 text-white">
          <i className="fas fa-check-circle text-xs"></i> VACANT
        </span>
        {room.type && <span className="text-sm text-white/80">{room.type}</span>}
      </div>

      {/* Walk-in button */}
      <button
        onClick={onWalkIn}
        className="w-full mb-4 flex items-center justify-center gap-2 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition-colors"
      >
        <i className="fas fa-person-walking"></i>
        Walk-in Booking for {room.name}
      </button>

      <button onClick={onClose} className="mt-4 w-full py-2 border rounded text-sm text-slate-600 hover:bg-slate-50">
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
function MultiUnitCard({ room, info, onWalkIn }) {
  const { quantity, occupied, incoming, pending, vacant } = info;

  const dots = [];
  for (let i = 0; i < quantity; i++) {
    if (i < occupied)                         dots.push('bg-rose-500');
    else if (i < occupied + incoming)         dots.push('bg-sky-500');
    else if (i < occupied + incoming + pending) dots.push('bg-amber-400');
    else                                      dots.push('bg-emerald-400');
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-col gap-2">
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

      {/* Counts — compact inline */}
      <div className="flex flex-wrap gap-1">
        {[
          occupied  > 0 && { n: occupied,  label: 'Occ',      cls: 'bg-rose-100 text-rose-700'    },
          incoming  > 0 && { n: incoming,  label: 'Arr',      cls: 'bg-sky-100 text-sky-700'  },
          pending   > 0 && { n: pending,   label: 'Pend',     cls: 'bg-amber-100 text-amber-700' },
          vacant    > 0 && { n: vacant,    label: 'Free',     cls: 'bg-emerald-100 text-emerald-700' },
        ].filter(Boolean).map(({ n, label, cls }) => (
          <span key={label} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>{n} {label}</span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end border-t border-slate-100 pt-1.5">
        {vacant > 0
          ? <button onClick={onWalkIn} className="text-[10px] font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-0.5">
              <i className="fas fa-person-walking text-[9px]"></i> Walk-in
            </button>
          : <span className="text-[10px] text-rose-500 font-semibold">Full</span>
        }
      </div>
    </div>
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
        ${info.status === 'occupied' && info.urgency === 'soon' ? 'animate-pulse' : ''}
      `}
    >
      {/* Top row: status badge + ⚡ */}
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full
          ${info.status === 'pending' ? 'bg-amber-500 text-slate-900' : 'bg-black/20 text-white'}`}>
          <i className={`fas ${config.icon} text-[9px]`}></i>{config.label}
        </span>
        {info.status === 'occupied' && info.urgency === 'soon' && (
          <span className="text-[10px] font-bold bg-white/30 px-1.5 py-0.5 rounded-full">⚡ Soon</span>
        )}
      </div>

      {/* Room name + guest */}
      <div>
        <p className="text-sm font-bold leading-tight">{room.name}</p>
        {guest && (
          <p className={`text-[11px] font-medium truncate mt-0.5 ${info.status === 'pending' ? 'text-slate-800' : 'opacity-85'}`}>
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
        {info.status === 'pending'  && (
          <span className="text-slate-800">
            <i className="fas fa-exclamation-circle mr-1 text-[9px]"></i>Pending {info.booking ? fmtTime(info.booking.checkIn) : ''}
          </span>
        )}
      </div>

    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────────
export default function FDRooms() {
  const navigate = useNavigate();
  const [rooms, setRooms]       = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filter, setFilter]     = useState('all');
  const [selectedSlot, setSelectedSlot] = useState(null); // { room, info }
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
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  // Upcoming bookings: Pending or Confirmed, check-in from now onward, sorted soonest first
  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return bookings
      .filter(b => {
        if (['Cancelled', 'Completed', 'Checked In'].includes(b.status)) return false;
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

  // Summary counts (day + overnight combined)
  const counts = useMemo(() => {
    const c = { vacant: 0, occupied: 0, incoming: 0, pending: 0 };
    roomInfos.forEach(({ dayInfo, nightInfo }) => {
      c[dayInfo.status]   = (c[dayInfo.status]   || 0) + 1;
      c[nightInfo.status] = (c[nightInfo.status] || 0) + 1;
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
    { key: 'all',      label: 'All Rooms',  color: 'bg-slate-700 text-white'       },
    { key: 'vacant',   label: 'Vacant',     color: 'bg-emerald-500 text-white'     },
    { key: 'occupied', label: 'Occupied',   color: 'bg-rose-500 text-white'        },
    { key: 'incoming', label: 'Arriving',   color: 'bg-sky-500 text-white'         },
    { key: 'pending',  label: 'Pending',    color: 'bg-amber-400 text-slate-900'   },
  ];

  return (
    <Sidebar>
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
            onClose={() => setSelectedSlot(null)}
            onWalkIn={() => navigate('/frontdesk/walkin', { state: { preselectedRoom: selectedSlot.room } })}
          />
        )
      )}
      <main className="p-6 flex gap-6 min-h-0">

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

          {/* Summary bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Vacant',   count: counts.vacant,   bg: 'bg-emerald-500',                icon: 'fa-check-circle'   },
              { label: 'Occupied', count: counts.occupied,  bg: 'bg-rose-500',                  icon: 'fa-door-closed'    },
              { label: 'Arriving', count: counts.incoming,  bg: 'bg-sky-500',                   icon: 'fa-person-walking' },
              { label: 'Pending',  count: counts.pending,   bg: 'bg-amber-400 text-slate-900',  icon: 'fa-clock'          },
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
                onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border-2 ${
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
                            const items = slotItems.filter(({ room }) => getCat(room) === grp.key);
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
                                        onWalkIn={() => navigate('/frontdesk/walkin', { state: { preselectedRoom: item.room } })} />
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
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span> Pending — booking not yet confirmed</span>
              <span className="flex items-center gap-1.5"><span className="text-base">⚡</span> Soon — vacating within 30 minutes</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Upcoming Bookings panel ──────────────────────────────────── */}
        <div className="w-80 xl:w-96 shrink-0 flex flex-col">
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

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: 'calc(100vh - 180px)' }}>
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
              const overnight = isOvernightBooking(b);
              const name      = b.guest || b.guest_name || 'Guest';
              const isPending = b.status === 'Pending';

              return (
                <button
                  key={b.bookingId}
                  onClick={() => setSelectedSlot({ room: { name: b.roomType, id: b.roomId }, info: { booking: b, status: b.status === 'Pending' ? 'pending' : 'incoming' } })}
                  className={`w-full text-left rounded-xl border p-3 transition-all hover:shadow-md active:scale-[0.99] ${
                    isToday
                      ? 'border-sky-200 bg-sky-50 hover:bg-sky-100'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* Top row: status badge + booking type */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                      isPending
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-sky-100 text-sky-700'
                    }`}>
                      <i className={`fas ${isPending ? 'fa-clock' : 'fa-check-circle'} text-[9px]`}></i>
                      {b.status}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      overnight
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      <i className={`fas ${overnight ? 'fa-moon' : 'fa-sun'} text-[9px]`}></i>
                      {overnight ? 'Overnight' : 'Day Visit'}
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
    </Sidebar>
  );
}
