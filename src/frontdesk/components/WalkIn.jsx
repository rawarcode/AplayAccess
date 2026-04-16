import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Layout/Sidebar';
import { api } from '../../lib/api';
import { getFdBookings, getFdRooms, createWalkInBooking, updateBookingStatus, transferRoom } from '../../lib/frontdeskApi';
import { validatePromo } from '../../lib/adminApi';
import Toast, { useToast } from '../../components/ui/Toast';
import BookingDetailModal from './BookingDetailModal';

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtMoney(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
function fmtDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt.replace(' ', 'T')).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function walkInName(b) {
  if (b.specialRequests?.startsWith('Walk-in:')) {
    const m = b.specialRequests.match(/^Walk-in:\s*([^,]+)/);
    return m ? m[1].trim() : b.guest;
  }
  return b.guest;
}

function StatusBadge({ status }) {
  const cls = {
    'Checked In': 'bg-violet-100 text-violet-800',
    Confirmed:    'bg-sky-100 text-sky-800',
    Completed:    'bg-emerald-100 text-emerald-800',
    Cancelled:    'bg-rose-100 text-rose-800',
    Pending:      'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${cls[status] ?? 'bg-slate-100 text-slate-800'}`}>
      {status}
    </span>
  );
}

// Addons are fetched from API — no hardcoded catalog

// Entrance fee rates per adult — matches Setting::pricing() defaults
const ENTRANCE_RATES = { day: 50, night: 80, '24hr': 100, '24hr-pm': 100 };

const EMPTY_FORM = {
  fullName: '', phone: '', email: '',
  roomId: '', date: todayStr(),
  payMethod: 'Cash', notes: '',
  bookingType: 'day', // 'day' | 'night' | '24hr' | '24hr-pm'
  guests: 1,
};

