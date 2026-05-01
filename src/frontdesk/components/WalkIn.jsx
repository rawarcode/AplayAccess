import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// bookingsPath resolution lives inside the component so the back-button
// and success redirect land in the portal the page was mounted from
// (/admin/bookings when embedded, /frontdesk/bookings otherwise).
import { Helmet } from 'react-helmet-async';
import Sidebar from './Layout/Sidebar';
import { api } from '../../lib/api';
import { getFdRooms, createWalkInBooking, addonAvailabilityForSlot } from '../../lib/frontdeskApi';
import { validatePromo } from '../../lib/adminApi';
import Toast, { useToast } from '../../components/ui/Toast';
import Modal from '../../components/modals/Modal';
import { fmtMoney, localDateStr } from '../../lib/format';
import HourGridPicker from '../../components/ui/HourGridPicker.jsx';

// ─── helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => localDateStr();


// Addons are fetched from API — no hardcoded catalog

// Entrance fee fallback — live values come from /api/pricing on mount
// Legacy '24hr-pm' is kept here for rendering old bookings only — new walk-ins
// always use '24hr' with a staff-picked start hour.
const FALLBACK_RATES = { day: 50, night: 80, '24hr': 100, '24hr-pm': 100 };

// 12-hour label used in confirmation summary / receipts.
function formatHourLabel(h) {
  const suffix = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

const EMPTY_FORM = {
  fullName: '', phone: '', email: '',
  roomId: '', date: todayStr(),
  payMethod: 'Cash', notes: '',
  bookingType: 'day', // 'day' | 'night' | '24hr'
  checkInHour: 6,     // 0–23, used when bookingType === '24hr'
  guests: 1,
};

// ─── component ────────────────────────────────────────────────────────────────
// `embedded` prop: see Bookings.jsx for the rationale — when true,
// the front-desk Sidebar + top bar are skipped so an outer shell
// (AdminShell) can wrap the page body instead.
export default function WalkIn({ embedded = false }) {
  const Shell = embedded ? Fragment : Sidebar;
  const location = useLocation();
  const bookingsPath = location.pathname.startsWith('/admin') ? '/admin/bookings' : '/frontdesk/bookings';
  const navigate = useNavigate();
  const preselectedRoom = location.state?.preselectedRoom ?? null;

  // Wizard-only page: no table, no row actions — so none of the bookings,
  // sort, transfer, view-detail, or per-row status state lives here anymore.
  const [rooms, setRooms]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [formOpen, setFormOpen]           = useState(false);
  const [submitting,   setSubmitting]     = useState(false);
  const [confirmOpen,  setConfirmOpen]   = useState(false);
  const [error, setError]                 = useState('');
  const [formError, setFormError]         = useState('');
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [wiStep, setWiStep]               = useState(1);
  const [showWiNotes, setShowWiNotes]     = useState(false);
  const [toast, showToast, clearToast, toastType] = useToast();

  // Promo code
  const [addons,       setAddons]        = useState([]);   // from API
  const [addonQtys,    setAddonQtys]    = useState({});   // { [id]: qty }
  // Live per-window remaining counts. Keyed by addon id — {allocated, remaining,
  // max_qty, per_booking}. Empty map when slot inputs aren't yet valid; the UI
  // falls back to `a.max_qty` in that case, so the flow degrades gracefully.
  const [addonAvailability, setAddonAvailability] = useState({});

  const [promoInput,   setPromoInput]   = useState('');
  const [promoResult,  setPromoResult]  = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError,   setPromoError]   = useState('');

  // Live entrance-fee rates from /api/pricing (falls back to FALLBACK_RATES)
  const [entranceRates, setEntranceRates] = useState(FALLBACK_RATES);
  useEffect(() => {
    api.get('/api/pricing')
      .then(r => {
        const d = r.data?.data;
        if (d) setEntranceRates({
          day:       Number(d.entrance_fee_day   ?? 50),
          night:     Number(d.entrance_fee_night ?? 80),
          '24hr':    Number(d.entrance_fee_24hr  ?? 100),
          '24hr-pm': Number(d.entrance_fee_24hr  ?? 100),
        });
      })
      .catch(() => {});
  }, []);

  const today = todayStr();

  // Wizard needs rooms (picker), addons (amenities), pricing (fetched
  // separately below). It no longer needs the bookings list — availability
  // is checked via /api/availability, not client-side overlap scanning.
  function loadAll() {
    setLoading(true);
    Promise.all([getFdRooms(), api.get('/api/addons')])
      .then(([rm, adRes]) => {
        setRooms(rm);
        const fetchedAddons = adRes.data?.data ?? [];
        setAddons(fetchedAddons);
        setAddonQtys(Object.fromEntries(fetchedAddons.map(a => [a.id, 0])));
        setError('');
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); }, []);

  // This route is wizard-only: the modal auto-opens on mount. A ref guards
  // against the effect re-firing (e.g. when loadAll toggles `loading`).
  // The preselectedRoom handoff from Rooms board still works — we just
  // seed the form's roomId before opening.
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (loading || hasAutoOpenedRef.current) return;
    hasAutoOpenedRef.current = true;
    if (preselectedRoom) {
      setForm(f => ({ ...f, roomId: String(preselectedRoom.id) }));
      navigate(location.pathname, { replace: true, state: null });
    }
    setFormOpen(true);
    setWiStep(1);
    setShowWiNotes(false);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close handlers return to the consolidated Bookings page, since this
  // route carries no content of its own beyond the wizard modal.
  const closeWizard = () => navigate(bookingsPath);

  // Room availability — same check as BookingModal
  const [availability,  setAvailability]  = useState(null);
  const [availChecking, setAvailChecking] = useState(false);

  useEffect(() => {
    if (!form.date) { setAvailability(null); return; }
    const params = new URLSearchParams({
      date:         form.date,
      booking_type: form.bookingType,
    });
    setAvailChecking(true);
    api.get(`/api/availability?${params}`)
      .then(r => {
        // Key by id — room names aren't unique in the admin controller,
        // so two rooms sharing a name would otherwise collapse into one
        // availability slot and hide / mis-allow the wrong record.
        const map = {};
        (r.data?.data ?? []).forEach(rm => { map[String(rm.id)] = rm.available; });
        setAvailability(map);
      })
      .catch(() => setAvailability(null))
      .finally(() => setAvailChecking(false));
  }, [form.date, form.bookingType]);


  // Time-slot guard: disable booking types whose window already passed today
  const isToday     = form.date === today;
  const currentHour = new Date().getHours();
  const dayPassed   = isToday && currentHour >= 18;   // Day (6AM–6PM) window closed

  // Auto-switch away from Day if its window passed
  useEffect(() => {
    if (dayPassed && form.bookingType === 'day') setField('bookingType', 'night');
  }, [dayPassed]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); }

  // Auto-switch to first allowed type when a restricted room is selected
  useEffect(() => {
    const room = rooms.find(r => String(r.id) === String(form.roomId));
    const allowed = room?.allowed_booking_types ?? null;
    if (!allowed) return;
    if (!allowed.includes(form.bookingType)) setField('bookingType', allowed[0]);
  }, [form.roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pricing preview — room rate only; entrance fees collected at check-in by frontdesk
  const selectedRoom  = rooms.find(r => String(r.id) === String(form.roomId));
  const allowedTypes  = selectedRoom?.allowed_booking_types ?? null;
  const typeAllowed   = (type) => !allowedTypes || allowedTypes.includes(type);
  const dayRate       = Number(selectedRoom?.day_rate       ?? 1500);
  const nightRate     = Number(selectedRoom?.overnight_rate ?? 1500);
  const rate24        = Number(selectedRoom?.rate_24hr      ?? 2000);
  const is24hr        = form.bookingType === '24hr';
  const baseRate      = form.bookingType === 'night' ? nightRate : is24hr ? rate24 : dayRate;

  // Set of addon IDs that are attached to SOME room (as either package
  // or optional). Catalog addons not in this set are resort-wide shared
  // pool and show for every room. Attached ones only show for the room
  // they're attached to, and only as optional (package auto-attaches
  // server-side; there's no "pick" for them here).
  const roomScopedAddonIds = useMemo(() => {
    const ids = new Set();
    for (const r of rooms) {
      for (const a of (r.attached_addons ?? [])) ids.add(a.id);
    }
    return ids;
  }, [rooms]);

  // The picker's working list. Returns two kinds of rows, each
  // tagged with a `relation` so the picker can render a "For this
  // room" badge on room-attached ones:
  //   - relation='shared'   → catalog addons not tied to any room
  //                            (pillows, towel, parking, common table)
  //   - relation='optional' → attached to THIS room as optional,
  //                            priced via the per-room pivot override
  // Package attachments anywhere + optional attachments for other
  // rooms are hidden — packages auto-attach server-side, other-room
  // optionals don't apply here.
  //
  // Optional rows sort FIRST so staff see the room-specific items
  // before the generic shared-pool list — matches the "these apply
  // only to this room, don't miss them" mental model.
  const visibleAddons = useMemo(() => {
    const selectedRoomOptionals = new Map(
      (selectedRoom?.attached_addons ?? [])
        .filter(a => a.relation === 'optional')
        .map(a => [a.id, a])
    );
    const rows = addons.flatMap(a => {
      if (!roomScopedAddonIds.has(a.id)) {
        return [{ ...a, relation: 'shared' }];
      }
      const opt = selectedRoomOptionals.get(a.id);
      if (!opt) return [];
      return [{ ...a, relation: 'optional', price: Number(opt.price) }];
    });
    // Stable sort: optionals first, shared after. Preserves original
    // order within each group.
    return rows.sort((a, b) => {
      if (a.relation === b.relation) return 0;
      return a.relation === 'optional' ? -1 : 1;
    });
  }, [addons, roomScopedAddonIds, selectedRoom]);

  // Clear qtys for any addon that disappeared from the visible list
  // after switching rooms (e.g. staged Patrice videoke qty=1 then
  // swapped to Cassey → Cassey has no videoke attachment → would
  // otherwise silently submit a qty that the new room can't offer).
  useEffect(() => {
    const visibleIds = new Set(visibleAddons.map(a => a.id));
    setAddonQtys(prev => {
      let touched = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (Number(next[id]) > 0 && !visibleIds.has(Number(id))) {
          next[id] = 0;
          touched = true;
        }
      }
      return touched ? next : prev;
    });
  }, [visibleAddons]);

  // Disable already-past hours when the walk-in is for today. Walk-ins have
  // no lead-time rule, so the current hour itself stays selectable (the
  // guest is at the counter *now*).
  const isTodaySelected = form.date === today;
  const minHourToday    = isTodaySelected ? new Date().getHours() : 0;

  // Keep the selected start-hour valid when the date or booking type
  // changes — if it's now below the floor, bump it up.
  useEffect(() => {
    if (!isTodaySelected) return;
    if ((form.checkInHour ?? 6) < minHourToday) {
      setForm(prev => ({ ...prev, checkInHour: minHourToday }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, form.bookingType]);

  // Fetch per-window add-on availability whenever the slot inputs change.
  // Mirrors the shared inventory check that the backend walk-in endpoint runs
  // at submit, so staff see "sold out" before they pick a qty that will fail.
  useEffect(() => {
    if (!form.date || addons.length === 0) { setAddonAvailability({}); return; }
    let cancelled = false;
    const hour = form.bookingType === '24hr' ? (form.checkInHour ?? 6) : null;
    addonAvailabilityForSlot({ date: form.date, bookingType: form.bookingType, hour })
      .then(r => {
        if (cancelled) return;
        const map = {};
        for (const row of (r?.data ?? [])) map[row.id] = row;
        setAddonAvailability(map);
        // If a staged qty now exceeds live remaining, clamp it so the submit
        // doesn't 422. Happens when staff changes date/type after staging.
        setAddonQtys(prev => {
          let touched = false;
          const next = { ...prev };
          for (const row of (r?.data ?? [])) {
            const cur = Number(next[row.id] || 0);
            if (cur > row.remaining) { next[row.id] = row.remaining; touched = true; }
          }
          return touched ? next : prev;
        });
      })
      .catch(() => { if (!cancelled) setAddonAvailability({}); });
    return () => { cancelled = true; };
  }, [form.date, form.bookingType, form.checkInHour, addons.length]);

  // Use visibleAddons so the per-room price override (Patrice videoke
  // vs catalog videoke) feeds the summary + totals correctly.
  const amenityTotal = visibleAddons.reduce((sum, a) => {
    const qty = Number(addonQtys[a.id] || 0);
    if (qty <= 0) return sum;
    return sum + (a.per_booking ? a.price : a.price * qty);
  }, 0);
  const previewSubtotal = baseRate + amenityTotal;
  const promoDiscount   = promoResult?.discount_amount ?? 0;
  const previewTotal    = Math.max(previewSubtotal - promoDiscount, 0);
  const entranceFeeRate = entranceRates[form.bookingType] ?? 50;
  const entranceFeeTotal = Number(form.guests || 1) * entranceFeeRate;

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoResult(null);
    try {
      const res = await validatePromo(code, previewSubtotal);
      const d   = res.data;
      if (d.valid) {
        setPromoResult(d);
      } else {
        setPromoError(d.message || 'Invalid promo code.');
      }
    } catch {
      setPromoError('Could not validate promo code.');
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setPromoResult(null);
    setPromoInput('');
    setPromoError('');
  }

  // Step 2 — validate → show confirmation
  function handleCreate() {
    setFormError('');
    if (!form.fullName.trim()) {
      setFormError('Guest name is required.'); return;
    }
    if (!form.phone.trim()) { setFormError('Phone number is required.'); return; }
    if (allowedTypes && !allowedTypes.includes(form.bookingType)) {
      setFormError(`This room only supports: ${allowedTypes.join(', ')}.`); return;
    }
    if (!form.roomId) { setFormError('Please select a room.'); return; }
    if (is24hr && isTodaySelected && Number(form.checkInHour ?? 6) < minHourToday) {
      setFormError('That start time is already past. Pick a later hour today or a future date.'); return;
    }
    const selRoom = rooms.find(r => String(r.id) === String(form.roomId));
    if (availability !== null && (!selRoom || availability[String(selRoom.id)] !== true)) {
      setFormError('This room is not available for the selected date and booking type.'); return;
    }
    setShortStayAck(false);
    setConfirmOpen(true);
  }

  // Step 2 — confirmed → call API
  async function handleConfirmCreate() {
    setConfirmOpen(false);
    // Pick a reasonable HH:MM:SS for the datetime; the backend overrides with
    // the canonical window anyway (and uses check_in_hour for 24hr bookings).
    const checkInTime = form.bookingType === 'night'
      ? '18:00:00'
      : form.bookingType === '24hr'
        ? `${String(form.checkInHour ?? 6).padStart(2, '0')}:00:00`
        : '06:00:00';
    const checkIn     = `${form.date} ${checkInTime}`;
    const guestName   = form.fullName.trim();
    // Only submit amenities that are currently visible for the
    // selected room — prevents stale qtys from a previously picked
    // room leaking through when the staff switches mid-flow.
    const amenities   = visibleAddons
      .filter(a => Number(addonQtys[a.id] || 0) > 0)
      .map(a => ({ name: a.name, qty: Number(addonQtys[a.id]) }));

    setSubmitting(true);
    try {
      await createWalkInBooking({
        guest_name:        guestName,
        guest_phone:       form.phone.trim(),
        guest_email:       form.email.trim() || undefined,
        room_id:           Number(form.roomId),
        check_in:          checkIn,
        check_in_hour:     form.bookingType === '24hr' ? Number(form.checkInHour ?? 6) : undefined,
        guests:            Number(form.guests || 1),
        payment_method:    form.payMethod.toLowerCase(),
        special_requests:  form.notes.trim() || undefined,
        booking_type:      form.bookingType,
        amenities,
        promo_code:        promoResult ? promoInput.trim().toUpperCase() : null,
        discount:          promoDiscount,
      });
      setFormOpen(false);
      setForm({ ...EMPTY_FORM, date: form.date });
      setAddonQtys(Object.fromEntries(addons.map(a => [a.id, 0])));
      setPromoInput(''); setPromoResult(null); setPromoError('');
      // Success: return to the consolidated Bookings view. Skip loadAll —
      // the Bookings page fetches its own data on mount.
      showToast('Walk-in booking created.', 'success');
      navigate(bookingsPath);
      return;
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
        'Failed to create booking. The room may already be booked for this time slot.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Confirm-step ack for short stays (wizard UI). No row-action handlers
  // here anymore — those moved to the Bookings page.
  const [shortStayAck, setShortStayAck] = useState(false);

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <Helmet><title>Walk-in — Frontdesk</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Cancel / Transfer row-action modals removed — those flows live on
          the consolidated Bookings page now. */}

      {/* ── Walk-in Confirmation Modal ── */}
      {confirmOpen && (() => {
        const selRoom    = rooms.find(r => String(r.id) === String(form.roomId));
        const guestName  = form.fullName.trim();
        const pickedHour    = Number(form.checkInHour ?? 6);
        const pickedHourLbl = formatHourLabel(pickedHour);
        const checkInLabel  = form.bookingType === 'night' ? '6:00 PM'
                            : form.bookingType === '24hr'  ? pickedHourLbl
                            : '6:00 AM';
        const checkOutLabel = form.bookingType === 'night' ? '7:00 AM (next day)'
                            : form.bookingType === '24hr'  ? `${pickedHourLbl} (next day)`
                            : '6:00 PM';
        const dateLabel  = form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('en-PH', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) : '—';
        const typeLabel  = form.bookingType === 'night' ? 'Night Stay'
                         : form.bookingType === '24hr'  ? `24 Hours (${pickedHourLbl})`
                         : 'Day Visit';

        // Calculate remaining hours in slot if booking is for today
        let remainingHrs = null;
        if (form.date === today) {
          const now = new Date();
          const h = now.getHours() + now.getMinutes() / 60;
          if (form.bookingType === 'day')        remainingHrs = 18 - h;        // ends 6PM
          else if (form.bookingType === 'night')  remainingHrs = (h >= 18 ? (24 - h) + 7 : 7 - h);  // ends 7AM
          else if (form.bookingType === '24hr')   remainingHrs = 24; // 24 hours from staff-picked start
        }
        const shortStay = remainingHrs !== null && remainingHrs > 0 && remainingHrs < 4;

        return (
          <Modal open onClose={() => setConfirmOpen(false)} maxWidth="max-w-lg" label="Confirm walk-in booking">
            <div className="overflow-hidden">

              {/* Header */}
              <div className="bg-sky-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  <i className="fas fa-clipboard-check text-xl"></i>
                  <div>
                    <h3 className="font-bold text-lg">Walk-in Booking Summary</h3>
                    <p className="text-sky-200 text-xs">Review all details before confirming</p>
                  </div>
                </div>
                <button onClick={() => setConfirmOpen(false)} type="button" className="w-11 h-11 inline-flex items-center justify-center rounded-md text-white/80 hover:text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70" aria-label="Close">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                {/* Booking type badge */}
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  form.bookingType === 'night'   ? 'bg-indigo-100 text-indigo-800' :
                  is24hr                         ? 'bg-purple-100 text-purple-800' :
                                                   'bg-sky-100 text-sky-800'
                }`}>
                  <i className={`fas ${form.bookingType === 'night' ? 'fa-moon' : is24hr ? 'fa-clock' : 'fa-sun'}`}></i>
                  {typeLabel}
                </span>

                {/* Guest & Booking Details */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Guest</div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-4 py-2.5 text-slate-500 font-medium w-32">Name</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{guestName}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-slate-500 font-medium">Phone</td>
                        <td className="px-4 py-2.5 text-slate-900">{form.phone}</td>
                      </tr>
                      {form.email && (
                        <tr>
                          <td className="px-4 py-2.5 text-slate-500 font-medium">Email</td>
                          <td className="px-4 py-2.5 text-slate-900">{form.email}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Booking</div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-4 py-2.5 text-slate-500 font-medium w-32">Room</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{selRoom?.name || '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-slate-500 font-medium">Date</td>
                        <td className="px-4 py-2.5 text-slate-900">{dateLabel}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-slate-500 font-medium">Check-in</td>
                        <td className="px-4 py-2.5 text-slate-900">{checkInLabel}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-slate-500 font-medium">Check-out</td>
                        <td className="px-4 py-2.5 text-slate-900">{checkOutLabel}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-slate-500 font-medium">Guests</td>
                        <td className="px-4 py-2.5 text-slate-900">{form.guests} pax</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-slate-500 font-medium">Payment</td>
                        <td className="px-4 py-2.5 text-slate-900">{form.payMethod}</td>
                      </tr>
                      {form.notes && (
                        <tr>
                          <td className="px-4 py-2.5 text-slate-500 font-medium align-top">Notes</td>
                          <td className="px-4 py-2.5 text-slate-700 italic">"{form.notes}"</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {visibleAddons.some(a => Number(addonQtys[a.id] || 0) > 0) && (
                    <>
                      <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Add-ons</div>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-100">
                          {visibleAddons.filter(a => Number(addonQtys[a.id] || 0) > 0).map(a => {
                            const qty = Number(addonQtys[a.id]);
                            const subtotal = a.per_booking ? a.price : a.price * qty;
                            return (
                              <tr key={a.id}>
                                <td className="px-4 py-2.5 text-slate-500 font-medium w-32">{a.name}</td>
                                <td className="px-4 py-2.5 text-slate-900">
                                  {a.per_booking ? fmtMoney(subtotal) : `× ${qty} — ${fmtMoney(subtotal)}`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>

                {/* Pricing Breakdown */}
                <div className={`rounded-xl border p-4 space-y-2 text-sm ${
                  form.bookingType === 'night' ? 'bg-indigo-50 border-indigo-200' :
                  is24hr                       ? 'bg-purple-50 border-purple-200' :
                                                 'bg-sky-50 border-sky-200'
                }`}>
                  <p className={`font-semibold mb-1 ${
                    form.bookingType === 'night' ? 'text-indigo-900' :
                    is24hr                       ? 'text-purple-900' : 'text-sky-900'
                  }`}>Payment Breakdown</p>
                  <div className="flex justify-between text-slate-700">
                    <span>Room rate ({typeLabel})</span>
                    <span>{fmtMoney(baseRate)}</span>
                  </div>
                  {amenityTotal > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Add-ons</span>
                      <span>{fmtMoney(amenityTotal)}</span>
                    </div>
                  )}
                  {promoDiscount > 0 ? (
                    <>
                      <div className="flex justify-between text-slate-400 border-t border-slate-200 pt-2">
                        <span>Subtotal</span>
                        <span className="line-through">{fmtMoney(previewSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span><i className="fas fa-tag mr-1 text-xs"></i>Promo ({promoInput.toUpperCase()})</span>
                        <span>− {fmtMoney(promoDiscount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="border-t border-slate-200 pt-1"></div>
                  )}
                  <div className={`flex justify-between font-bold text-base border-t pt-2 ${
                    form.bookingType === 'night' ? 'text-indigo-900 border-indigo-200' :
                    is24hr                       ? 'text-purple-900 border-purple-200' :
                                                   'text-sky-900 border-sky-200'
                  }`}>
                    <span>Booking Total</span>
                    <span>{fmtMoney(previewTotal)}</span>
                  </div>
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex justify-between text-amber-800 font-semibold text-sm">
                      <span className="flex items-center gap-1.5">
                        <i className="fas fa-ticket-alt text-amber-600"></i>
                        Entrance Fee
                        <span className="text-amber-600 font-normal text-xs">({form.guests} pax × ₱{entranceFeeRate})</span>
                      </span>
                      <span>{fmtMoney(entranceFeeTotal)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t-2 border-slate-300 pt-3 mt-3 text-slate-900">
                    <span>Total to Collect</span>
                    <span>{fmtMoney(previewTotal + entranceFeeTotal)}</span>
                  </div>
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <i className="fas fa-info-circle"></i>
                    Entrance fee collected separately at the gate.
                  </p>
                </div>
              </div>

              {/* Short-stay warning */}
              {shortStay && (
                <div className="mx-6 mb-2 p-3 bg-amber-50 border border-amber-300 rounded-xl">
                  <div className="flex items-start gap-2">
                    <i className="fas fa-exclamation-triangle text-amber-600 mt-0.5"></i>
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Less than {Math.ceil(remainingHrs)} {Math.ceil(remainingHrs) === 1 ? 'hour' : 'hours'} remaining in this time slot
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        The guest will have limited time. Full room rate still applies.
                      </p>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input type="checkbox" checked={shortStayAck} onChange={e => setShortStayAck(e.target.checked)}
                          className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
                        <span className="text-xs font-medium text-amber-800">I've informed the guest about the remaining time</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                <button onClick={() => setConfirmOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <i className="fas fa-arrow-left mr-2"></i>Back
                </button>
                <button onClick={handleConfirmCreate} disabled={submitting || (shortStay && !shortStayAck)}
                  className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                  {submitting
                    ? <><i className="fas fa-spinner fa-spin"></i> Creating...</>
                    : <><i className="fas fa-check"></i> Confirm Booking</>}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Detail modal removed — guests are viewed from the Bookings page. */}

      {/* ── New Walk-in Modal ── */}
      {formOpen && (
        <Modal open onClose={() => { setFormOpen(false); setFormError(''); }} maxWidth="max-w-xl" label="New walk-in booking">
          <div className="max-h-[90vh] overflow-hidden flex flex-col">

            {/* Header */}
            <div className="bg-brand px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 text-white">
                <i className="fas fa-person-walking-luggage text-xl"></i>
                <div>
                  <h3 className="font-bold text-lg">New Walk-in Booking</h3>
                  <p className="text-sky-200 text-xs">Fill in guest and booking details</p>
                </div>
              </div>
              <button onClick={() => { setFormOpen(false); setFormError(''); closeWizard(); }} type="button" className="w-11 h-11 inline-flex items-center justify-center rounded-md text-white/80 hover:text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div id="walkin-scroll" className="overflow-y-auto flex-1 p-6">
              {formError && (
                <div role="alert" aria-live="assertive" className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
                  <i className="fas fa-exclamation-circle" aria-hidden="true"></i>{formError}
                </div>
              )}

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-5">
                {[{ num: 1, label: 'Details' }, { num: 2, label: 'Extras & Summary' }].map((s, i) => (
                  <React.Fragment key={s.num}>
                    {i > 0 && <div className={`flex-1 h-px ${wiStep >= s.num ? 'bg-sky-400' : 'bg-slate-200'}`} />}
                    <button type="button" onClick={() => s.num < wiStep && setWiStep(s.num)}
                      className={`flex items-center gap-1.5 text-sm font-medium ${
                        wiStep === s.num ? 'text-sky-700' : wiStep > s.num ? 'text-sky-500 cursor-pointer' : 'text-slate-400'
                      }`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        wiStep >= s.num ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>{wiStep > s.num ? '✓' : s.num}</span>
                      {s.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div id="walkin-form">

                {/* ═══ STEP 1 — Guest & Booking Details ═══ */}
                {wiStep === 1 && (<>
                {/* Guest info */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Guest Information</span>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <div className="col-span-2">
                    <label htmlFor="wi-fullname" className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                    <input id="wi-fullname" type="text" value={form.fullName}
                      onChange={e => setField('fullName', e.target.value)}
                      placeholder="e.g. Juan dela Cruz Jr."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" required />
                  </div>
                  <div>
                    <label htmlFor="wi-phone" className="block text-xs font-medium text-slate-700 mb-1">Phone *</label>
                    <input id="wi-phone" type="tel" value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" placeholder="+639XXXXXXXXX" required />
                  </div>
                  <div>
                    <label htmlFor="wi-email" className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                    <input id="wi-email" type="email" value={form.email}
                      onChange={e => setField('email', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                  </div>
                </div>

                {/* Booking details */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Booking Details</span>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">

                  {/* Date — must be chosen first */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Date *</label>
                    <input type="date" value={form.date} min={today}
                      onChange={e => setField('date', e.target.value)}
                      aria-label="Booking date"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" required />
                  </div>

                  {/* Booking type — compact pills. Walk-in form defaults
                      date to today so the empty-date case is rare, but if
                      staff blanks the date input out, lock the pills out
                      the same way BookingModal does. dayPassed + typeAllowed
                      both read form.date, so their enable-state is
                      meaningless without a date. */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-2" id="walkin-booking-type-label">
                      Booking Type *
                      {!form.date && (
                        <span className="ml-2 text-slate-400 font-normal">Pick a date first</span>
                      )}
                    </label>
                    <div className="flex gap-2" role="group" aria-labelledby="walkin-booking-type-label">
                      {[
                        { type: 'day',   icon: 'fa-sun',   label: 'Day',   disabled: !form.date || dayPassed || !typeAllowed('day') },
                        { type: 'night', icon: 'fa-moon',  label: 'Night', disabled: !form.date || !typeAllowed('night') },
                        { type: '24hr',  icon: 'fa-clock', label: '24 Hrs', disabled: !form.date || !typeAllowed('24hr') },
                      ].map(opt => {
                        const active = opt.type === '24hr' ? is24hr : form.bookingType === opt.type;
                        return (
                          <button key={opt.type} type="button"
                            disabled={opt.disabled}
                            aria-pressed={active}
                            onClick={() => { if (!opt.disabled) setField('bookingType', opt.type); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-3 md:py-2 border-2 rounded-lg text-sm font-medium transition-colors ${
                              opt.disabled
                                ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                                : active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <i className={`fas ${opt.icon} text-xs ${active && !opt.disabled ? 'text-sky-500' : 'text-slate-400'}`} aria-hidden="true"></i>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {form.roomId && (
                      <p className="mt-1 text-xs text-slate-500 text-center">
                        {fmtMoney(form.bookingType === 'night' ? nightRate : is24hr ? rate24 : dayRate)} / {form.bookingType === 'night' ? 'night' : is24hr ? '24 hrs' : 'day'}
                      </p>
                    )}

                    {/* 24hr: pick any on-the-hour start time (walk-ins have no lead rule) */}
                    {is24hr && (
                      <div className="mt-3">
                        <p id="walkin-checkin-hour-label" className="block text-xs font-medium text-slate-600 mb-2">
                          Start time *
                        </p>
                        <HourGridPicker
                          value={form.checkInHour ?? 6}
                          onChange={(h) => setField('checkInHour', h)}
                          accent="sky"
                          labelId="walkin-checkin-hour-label"
                          minHour={minHourToday}
                        />
                      </div>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Room *
                      {!form.date ? (
                        <span className="ml-1 text-slate-400 font-normal">Pick a date first</span>
                      ) : availChecking && (
                        <span className="ml-1 text-slate-400 font-normal">Checking availability...</span>
                      )}
                    </label>
                    <select value={form.roomId} onChange={e => setField('roomId', e.target.value)}
                      aria-label="Room selection"
                      disabled={!form.date}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" required>
                      <option value="">Select room / cottage / pavilion
                      </option>
                      {(() => {
                        const visible = rooms.filter(r => availability === null || availability?.[String(r.id)] === true);
                        // Name-based fallback matches owner/Rooms.jsx so
                        // rooms without an explicit category column still
                        // land in the right optgroup. Adding 'tent' here
                        // fixes a pre-existing bug where tent rooms fell
                        // through to 'room' and made the Tent Pitching
                        // optgroup render empty (which then got hidden
                        // entirely by the !items.length guard below).
                        //
                        // 'admission' — backing the "Entrance Only"
                        // pseudo-room. Matches on both category and
                        // name-substring so even a DB without the
                        // category column drifts into the right group.
                        const getCat  = r => r.category || (
                          r.name.toLowerCase().includes('cottage')   ? 'cottage'   :
                          r.name.toLowerCase().includes('pavilion')  ? 'pavilion'  :
                          r.name.toLowerCase().includes('tent')      ? 'tent'      :
                          r.name.toLowerCase().includes('entrance')  ? 'admission' :
                          'room'
                        );
                        // Price shown matches the booking type the user
                        // picked on the previous step. Fallback matches
                        // the defaults computed at line 175-177.
                        const rateFor = (r) => {
                          if (form.bookingType === 'night')  return Number(r.overnight_rate ?? 1500);
                          if (form.bookingType === '24hr')   return Number(r.rate_24hr      ?? 2000);
                          return Number(r.day_rate ?? 1500); // 'day'
                        };
                        // Emoji prefixes live HERE — and only here —
                        // because <optgroup>/<option> in a native <select>
                        // cannot render Font Awesome glyphs or any HTML.
                        // The FA icons used on the /frontdesk/rooms
                        // category headers work there because those are
                        // real <h2> elements. Inside a native select,
                        // emoji Unicode is the only category-icon option.
                        // Category headers are structural, not decorative
                        // chrome — so this is an intentional exception to
                        // the broader "no emoji in labels" rule.
                        const groups  = [
                          // 'admission' first — it's the shortest path
                          // through the form for walk-in day-trippers
                          // who just want gate entry + maybe add-ons.
                          // Rate column shows ₱0 because only entrance
                          // fee + add-ons charge, not a room rate.
                          { key: 'admission', label: '🎫  Entrance Only'  },
                          { key: 'room',      label: '🛏️  Rooms'         },
                          { key: 'cottage',   label: '⛱️  Cottages'      },
                          { key: 'pavilion',  label: '🏛️  Pavilions'     },
                          { key: 'tent',      label: '⛺  Tent Pitching' },
                        ];
                        return groups.map(g => {
                          const items = visible.filter(r => getCat(r) === g.key);
                          if (!items.length) return null;
                          return (
                            <optgroup key={g.key} label={g.label}>
                              {items.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.name} — ₱{rateFor(r).toLocaleString('en-PH')}{r.capacity_label ? ` · ${r.capacity_label}` : ''}
                                </option>
                              ))}
                            </optgroup>
                          );
                        });
                      })()}
                    </select>
                    {(() => {
                      const sel = rooms.find(r => String(r.id) === String(form.roomId));
                      const avail = sel ? availability?.[String(sel.id)] : undefined;
                      if (avail === false) return (
                        <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                          <i className="fas fa-times-circle"></i>
                          This room is not available for the selected date.
                        </p>
                      );
                      if (avail === true) return (
                        <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                          <i className="fas fa-check-circle"></i>
                          Room is available.
                        </p>
                      );
                      return null;
                    })()}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      No. of Guests *
                      <span className="ml-1 text-slate-400 font-normal">(for entrance fee)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => setField('guests', Math.max(1, Number(form.guests) - 1))}
                        className="w-11 h-11 border border-slate-200 rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-100">−</button>
                      <input type="number" min="1" max="200" value={form.guests}
                        onChange={e => setField('guests', Math.max(1, Number(e.target.value) || 1))}
                        aria-label="Number of guests"
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-400" />
                      <button type="button"
                        onClick={() => setField('guests', Number(form.guests) + 1)}
                        className="w-11 h-11 border border-slate-200 rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-100">+</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method *</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'Cash',  icon: 'fa-money-bill-wave', color: 'text-emerald-600' },
                        { value: 'GCash', icon: 'fa-mobile-alt',      color: 'text-sky-500'  },
                          ].map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setField('payMethod', opt.value)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 border-2 rounded-lg text-xs font-medium transition-colors ${
                            form.payMethod === opt.value
                              ? 'border-sky-500 bg-sky-50 text-sky-700'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <i className={`fas ${opt.icon} text-xs ${form.payMethod === opt.value ? '' : opt.color}`}></i>
                          {opt.value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                </>)}

                {/* ═══ STEP 2 — Extras & Summary ═══ */}
                {wiStep === 2 && (<>

                {/* Check-in / Check-out display */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Check-in / Check-out</label>
                  <div className={`border border-slate-200 rounded-xl px-3 py-2 w-full text-sm font-medium flex items-center gap-2 ${
                    form.bookingType === 'night'   ? 'bg-indigo-50 text-indigo-700' :
                    is24hr                         ? 'bg-purple-50 text-purple-700' :
                                                     'bg-sky-50 text-sky-700'
                  }`}>
                    <i className={`fas ${form.bookingType === 'night' ? 'fa-moon' : is24hr ? 'fa-clock' : 'fa-sun'}`}></i>
                    {(() => {
                      if (form.bookingType === 'night') return '6:00 PM → 7:00 AM (next day)';
                      if (form.bookingType === '24hr') {
                        const lbl = formatHourLabel(Number(form.checkInHour ?? 6));
                        return `${lbl} → ${lbl} (next day)`;
                      }
                      return '6:00 AM → 6:00 PM';
                    })()}
                  </div>
                </div>

                {/* Notes */}
                {showWiNotes ? (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                    <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)}
                      aria-label="Special requests"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      placeholder="Special requests, remarks..." />
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowWiNotes(true)} className="text-xs text-sky-600 hover:underline mb-4">
                    <i className="fas fa-plus mr-1"></i>Add notes / special requests
                  </button>
                )}

                {/* Amenities — fetched from API */}
                {visibleAddons.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-slate-200"></div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Add-on Amenities</span>
                      <div className="h-px flex-1 bg-slate-200"></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {visibleAddons.map(a => {
                        const qty       = Number(addonQtys[a.id] || 0);
                        const isFixed   = a.per_booking;
                        const active    = qty > 0;
                        const avail     = addonAvailability[a.id];
                        const remaining = avail?.remaining;
                        // Cap by both backend inventory (`remaining` across overlapping
                        // bookings) and catalog `max_qty`. If availability hasn't loaded
                        // yet, fall back to max_qty so the UI still works.
                        const cap       = remaining != null ? Math.min(remaining, a.max_qty) : a.max_qty;
                        const soldOut   = remaining === 0 && !active;
                        const atCap     = qty >= cap;
                        // Room-fixture rows get amber ring + bg tint + a
                        // bigger badge so they visually lead the picker.
                        // Staff scan top-to-bottom and see "this is for
                        // THIS room, don't miss it" before diving into the
                        // shared-pool list below.
                        const isOptional = a.relation === 'optional';
                        const roomTag = isOptional ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-white text-[10px] font-bold uppercase tracking-wide shadow-sm">
                            <i className="fas fa-link text-[9px]"></i>For {selectedRoom?.name}
                          </span>
                        ) : null;
                        // Baseline classes + amber accent layered on for
                        // optionals. Active/soldOut states still override.
                        const optionalAccent = isOptional
                          ? 'ring-2 ring-amber-300 bg-amber-50/60'
                          : '';
                        if (isFixed) {
                          return (
                            <button key={a.id} type="button"
                              disabled={soldOut}
                              onClick={() => !soldOut && setAddonQtys(q => ({ ...q, [a.id]: active ? 0 : 1 }))}
                              title={soldOut ? 'All units reserved for this window.' : undefined}
                              className={`border rounded-lg p-3 text-left transition-colors ${
                                soldOut
                                  ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                  : active
                                    ? 'border-indigo-400 bg-indigo-50'
                                    : `border-slate-200 hover:border-slate-300 ${optionalAccent}`
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <i className={`fas ${a.icon || 'fa-tag'} ${active ? 'text-indigo-600' : isOptional ? 'text-amber-600' : 'text-slate-400'}`}></i>
                                <p className={`text-sm font-medium ${active ? 'text-indigo-700' : soldOut ? 'text-slate-400' : 'text-slate-700'}`}>{a.name}</p>
                                {roomTag}
                              </div>
                              <p className="text-xs text-slate-500">₱{Number(a.price).toLocaleString()} flat</p>
                              {soldOut ? (
                                <p className="text-xs font-medium text-rose-500 mt-1">Sold out for this window</p>
                              ) : remaining != null ? (
                                <p className="text-[11px] text-slate-500 mt-1">{Math.max(0, remaining - (active ? 1 : 0))} of {a.max_qty} left in pool</p>
                              ) : null}
                              {active && <p className="text-xs font-medium text-indigo-700 mt-1">Added ✓</p>}
                            </button>
                          );
                        }
                        return (
                          <div key={a.id} className={`border rounded-lg p-3 ${
                            soldOut ? 'bg-slate-50 border-slate-200' : optionalAccent || ''
                          }`}>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <i className={`fas ${a.icon || 'fa-tag'} ${isOptional ? 'text-amber-600' : 'text-slate-500'}`}></i>
                              <p className={`text-sm font-medium ${soldOut ? 'text-slate-400' : 'text-slate-700'}`}>{a.name}</p>
                              {roomTag}
                              <span className="ml-auto text-xs text-slate-500">₱{Number(a.price).toLocaleString()} each</span>
                            </div>
                            {soldOut ? (
                              <p className="text-xs font-medium text-rose-500 mb-1">Sold out for this window</p>
                            ) : remaining != null ? (
                              // Live pool free, decrementing as staff clicks +/−.
                              // `remaining` is pool minus existing bookings; staff's
                              // staged qty shrinks that further for the preview.
                              <p className="text-[11px] text-slate-500 mb-1">{Math.max(0, remaining - qty)} of {a.max_qty} left in pool</p>
                            ) : null}
                            <div className="flex items-center gap-2">
                              <button type="button"
                                disabled={qty === 0}
                                onClick={() => setAddonQtys(q => ({ ...q, [a.id]: Math.max(0, qty - 1) }))}
                                className="w-11 h-11 rounded border text-slate-600 hover:bg-slate-100 text-sm font-bold disabled:opacity-40">−</button>
                              <span className="w-8 text-center text-sm font-medium">{qty}</span>
                              <button type="button"
                                disabled={atCap}
                                onClick={() => setAddonQtys(q => ({ ...q, [a.id]: Math.min(cap, qty + 1) }))}
                                title={atCap && remaining != null ? `Only ${remaining} left for this window.` : undefined}
                                className="w-11 h-11 rounded border text-slate-600 hover:bg-slate-100 text-sm font-bold disabled:opacity-40">+</button>
                              {qty > 0 && (
                                <span className="ml-auto text-xs font-medium text-sky-700">₱{(qty * a.price).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Promo code */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <i className="fas fa-tag mr-1 text-sky-500"></i>Promo Code <span className="text-slate-400 font-normal text-xs">(optional)</span>
                  </label>
                  {promoResult ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-md">
                      <i className="fas fa-check-circle text-emerald-600"></i>
                      <span className="text-sm text-emerald-800 font-medium flex-1">{promoResult.message}</span>
                      <button type="button" onClick={removePromo} className="text-xs text-slate-500 hover:text-rose-600 underline">Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyPromo())}
                        placeholder="Enter promo code"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-sky-500"
                      />
                      <button type="button" onClick={applyPromo} disabled={!promoInput.trim() || promoLoading}
                        className="px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
                        {promoLoading ? <i className="fas fa-spinner fa-spin"></i> : 'Apply'}
                      </button>
                    </div>
                  )}
                  {promoError && <p className="mt-1 text-xs text-rose-600"><i className="fas fa-times-circle mr-1"></i>{promoError}</p>}
                </div>

                {/* Pricing preview */}
                {(() => {
                  const typeColors = {
                    day:    { bg: 'bg-sky-50',     border: 'border-sky-200',    text: 'text-sky-800',    sub: 'text-sky-700',    hr: 'border-sky-200'    },
                    night:  { bg: 'bg-indigo-50',  border: 'border-indigo-200', text: 'text-indigo-800', sub: 'text-indigo-700', hr: 'border-indigo-200' },
                    '24hr': { bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800', sub: 'text-purple-700', hr: 'border-purple-200' },
                  };
                  const tc = typeColors[form.bookingType] ?? typeColors.day;
                  const pickedHourLbl = formatHourLabel(Number(form.checkInHour ?? 6));
                  const ciLabel = form.bookingType === 'night' ? '6:00 PM'
                                : form.bookingType === '24hr'  ? pickedHourLbl
                                : '6:00 AM';
                  const coLabel = form.bookingType === 'night' ? '7:00 AM (next day)'
                                : form.bookingType === '24hr'  ? `${pickedHourLbl} (next day)`
                                : '6:00 PM';
                  const rateLabel = form.bookingType === 'night' ? 'Night rate' : is24hr ? '24 hr rate' : 'Day rate';
                  return (
                    <div className={`p-3 rounded text-sm border ${tc.bg} ${tc.border}`}>
                      <div className={`space-y-0.5 ${tc.sub}`}>
                        <div className="flex justify-between">
                          <span>{rateLabel}</span>
                          <span>{fmtMoney(baseRate)}</span>
                        </div>
                        {visibleAddons.filter(a => Number(addonQtys[a.id] || 0) > 0).map(a => {
                          const qty = Number(addonQtys[a.id]);
                          const subtotal = a.per_booking ? a.price : a.price * qty;
                          return (
                            <div key={a.id} className="flex justify-between">
                              <span>{a.name}{!a.per_booking && ` × ${qty}`}</span>
                              <span>{fmtMoney(subtotal)}</span>
                            </div>
                          );
                        })}
                        {promoDiscount > 0 && (
                          <div className="flex justify-between text-emerald-700 font-medium">
                            <span><i className="fas fa-tag mr-1 text-xs"></i>Promo ({promoInput})</span>
                            <span>− {fmtMoney(promoDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-amber-700 pt-0.5">
                          <span>Entrance ({form.guests} pax × ₱{entranceFeeRate})</span>
                          <span>{fmtMoney(entranceFeeTotal)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t border-slate-300 pt-1.5 mt-1.5 text-slate-900">
                        <span>Total to Collect</span>
                        <span>{fmtMoney(previewTotal + entranceFeeTotal)}</span>
                      </div>
                    </div>
                  );
                })()}

                </>)}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0 bg-white">
              {wiStep === 1 ? (<>
                <button type="button" onClick={() => { setFormOpen(false); setFormError(''); closeWizard(); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button"
                  onClick={() => {
                    setFormError('');
                    if (!form.fullName.trim()) { setFormError('Guest name is required.'); return; }
                    if (!form.phone.trim()) { setFormError('Phone number is required.'); return; }
                    if (!form.roomId) { setFormError('Please select a room.'); return; }
                    setWiStep(2);
                    document.getElementById('walkin-scroll')?.scrollTo(0, 0);
                  }}
                  className="flex-1 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  Next <i className="fas fa-arrow-right"></i>
                </button>
              </>) : (<>
                <button type="button" onClick={() => { setWiStep(1); document.getElementById('walkin-scroll')?.scrollTo(0, 0); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <i className="fas fa-arrow-left mr-1"></i>Back
                </button>
                <button type="button"
                  onClick={handleCreate}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  <i className="fas fa-eye"></i>
                  {submitting ? 'Creating...' : 'Review & Confirm'}
                </button>
              </>)}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Main ── */}
      {/* This route exists purely to host the walk-in wizard modal. The
          wizard opens on mount and every close path navigates to
          /frontdesk/bookings, so this background is only briefly visible
          while the form loads. The Today's Bookings table lives in the
          consolidated Bookings page now. */}
      <main className="p-6">
        {error && (
          <div role="alert" aria-live="assertive" className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">
            <i className="fas fa-exclamation-circle mr-2" aria-hidden="true"></i>{error}
          </div>
        )}
        <div className="bg-white rounded-lg shadow p-10 text-center text-slate-400">
          <i className="fas fa-spinner fa-spin text-2xl mb-3 block"></i>
          <p className="text-sm">Opening walk-in wizard…</p>
          <button
            onClick={() => navigate(bookingsPath)}
            className="mt-4 text-xs text-sky-600 hover:text-sky-800 font-medium"
          >
            ← Back to Bookings
          </button>
        </div>
      </main>
    </Shell>
  );
}