// ─── component ────────────────────────────────────────────────────────────────
export default function WalkIn() {
  const location = useLocation();
  const preselectedRoom = location.state?.preselectedRoom ?? null;

  const [sortBy,  setSortBy]  = useState('ID');
  const [sortDir, setSortDir] = useState('desc');
  const [bookings, setBookings]           = useState([]);
  const [rooms, setRooms]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [formOpen, setFormOpen]           = useState(false);
  const [submitting,   setSubmitting]     = useState(false);
  const [confirmOpen,  setConfirmOpen]   = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [collectBooking, setCollectBooking] = useState(null); // booking being collected
  const [collectPayMethod, setCollectPayMethod] = useState('Cash');
  const [collectPaying, setCollectPaying]   = useState(false);
  const [transferBooking, setTransferBooking] = useState(null); // booking being transferred
  const [transferRoomId, setTransferRoomId]   = useState('');
  const [transferring, setTransferring]       = useState(false);
  const [error, setError]                 = useState('');
  const [formError, setFormError]         = useState('');
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [wiStep, setWiStep]               = useState(1);
  const [showWiNotes, setShowWiNotes]     = useState(false);
  const [viewWalkin, setViewWalkin]       = useState(null);
  const [toast, showToast, clearToast, toastType] = useToast();

  // Promo code
  const [addons,       setAddons]        = useState([]);   // from API
  const [addonQtys,    setAddonQtys]    = useState({});   // { [id]: qty }

  const [promoInput,   setPromoInput]   = useState('');
  const [promoResult,  setPromoResult]  = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError,   setPromoError]   = useState('');

  const today = todayStr();

  function loadAll() {
    setLoading(true);
    Promise.all([getFdBookings(), getFdRooms(), api.get('/api/addons')])
      .then(([bk, rm, adRes]) => {
        setBookings(bk);
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

  // Auto-open form with the pre-selected room when coming from Rooms board
  useEffect(() => {
    if (!preselectedRoom || loading) return;
    setForm(f => ({ ...f, roomId: String(preselectedRoom.id) }));
    setFormOpen(true);
    setWiStep(1);
    setShowWiNotes(false);
  }, [preselectedRoom, loading]);

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
        const map = {};
        (r.data?.data ?? []).forEach(rm => { map[rm.name] = rm.available; });
        setAvailability(map);
      })
      .catch(() => setAvailability(null))
      .finally(() => setAvailChecking(false));
  }, [form.date, form.bookingType]);

  // Day is unavailable when: today is selected and it's past 3PM
  const dayUnavailable = useMemo(() => {
    if (form.date !== today) return false;
    return new Date().getHours() >= 15; // 3PM cutoff
  }, [form.date, today]);

  // Night is unavailable when: past 6PM today
  const nightUnavailable = useMemo(() => {
    if (form.bookingType !== 'night') return false;
    if (form.date === today) {
      const now = new Date();
      if (now.getHours() >= 18) return true;
    }
    return false;
  }, [form.bookingType, form.date, today]);

  // Auto-switch away from Day if it becomes unavailable (past 3PM)
  useEffect(() => {
    if (dayUnavailable && form.bookingType === 'day') setField('bookingType', 'night');
  }, [dayUnavailable]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); }

  // Auto-switch to first allowed type when a restricted room is selected
  useEffect(() => {
    const room = rooms.find(r => String(r.id) === String(form.roomId));
    const allowed = room?.allowed_booking_types ?? null;
    if (!allowed) return;
    if (!allowed.includes(form.bookingType)) setField('bookingType', allowed[0]);
  }, [form.roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayBookings = [...bookings.filter(b =>
    b.checkIn?.slice(0, 10) === today &&
    b.specialRequests?.startsWith('Walk-in:')
  )].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === 'Guest')  { aVal = walkInName(a).toLowerCase(); bVal = walkInName(b).toLowerCase(); }
    else if (sortBy === 'Room')   { aVal = (a.roomType ?? '').toLowerCase(); bVal = (b.roomType ?? '').toLowerCase(); }
    else if (sortBy === 'Guests') { aVal = Number(a.guests ?? 0);            bVal = Number(b.guests ?? 0); }
    else if (sortBy === 'Total')  { aVal = Number(a.total ?? 0);             bVal = Number(b.total ?? 0); }
    else if (sortBy === 'Status') { aVal = a.status ?? '';                   bVal = b.status ?? ''; }
    else { aVal = a.id ?? ''; bVal = b.id ?? ''; }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  // Pricing preview — room rate only; entrance fees collected at check-in by frontdesk
  const selectedRoom  = rooms.find(r => String(r.id) === String(form.roomId));
  const allowedTypes  = selectedRoom?.allowed_booking_types ?? null;
  const typeAllowed   = (type) => !allowedTypes || allowedTypes.includes(type);
  const dayRate       = Number(selectedRoom?.day_rate       ?? 1500);
  const nightRate     = Number(selectedRoom?.overnight_rate ?? 1500);
  const rate24        = Number(selectedRoom?.rate_24hr      ?? 2000);
  const is24hr        = form.bookingType === '24hr' || form.bookingType === '24hr-pm';
  const baseRate      = form.bookingType === 'night' ? nightRate : is24hr ? rate24 : dayRate;
  const amenityTotal = addons.reduce((sum, a) => {
    const qty = Number(addonQtys[a.id] || 0);
    if (qty <= 0) return sum;
    return sum + (a.per_booking ? a.price : a.price * qty);
  }, 0);
  const previewSubtotal = baseRate + amenityTotal;
  const promoDiscount   = promoResult?.discount_amount ?? 0;
  const previewTotal    = Math.max(previewSubtotal - promoDiscount, 0);
  const entranceFeeRate = ENTRANCE_RATES[form.bookingType] ?? 50;
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

  // Step 1 — validate → show confirmation
  function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    if (!form.fullName.trim()) {
      setFormError('Guest name is required.'); return;
    }
    if (!form.phone.trim()) { setFormError('Phone number is required.'); return; }
    if (dayUnavailable && form.bookingType === 'day') {
      setFormError('Day booking is not available after 3:00 PM. Please select Night or 24 Hours.'); return;
    }
    if (allowedTypes && !allowedTypes.includes(form.bookingType)) {
      setFormError(`This room only supports: ${allowedTypes.join(', ')}.`); return;
    }
    if (nightUnavailable) {
      setFormError('Night booking is not available — it is past 6PM. Please select a future date.'); return;
    }
    if (!form.roomId) { setFormError('Please select a room.'); return; }
    const selRoom = rooms.find(r => String(r.id) === String(form.roomId));
    if (availability !== null && (!selRoom || availability[selRoom.name] !== true)) {
      setFormError('This room is not available for the selected date and booking type.'); return;
    }
    setConfirmOpen(true);
  }

  // Step 2 — confirmed → call API
  async function handleConfirmCreate() {
    setConfirmOpen(false);
    const checkInTime = (form.bookingType === 'night' || form.bookingType === '24hr-pm') ? '18:00:00' : '06:00:00';
    const checkIn     = `${form.date} ${checkInTime}`;
    const guestName   = form.fullName.trim();
    const amenities   = addons
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
      loadAll();
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
        'Failed to create booking. The room may already be booked for this time slot.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatus(bookingId, status) {
    setActionLoading(bookingId);
    try {
      await updateBookingStatus(bookingId, status);
      setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, status } : b));
    } catch {
      showToast('Failed to update status. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCollect() {
    if (!collectBooking) return;
    setCollectPaying(true);
    try {
      await updateBookingStatus(collectBooking.bookingId, 'Completed', { payment_method: collectPayMethod });
      setBookings(prev => prev.map(b =>
        b.bookingId === collectBooking.bookingId
          ? { ...b, status: 'Completed', fully_paid: true }
          : b
      ));
      setCollectBooking(null);
      showToast('Payment collected! Booking completed.', 'success');
    } catch {
      showToast('Failed to complete booking. Please try again.', 'error');
    } finally {
      setCollectPaying(false);
    }
  }

  async function handleTransfer() {
    if (!transferBooking || !transferRoomId) return;
    setTransferring(true);
    try {
      const res = await transferRoom(transferBooking.bookingId, Number(transferRoomId));
      const newRoomName = rooms.find(r => String(r.id) === String(transferRoomId))?.name ?? res.room_name;
      setBookings(prev => prev.map(b =>
        b.bookingId === transferBooking.bookingId
          ? { ...b, roomType: newRoomName, roomId: Number(transferRoomId) }
          : b
      ));
      setTransferBooking(null);
      setTransferRoomId('');
      showToast(`Guest transferred to ${newRoomName}.`, 'success');
    } catch (err) {
      showToast(err?.response?.data?.message ?? 'Failed to transfer. Room may be occupied.', 'error');
    } finally {
      setTransferring(false);
    }
  }

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <Helmet><title>Walk-in — Frontdesk</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* ── Collect Payment Modal ── */}
      {collectBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Collect Payment — {collectBooking.id}</h3>
                <button onClick={() => setCollectBooking(null)} className="text-slate-500 hover:text-slate-700" aria-label="Close">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="p-4 bg-slate-50 rounded mb-4 text-sm">
                <p className="font-medium text-slate-800">{walkInName(collectBooking)}</p>
                <p className="text-slate-600">{collectBooking.roomType} · {collectBooking.guests} pax</p>
                <p className="text-slate-500 text-xs mt-1">{fmtDateTime(collectBooking.checkIn)} → {fmtDateTime(collectBooking.checkOut)}</p>
              </div>
              <div className="border rounded mb-4 text-sm">
                <div className="flex justify-between px-4 py-3 font-semibold text-sky-800 text-base">
                  <span>Total to Collect</span>
                  <span>{fmtMoney(collectBooking.total)}</span>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <div className="flex gap-2">
                  {[
                    { value: 'Cash',  icon: 'fa-money-bill-wave', color: 'text-emerald-600' },
                    { value: 'GCash', icon: 'fa-mobile-alt',      color: 'text-sky-500'  },
                    { value: 'Maya',  icon: 'fa-mobile-alt',      color: 'text-emerald-500' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setCollectPayMethod(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded text-sm font-medium transition-colors ${
                        collectPayMethod === opt.value
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <i className={`fas ${opt.icon} ${collectPayMethod === opt.value ? '' : opt.color}`}></i>
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setCollectBooking(null)} className="px-4 py-2 border rounded text-sm text-slate-700">Cancel</button>
                <button onClick={handleCollect} disabled={collectPaying}
                  className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-60">
                  <i className="fas fa-check mr-1"></i>
                  {collectPaying ? 'Processing...' : `Collect ${fmtMoney(collectBooking.total)} & Complete`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Room Modal ── */}
      {transferBooking && (() => {
        // Available rooms: all rooms except the current one, minus rooms that have
        // conflicting Checked In / Confirmed bookings overlapping this booking's slot.
        const busyRoomIds = new Set(
          bookings
            .filter(b =>
              b.bookingId !== transferBooking.bookingId &&
              ['Confirmed', 'Checked In'].includes(b.status) &&
              new Date(b.checkIn)  < new Date(transferBooking.checkOut) &&
              new Date(b.checkOut) > new Date(transferBooking.checkIn)
            )
            .map(b => b.roomId)
        );
        const availableRooms = rooms.filter(r =>
          String(r.id) !== String(transferBooking.roomId) && !busyRoomIds.has(r.id)
        );
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Transfer Guest — {transferBooking.id}</h3>
                  <button onClick={() => { setTransferBooking(null); setTransferRoomId(''); }}
                    className="text-slate-500 hover:text-slate-700" aria-label="Close"><i className="fas fa-times"></i></button>
                </div>
                <div className="p-4 bg-slate-50 rounded mb-4 text-sm">
                  <p className="font-medium text-slate-800">{walkInName(transferBooking)}</p>
                  <p className="text-slate-600">Currently in: <span className="font-semibold">{transferBooking.roomType}</span></p>
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Transfer to Room</label>
                  {availableRooms.length === 0 ? (
                    <p className="text-sm text-rose-600">No other rooms are available for this time slot.</p>
                  ) : (
                    <select value={transferRoomId} onChange={e => setTransferRoomId(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
                      <option value="">Select a room...</option>
                      {availableRooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setTransferBooking(null); setTransferRoomId(''); }}
                    className="px-4 py-2 border rounded text-sm text-slate-700">Cancel</button>
                  <button onClick={handleTransfer} disabled={!transferRoomId || transferring || availableRooms.length === 0}
                    className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-60">
                    <i className="fas fa-exchange-alt mr-1"></i>
                    {transferring ? 'Transferring...' : 'Transfer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Walk-in Confirmation Modal ── */}
      {confirmOpen && (() => {
        const selRoom    = rooms.find(r => String(r.id) === String(form.roomId));
        const guestName  = form.fullName.trim();
        const checkInLabel  = (form.bookingType === 'night' || form.bookingType === '24hr-pm') ? '6:00 PM' : '6:00 AM';
        const checkOutLabel = form.bookingType === 'night'   ? '7:00 AM (next day)'
                            : form.bookingType === '24hr'    ? '6:00 AM (next day)'
                            : form.bookingType === '24hr-pm' ? '6:00 PM (next day)'
                            : '6:00 PM';
        const dateLabel  = form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('en-PH', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) : '—';
        const typeLabel  = form.bookingType === 'night'   ? 'Night Stay'
                         : form.bookingType === '24hr'    ? '24 Hours (6AM–6AM)'
                         : form.bookingType === '24hr-pm' ? '24 Hours (6PM–6PM)'
                         : 'Day Visit';
        return (
          <div className="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center px-4 py-10">
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmOpen(false)} />
            <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="bg-sky-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  <i className="fas fa-clipboard-check text-xl"></i>
                  <div>
                    <h3 className="font-bold text-lg">Walk-in Booking Summary</h3>
                    <p className="text-sky-200 text-xs">Review all details before confirming</p>
                  </div>
                </div>
                <button onClick={() => setConfirmOpen(false)} className="text-white/70 hover:text-white" aria-label="Close">
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
                  {addons.some(a => Number(addonQtys[a.id] || 0) > 0) && (
                    <>
                      <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Add-ons</div>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-100">
                          {addons.filter(a => Number(addonQtys[a.id] || 0) > 0).map(a => {
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
                    <span>Room Total</span>
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
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <i className="fas fa-hand-holding-usd"></i>
                      Collect this amount separately at the gate — not included in booking total.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                <button onClick={() => setConfirmOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <i className="fas fa-arrow-left mr-2"></i>Back
                </button>
                <button onClick={handleConfirmCreate} disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                  {submitting
                    ? <><i className="fas fa-spinner fa-spin"></i> Creating...</>
                    : <><i className="fas fa-check"></i> Confirm Booking</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── View Booking Modal ── */}
      {viewWalkin && (
        <BookingDetailModal
          booking={viewWalkin}
          onClose={() => setViewWalkin(null)}
          onUpdated={updated => {
            setViewWalkin(updated);
            setBookings(prev => prev.map(b => b.bookingId === updated.bookingId ? { ...b, ...updated } : b));
          }}
          showToast={showToast}
        />
      )}

      {/* ── New Walk-in Modal ── */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">

            {/* Header */}
            <div className="bg-[#1e3a8a] px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 text-white">
                <i className="fas fa-person-walking-luggage text-xl"></i>
                <div>
                  <h3 className="font-bold text-lg">New Walk-in Booking</h3>
                  <p className="text-sky-200 text-xs">Fill in guest and booking details</p>
                </div>
              </div>
              <button onClick={() => { setFormOpen(false); setFormError(''); }} className="text-white/70 hover:text-white" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>{formError}
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

              <form onSubmit={handleCreate} id="walkin-form">

                {/* ═══ STEP 1 — Guest & Booking Details ═══ */}
                {wiStep === 1 && (<>
                {/* Guest info */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Guest Information</span>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                    <input type="text" value={form.fullName}
                      onChange={e => setField('fullName', e.target.value)}
                      placeholder="e.g. Juan dela Cruz Jr."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Phone *</label>
                    <input type="tel" value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" placeholder="+639XXXXXXXXX" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                    <input type="email" value={form.email}
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
                <div className="grid grid-cols-2 gap-3 mb-5">

                  {/* Date — must be chosen first */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Date *</label>
                    <input type="date" value={form.date} min={today}
                      onChange={e => setField('date', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" required />
                  </div>

                  {/* Booking type — compact pills */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-2">Booking Type *</label>
                    <div className="flex gap-2">
                      {[
                        { type: 'day',   icon: 'fa-sun',   label: 'Day',   disabled: dayUnavailable || !typeAllowed('day')   },
                        { type: 'night', icon: 'fa-moon',  label: 'Night', disabled: !typeAllowed('night') },
                        { type: '24hr',  icon: 'fa-clock', label: '24 Hrs', disabled: !typeAllowed('24hr')  },
                      ].map(opt => {
                        const active = opt.type === '24hr' ? is24hr : form.bookingType === opt.type;
                        return (
                          <button key={opt.type} type="button"
                            disabled={opt.disabled}
                            onClick={() => { if (!opt.disabled) setField('bookingType', opt.type); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 border-2 rounded-lg text-sm font-medium transition-colors ${
                              opt.disabled
                                ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                                : active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <i className={`fas ${opt.icon} text-xs ${active && !opt.disabled ? 'text-sky-500' : 'text-slate-400'}`}></i>
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

                    {/* 24hr start-time sub-toggle */}
                    {is24hr && (
                      <div className="mt-2 flex rounded-lg overflow-hidden border border-purple-200 text-xs font-medium">
                        <button type="button"
                          onClick={() => setField('bookingType', '24hr')}
                          className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${
                            form.bookingType === '24hr'
                              ? 'bg-purple-600 text-white'
                              : 'bg-white text-purple-700 hover:bg-purple-50'
                          }`}
                        >
                          <i className="fas fa-sun text-xs"></i> 6 AM start
                        </button>
                        <button type="button"
                          onClick={() => setField('bookingType', '24hr-pm')}
                          className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${
                            form.bookingType === '24hr-pm'
                              ? 'bg-purple-600 text-white'
                              : 'bg-white text-purple-700 hover:bg-purple-50'
                          }`}
                        >
                          <i className="fas fa-moon text-xs"></i> 6 PM start
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Room *{availChecking && <span className="ml-1 text-slate-400 font-normal">Checking availability...</span>}
                    </label>
                    <select value={form.roomId} onChange={e => setField('roomId', e.target.value)}
                      disabled={nightUnavailable}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-slate-100 disabled:cursor-not-allowed" required>
                      <option value="">
                        {nightUnavailable ? 'Night not available — select a future date' : 'Select room / cottage / pavilion'}
                      </option>
                      {(() => {
                        const visible = rooms.filter(r => availability === null || availability?.[r.name] === true);
                        const getCat  = r => r.category || (r.name.toLowerCase().includes('cottage') ? 'cottage' : r.name.toLowerCase().includes('pavilion') ? 'pavilion' : 'room');
                        const groups  = [
                          { key: 'room',     label: '🛏️  Rooms'     },
                          { key: 'cottage',  label: '⛱️  Cottages'  },
                          { key: 'pavilion', label: '🏛️  Pavilions' },
                          { key: 'tent',     label: '⛺  Tent Pitching' },
                        ];
                        return groups.map(g => {
                          const items = visible.filter(r => getCat(r) === g.key);
                          if (!items.length) return null;
                          return (
                            <optgroup key={g.key} label={g.label}>
                              {items.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.name}{r.capacity_label ? ` — ${r.capacity_label}` : ''}
                                </option>
                              ))}
                            </optgroup>
                          );
                        });
                      })()}
                    </select>
                    {(() => {
                      const sel = rooms.find(r => String(r.id) === String(form.roomId));
                      const avail = sel ? availability?.[sel.name] : undefined;
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
                        className="w-8 h-9 border border-slate-200 rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-100">−</button>
                      <input type="number" min="1" max="200" value={form.guests}
                        onChange={e => setField('guests', Math.max(1, Number(e.target.value) || 1))}
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-400" />
                      <button type="button"
                        onClick={() => setField('guests', Number(form.guests) + 1)}
                        className="w-8 h-9 border border-slate-200 rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-100">+</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method *</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'Cash',  icon: 'fa-money-bill-wave', color: 'text-emerald-600' },
                        { value: 'GCash', icon: 'fa-mobile-alt',      color: 'text-sky-500'  },
                        { value: 'Maya',  icon: 'fa-mobile-alt',      color: 'text-emerald-500' },
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

                {/* Notes */}
                {showWiNotes ? (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                    <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      placeholder="Special requests, remarks..." />
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowWiNotes(true)} className="text-xs text-sky-600 hover:underline mb-4">
                    <i className="fas fa-plus mr-1"></i>Add notes / special requests
                  </button>
                )}

                {/* Amenities — fetched from API */}
                {addons.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-slate-200"></div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Add-on Amenities</span>
                      <div className="h-px flex-1 bg-slate-200"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {addons.map(a => {
                        const qty = Number(addonQtys[a.id] || 0);
                        const isFixed = a.per_booking;
                        const active = qty > 0;
                        if (isFixed) {
                          return (
                            <button key={a.id} type="button"
                              onClick={() => setAddonQtys(q => ({ ...q, [a.id]: active ? 0 : 1 }))}
                              className={`border rounded-lg p-3 text-left transition-colors ${active ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <i className={`fas ${a.icon || 'fa-tag'} ${active ? 'text-indigo-600' : 'text-slate-400'}`}></i>
                                <p className={`text-sm font-medium ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{a.name}</p>
                              </div>
                              <p className="text-xs text-slate-500">₱{Number(a.price).toLocaleString()} flat</p>
                              {active && <p className="text-xs font-medium text-indigo-700 mt-1">Added ✓</p>}
                            </button>
                          );
                        }
                        return (
                          <div key={a.id} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <i className={`fas ${a.icon || 'fa-tag'} text-slate-500`}></i>
                              <p className="text-sm font-medium text-slate-700">{a.name}</p>
                              <span className="ml-auto text-xs text-slate-500">₱{Number(a.price).toLocaleString()} each</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button"
                                onClick={() => setAddonQtys(q => ({ ...q, [a.id]: Math.max(0, qty - 1) }))}
                                className="w-7 h-7 rounded border text-slate-600 hover:bg-slate-100 text-sm font-bold">−</button>
                              <span className="w-8 text-center text-sm font-medium">{qty}</span>
                              <button type="button"
                                onClick={() => setAddonQtys(q => ({ ...q, [a.id]: Math.min(a.max_qty, qty + 1) }))}
                                className="w-7 h-7 rounded border text-slate-600 hover:bg-slate-100 text-sm font-bold">+</button>
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
                    day:      { bg: 'bg-sky-50',   border: 'border-sky-200',   text: 'text-sky-800',   sub: 'text-sky-700',   hr: 'border-sky-200'   },
                    night:    { bg: 'bg-indigo-50',  border: 'border-indigo-200', text: 'text-indigo-800', sub: 'text-indigo-700', hr: 'border-indigo-200' },
                    '24hr':   { bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800', sub: 'text-purple-700', hr: 'border-purple-200' },
                    '24hr-pm':{ bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800', sub: 'text-purple-700', hr: 'border-purple-200' },
                  };
                  const tc = typeColors[form.bookingType] ?? typeColors.day;
                  const ciLabel = (form.bookingType === 'night' || form.bookingType === '24hr-pm') ? '6:00 PM' : '6:00 AM';
                  const coLabel = form.bookingType === 'night'   ? '7:00 AM (next day)'
                                : form.bookingType === '24hr'    ? '6:00 AM (next day)'
                                : form.bookingType === '24hr-pm' ? '6:00 PM (next day)'
                                : '6:00 PM';
                  const rateLabel = form.bookingType === 'night' ? 'Night rate' : is24hr ? '24 hr rate' : 'Day rate';
                  return (
                    <div className={`p-3 rounded text-sm mb-4 border ${tc.bg} ${tc.border}`}>
                      <p className={`font-semibold mb-2 ${tc.text}`}>
                        <i className={`fas ${form.bookingType === 'night' ? 'fa-moon' : is24hr ? 'fa-clock' : 'fa-sun'} mr-1`}></i>Booking Summary
                      </p>
                      <div className={`space-y-1 mb-2 ${tc.sub}`}>
                        <div className="flex justify-between">
                          <span>Check-in</span>
                          <span className="font-medium">{ciLabel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Check-out</span>
                          <span className="font-medium">{coLabel}</span>
                        </div>
                        <hr className={`my-1 ${tc.hr}`} />
                        <div className="flex justify-between">
                          <span>{rateLabel}</span>
                          <span>{fmtMoney(baseRate)}</span>
                        </div>
                        {addons.filter(a => Number(addonQtys[a.id] || 0) > 0).map(a => {
                          const qty = Number(addonQtys[a.id]);
                          const subtotal = a.per_booking ? a.price : a.price * qty;
                          return (
                            <div key={a.id} className="flex justify-between">
                              <span>
                                <i className={`fas ${a.icon || 'fa-tag'} mr-1 text-xs`}></i>
                                {a.name}{!a.per_booking && ` × ${qty}`}
                              </span>
                              <span>{fmtMoney(subtotal)}</span>
                            </div>
                          );
                        })}
                        {promoDiscount > 0 && (
                          <>
                            <div className="flex justify-between text-slate-400 line-through">
                              <span>Subtotal</span>
                              <span>{fmtMoney(previewSubtotal)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-700 font-medium">
                              <span><i className="fas fa-tag mr-1 text-xs"></i>Promo ({promoInput})</span>
                              <span>− {fmtMoney(promoDiscount)}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className={`flex justify-between font-bold border-t pt-2 ${tc.text} ${tc.hr}`}>
                        <span>Room Total</span>
                        <span>{fmtMoney(previewTotal)}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 font-medium pt-1.5 border-t border-dashed border-amber-200 mt-1.5">
                        <span className="flex items-center gap-1">
                          <i className="fas fa-ticket-alt text-xs"></i>
                          Entrance fee ({form.guests} pax × ₱{entranceFeeRate})
                        </span>
                        <span>{fmtMoney(entranceFeeTotal)}</span>
                      </div>
                      <p className="text-xs text-amber-600 mt-0.5">
                        <i className="fas fa-hand-holding-usd mr-1"></i>Collect entrance fee separately at the gate.
                      </p>
                    </div>
                  );
                })()}

                </>)}
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0 bg-white">
              {wiStep === 1 ? (<>
                <button type="button" onClick={() => { setFormOpen(false); setFormError(''); }}
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
                  }}
                  className="flex-1 px-4 py-2.5 bg-[#1e3a8a] hover:bg-[#152c6e] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  Next <i className="fas fa-arrow-right"></i>
                </button>
              </>) : (<>
                <button type="button" onClick={() => setWiStep(1)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <i className="fas fa-arrow-left mr-1"></i>Back
                </button>
                <button type="submit" form="walkin-form"
                  disabled={submitting || nightUnavailable || (dayUnavailable && form.bookingType === 'day')}
                  className="flex-1 px-4 py-2.5 bg-[#1e3a8a] hover:bg-[#152c6e] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  <i className="fas fa-eye"></i>
                  {submitting ? 'Creating...' : 'Review & Confirm'}
                </button>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Today's Bookings</h2>
            <button
              onClick={() => { setFormOpen(true); setFormError(''); setForm({ ...EMPTY_FORM, date: today }); setWiStep(1); setShowWiNotes(false); }}
              className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 text-sm"
            >
              <i className="fas fa-plus mr-2"></i>New Walk-in
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading...
            </div>
          ) : todayBookings.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <i className="fas fa-calendar-day text-3xl mb-2 block"></i>
              <p>No bookings for today yet.</p>
              <button
                onClick={() => { setFormOpen(true); setFormError(''); setForm({ ...EMPTY_FORM, date: today }); setWiStep(1); setShowWiNotes(false); }}
                className="mt-3 px-4 py-2 bg-sky-600 text-white rounded text-sm hover:bg-sky-700"
              >
                <i className="fas fa-plus mr-2"></i>Create Walk-in
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[['ID','ID'],['Guest','Guest'],['Room','Room'],['Guests','Guests'],['Total','Total'],['Status','Status']].map(([label,key]) => (
                      <th key={key} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        <button onClick={() => { if(sortBy===key) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(key);setSortDir('asc');} }}
                          className="flex items-center gap-1 hover:text-sky-600 transition-colors group">
                          {label}
                          <span className="text-slate-400 group-hover:text-sky-400">
                            {sortBy===key ? <i className={`fas fa-arrow-${sortDir==='asc'?'up':'down'} text-sky-500`}></i> : <i className="fas fa-sort opacity-40"></i>}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time Slot</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {todayBookings.map(b => (
                    <tr key={b.bookingId} className="hover:bg-slate-50 cursor-pointer" onClick={() => setViewWalkin(b)}>
                      <td className="px-4 py-3 text-xs text-slate-500">{b.id}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{walkInName(b)}</p>
                        {b.specialRequests?.startsWith('Walk-in:') && (
                          <span className="text-xs text-sky-600 bg-sky-50 px-1 rounded">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{b.roomType}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {fmtDateTime(b.checkIn)}<br />
                        <span className="text-slate-400">→ {fmtDateTime(b.checkOut)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">{b.guests}</td>
                      <td className="px-4 py-3 text-sm">{fmtMoney(b.total)}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {b.status === 'Checked In' && (
                            <>
                              <button
                                onClick={() => { setCollectBooking(b); setCollectPayMethod(b.paymentMethod ?? 'Cash'); }}
                                disabled={actionLoading === b.bookingId}
                                className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-40"
                              >Collect</button>
                              <button
                                onClick={() => { setTransferBooking(b); setTransferRoomId(''); }}
                                disabled={actionLoading === b.bookingId}
                                className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-40"
                              ><i className="fas fa-exchange-alt mr-1"></i>Transfer</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </Sidebar>
  );
}
