import { useState, useEffect } from 'react';
import Sidebar from './Layout/Sidebar';
import { api } from '../../lib/api';
import { getFdBookings, getFdRooms, createWalkInBooking, updateBookingStatus } from '../../lib/frontdeskApi';

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
    Confirmed: 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
    Pending:   'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${cls[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

// Day check-in slots: 7AM–4PM (check-out capped at 5PM)
const DAY_TIME_SLOTS = [
  { value: '07:00', label: '7:00 AM'  },
  { value: '08:00', label: '8:00 AM'  },
  { value: '09:00', label: '9:00 AM'  },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM'  },
  { value: '14:00', label: '2:00 PM'  },
  { value: '15:00', label: '3:00 PM'  },
  { value: '16:00', label: '4:00 PM'  },
];

// Day: check-in + 8hrs, capped at 5PM. Overnight: 6PM → 6AM next day (fixed).
function computeCheckOut(dateStr, timeStr, bookingType) {
  if (bookingType === 'overnight') {
    const d = new Date(`${dateStr}T18:00:00`);
    d.setDate(d.getDate() + 1);
    d.setHours(6, 0, 0, 0);
    return d;
  }
  const checkIn = new Date(`${dateStr}T${timeStr}:00`);
  const co8 = new Date(checkIn.getTime() + 8 * 60 * 60 * 1000);
  const fivePM = new Date(`${dateStr}T17:00:00`);
  return co8 <= fivePM ? co8 : fivePM;
}

function fmtTime12(date) {
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const AMENITY_CATALOG = [
  { name: 'Pillow',  icon: 'fa-bed',         unit_price: 50,  type: 'qty'   },
  { name: 'Karaoke', icon: 'fa-microphone',  unit_price: 800, type: 'fixed' },
];

// Pricing defaults — overwritten immediately by /api/pricing on mount
const PRICING_DEFAULTS = {
  entrance_fee:     50,
  extra_guest_fee:  50,
  free_guest_limit: 5,
};

const EMPTY_FORM = {
  firstName: '', lastName: '', phone: '', email: '',
  roomId: '', date: todayStr(), time: '09:00',
  guests: '2', payMethod: 'Cash', notes: '',
  bookingType: 'day', // 'day' | 'overnight'
  pillow: 0, karaoke: false,
};

// ─── component ────────────────────────────────────────────────────────────────
export default function WalkIn() {
  const [bookings, setBookings]           = useState([]);
  const [rooms, setRooms]                 = useState([]);
  const [pricing, setPricing]             = useState(PRICING_DEFAULTS);
  const [loading, setLoading]             = useState(true);
  const [formOpen, setFormOpen]           = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError]                 = useState('');
  const [formError, setFormError]         = useState('');
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [viewWalkin, setViewWalkin]       = useState(null);

  const today = todayStr();

  function loadAll() {
    setLoading(true);
    Promise.all([getFdBookings(), getFdRooms(), api.get('/api/pricing')])
      .then(([bk, rm, prRes]) => {
        setBookings(bk);
        setRooms(rm);
        const d = prRes.data?.data ?? {};
        setPricing({
          entrance_fee:     Number(d.entrance_fee     ?? PRICING_DEFAULTS.entrance_fee),
          extra_guest_fee:  Number(d.extra_guest_fee  ?? PRICING_DEFAULTS.extra_guest_fee),
          free_guest_limit: Number(d.free_guest_limit ?? PRICING_DEFAULTS.free_guest_limit),
        });
        setError('');
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); }, []);

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); }

  const todayBookings = bookings.filter(b => b.checkIn?.slice(0, 10) === today);

  // Pricing preview — uses live rates from /api/pricing + selected room's rates
  const isOvernight     = form.bookingType === 'overnight';
  const selectedRoom    = rooms.find(r => String(r.id) === String(form.roomId));
  const dayRate         = Number(selectedRoom?.day_rate      ?? (rooms[0]?.day_rate      ?? 1500));
  const nightRate       = Number(selectedRoom?.overnight_rate ?? (rooms[0]?.overnight_rate ?? 2000));
  const baseRate        = isOvernight ? nightRate : dayRate;
  const previewGuests   = Number(form.guests) || 0;
  const previewExtraFee = Math.max(0, previewGuests - pricing.free_guest_limit) * pricing.extra_guest_fee;
  const previewEntrance = previewGuests * pricing.entrance_fee;
  const amenityTotal    = (Number(form.pillow) || 0) * 50 + (form.karaoke ? 800 : 0);
  const previewTotal    = baseRate + previewExtraFee + previewEntrance + amenityTotal;
  const previewCheckOut = computeCheckOut(form.date, form.time, form.bookingType);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Guest name is required.'); return;
    }
    if (!form.phone.trim()) { setFormError('Phone number is required.'); return; }
    if (!form.roomId) { setFormError('Please select a room.'); return; }

    // For overnight, backend forces 6PM; for day, send chosen time
    const checkIn   = isOvernight
      ? `${form.date} 18:00:00`
      : `${form.date} ${form.time}:00`;
    const guestName = `${form.firstName.trim()} ${form.lastName.trim()}`;

    const amenities = [];
    if (Number(form.pillow) > 0) amenities.push({ name: 'Pillow',  qty: Number(form.pillow) });
    if (form.karaoke)            amenities.push({ name: 'Karaoke', qty: 1 });

    setSubmitting(true);
    try {
      await createWalkInBooking({
        guest_name:        guestName,
        guest_phone:       form.phone.trim(),
        guest_email:       form.email.trim() || undefined,
        room_id:           Number(form.roomId),
        check_in:          checkIn,
        guests:            previewGuests,
        payment_method:    form.payMethod.toLowerCase(),
        special_requests:  form.notes.trim() || undefined,
        overnight:         isOvernight,
        amenities,
      });

      setFormOpen(false);
      setForm({ ...EMPTY_FORM, date: today });
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
      setBookings(prev => prev.map(b => b.booking_id === bookingId ? { ...b, status } : b));
    } catch {
      alert('Failed to update status. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      {/* ── View Booking Modal ── */}
      {viewWalkin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Booking Details</h3>
                <button onClick={() => setViewWalkin(null)} className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-gray-500">Reservation ID</p><p className="font-medium">{viewWalkin.id}</p></div>
                <div><p className="text-xs text-gray-500">Status</p><StatusBadge status={viewWalkin.status} /></div>
                <div><p className="text-xs text-gray-500">Guest</p><p className="font-medium">{walkInName(viewWalkin)}</p></div>
                <div><p className="text-xs text-gray-500">Phone</p><p>{viewWalkin.specialRequests?.match(/Phone:\s*([^,]+)/)?.[1]?.trim() || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Email</p><p>{viewWalkin.specialRequests?.match(/Email:\s*([^,]+)/)?.[1]?.trim() || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Room</p><p>{viewWalkin.roomType}</p></div>
                <div><p className="text-xs text-gray-500">Check-in</p><p>{fmtDateTime(viewWalkin.checkIn)}</p></div>
                <div><p className="text-xs text-gray-500">Check-out</p><p>{fmtDateTime(viewWalkin.checkOut)}</p></div>
                <div><p className="text-xs text-gray-500">Guests</p><p>{viewWalkin.guests}</p></div>
                <div><p className="text-xs text-gray-500">Total</p><p className="font-semibold text-green-700">{fmtMoney(viewWalkin.total)}</p></div>
                <div><p className="text-xs text-gray-500">Payment</p><p className="capitalize">{viewWalkin.paymentMethod || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Booked At</p><p>{fmtDateTime(viewWalkin.createdAt)}</p></div>
              </div>
              <div className="flex justify-between items-center mt-6 pt-4 border-t">
                <div className="flex gap-2">
                  {viewWalkin.status === 'Pending' && (
                    <button
                      onClick={() => { handleStatus(viewWalkin.booking_id, 'Confirmed'); setViewWalkin(v => ({ ...v, status: 'Confirmed' })); }}
                      disabled={actionLoading === viewWalkin.booking_id}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-40"
                    >Confirm</button>
                  )}
                  {viewWalkin.status === 'Confirmed' && (
                    <button
                      onClick={() => { handleStatus(viewWalkin.booking_id, 'Completed'); setViewWalkin(v => ({ ...v, status: 'Completed' })); }}
                      disabled={actionLoading === viewWalkin.booking_id}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-40"
                    >Mark Completed</button>
                  )}
                  {['Pending', 'Confirmed'].includes(viewWalkin.status) && (
                    <button
                      onClick={() => { handleStatus(viewWalkin.booking_id, 'Cancelled'); setViewWalkin(v => ({ ...v, status: 'Cancelled' })); }}
                      disabled={actionLoading === viewWalkin.booking_id}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-40"
                    >Cancel</button>
                  )}
                </div>
                <button onClick={() => setViewWalkin(null)}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Walk-in Modal ── */}
      {formOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">New Walk-in Booking</h3>
                <button onClick={() => { setFormOpen(false); setFormError(''); }}
                  className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
                  <i className="fas fa-exclamation-circle mr-2"></i>{formError}
                </div>
              )}

              <form onSubmit={handleCreate}>
                {/* Guest info */}
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Guest Information</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                    <input type="text" value={form.firstName}
                      onChange={e => setField('firstName', e.target.value)}
                      className="border rounded px-3 py-2 w-full text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                    <input type="text" value={form.lastName}
                      onChange={e => setField('lastName', e.target.value)}
                      className="border rounded px-3 py-2 w-full text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                    <input type="tel" value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                      className="border rounded px-3 py-2 w-full text-sm" placeholder="+639XXXXXXXXX" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email}
                      onChange={e => setField('email', e.target.value)}
                      className="border rounded px-3 py-2 w-full text-sm" />
                  </div>
                </div>

                {/* Booking details */}
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Booking Details</p>
                <div className="grid grid-cols-2 gap-3 mb-4">

                  {/* Booking type */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Booking Type *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setField('bookingType', 'day')}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-colors ${
                          !isOvernight ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <i className={`fas fa-sun text-lg ${!isOvernight ? 'text-blue-500' : 'text-gray-400'}`}></i>
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${!isOvernight ? 'text-blue-700' : 'text-gray-700'}`}>Day Visit</p>
                          <p className="text-xs text-gray-500">7AM – 5PM · {fmtMoney(dayRate)}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setField('bookingType', 'overnight')}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-colors ${
                          isOvernight ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <i className={`fas fa-moon text-lg ${isOvernight ? 'text-indigo-500' : 'text-gray-400'}`}></i>
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${isOvernight ? 'text-indigo-700' : 'text-gray-700'}`}>Overnight</p>
                          <p className="text-xs text-gray-500">6PM – 6AM · {fmtMoney(nightRate)}</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Room *</label>
                    <select value={form.roomId} onChange={e => setField('roomId', e.target.value)}
                      className="border rounded px-3 py-2 w-full text-sm" required>
                      <option value="">Select room</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Number of Guests * <span className="text-green-600 font-normal">(children 3 & below are free)</span>
                    </label>
                    <select value={form.guests} onChange={e => setField('guests', e.target.value)}
                      className="border rounded px-3 py-2 w-full text-sm">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                    <input type="date" value={form.date} min={today}
                      onChange={e => setField('date', e.target.value)}
                      className="border rounded px-3 py-2 w-full text-sm" required />
                  </div>

                  {/* Day: time picker | Overnight: fixed time display */}
                  {!isOvernight ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Check-in Time *</label>
                      <select value={form.time} onChange={e => setField('time', e.target.value)}
                        className="border rounded px-3 py-2 w-full text-sm">
                        {DAY_TIME_SLOTS.map(t => {
                          const co = computeCheckOut(form.date, t.value, 'day');
                          return (
                            <option key={t.value} value={t.value}>{t.label} → {fmtTime12(co)}</option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Check-in Time</label>
                      <div className="border rounded px-3 py-2 w-full text-sm bg-indigo-50 text-indigo-700 font-medium flex items-center gap-2">
                        <i className="fas fa-moon"></i> 6:00 PM → 6:00 AM (next day)
                      </div>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method *</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'Cash',  icon: 'fa-money-bill-wave', color: 'text-green-600' },
                        { value: 'GCash', icon: 'fa-mobile-alt',      color: 'text-blue-500'  },
                        { value: 'Maya',  icon: 'fa-mobile-alt',      color: 'text-green-500' },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setField('payMethod', opt.value)}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded text-sm font-medium transition-colors ${
                            form.payMethod === opt.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <i className={`fas ${opt.icon} ${form.payMethod === opt.value ? '' : opt.color}`}></i>
                          {opt.value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)}
                    className="border rounded px-3 py-2 w-full text-sm"
                    placeholder="Special requests, remarks..." />
                </div>

                {/* Amenities */}
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Add-on Amenities</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Pillow */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="fas fa-bed text-gray-500"></i>
                      <p className="text-sm font-medium text-gray-700">Pillow</p>
                      <span className="ml-auto text-xs text-gray-500">₱50 each</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => setField('pillow', Math.max(0, (Number(form.pillow) || 0) - 1))}
                        className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100 text-sm font-bold">−</button>
                      <span className="w-8 text-center text-sm font-medium">{form.pillow}</span>
                      <button type="button"
                        onClick={() => setField('pillow', Math.min(10, (Number(form.pillow) || 0) + 1))}
                        className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100 text-sm font-bold">+</button>
                      {form.pillow > 0 && (
                        <span className="ml-auto text-xs font-medium text-blue-700">₱{form.pillow * 50}</span>
                      )}
                    </div>
                  </div>
                  {/* Karaoke */}
                  <button type="button"
                    onClick={() => setField('karaoke', !form.karaoke)}
                    className={`border rounded-lg p-3 text-left transition-colors ${form.karaoke ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <i className={`fas fa-microphone ${form.karaoke ? 'text-indigo-600' : 'text-gray-400'}`}></i>
                      <p className={`text-sm font-medium ${form.karaoke ? 'text-indigo-700' : 'text-gray-700'}`}>Karaoke</p>
                    </div>
                    <p className="text-xs text-gray-500">₱800 flat</p>
                    {form.karaoke && <p className="text-xs font-medium text-indigo-700 mt-1">Added ✓</p>}
                  </button>
                </div>

                {/* Pricing preview */}
                <div className={`p-3 rounded text-sm mb-4 border ${isOvernight ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`font-semibold mb-2 ${isOvernight ? 'text-indigo-800' : 'text-blue-800'}`}>
                    <i className={`fas ${isOvernight ? 'fa-moon' : 'fa-sun'} mr-1`}></i>Booking Summary
                  </p>
                  <div className={`space-y-1 mb-2 ${isOvernight ? 'text-indigo-700' : 'text-blue-700'}`}>
                    <div className="flex justify-between">
                      <span>Check-in</span>
                      <span className="font-medium">
                        {isOvernight ? '6:00 PM' : DAY_TIME_SLOTS.find(t => t.value === form.time)?.label}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Check-out</span>
                      <span className="font-medium">
                        {isOvernight ? '6:00 AM (next day)' : fmtTime12(previewCheckOut)}
                      </span>
                    </div>
                    <hr className={`my-1 ${isOvernight ? 'border-indigo-200' : 'border-blue-200'}`} />
                    <div className="flex justify-between">
                      <span>{isOvernight ? 'Overnight rate' : 'Day visit rate'}</span>
                      <span>{fmtMoney(baseRate)}</span>
                    </div>
                    {previewExtraFee > 0 && (
                      <div className="flex justify-between">
                        <span>Extra guests ({previewGuests - pricing.free_guest_limit} × {fmtMoney(pricing.extra_guest_fee)})</span>
                        <span>{fmtMoney(previewExtraFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>
                        <i className="fas fa-ticket-alt mr-1 text-xs"></i>
                        Entrance fee ({previewGuests} × {fmtMoney(pricing.entrance_fee)})
                      </span>
                      <span>{fmtMoney(previewEntrance)}</span>
                    </div>
                    {form.pillow > 0 && (
                      <div className="flex justify-between">
                        <span><i className="fas fa-bed mr-1 text-xs"></i>Pillow × {form.pillow}</span>
                        <span>{fmtMoney(form.pillow * 50)}</span>
                      </div>
                    )}
                    {form.karaoke && (
                      <div className="flex justify-between">
                        <span><i className="fas fa-microphone mr-1 text-xs"></i>Karaoke</span>
                        <span>₱800.00</span>
                      </div>
                    )}
                  </div>
                  <div className={`flex justify-between font-bold border-t pt-2 ${isOvernight ? 'text-indigo-800 border-indigo-200' : 'text-blue-800 border-blue-200'}`}>
                    <span>Total Due</span>
                    <span>{fmtMoney(previewTotal)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => { setFormOpen(false); setFormError(''); }}
                    className="px-4 py-2 border rounded text-sm text-gray-700">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-60">
                    <i className="fas fa-plus mr-1"></i>
                    {submitting ? 'Creating...' : 'Create Walk-in Booking'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-gray-800">Walk-in Bookings</h1>
          <button
            onClick={() => { setFormOpen(true); setFormError(''); setForm({ ...EMPTY_FORM, date: today }); }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            <i className="fas fa-plus mr-2"></i>New Walk-in
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Today's Bookings</h2>
            <span className="text-sm text-gray-500">
              {new Date().toLocaleDateString('en-PH', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-gray-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading...
            </div>
          ) : todayBookings.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <i className="fas fa-calendar-day text-3xl mb-2 block"></i>
              <p>No bookings for today yet.</p>
              <button
                onClick={() => { setFormOpen(true); setFormError(''); setForm({ ...EMPTY_FORM, date: today }); }}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                <i className="fas fa-plus mr-2"></i>Create Walk-in
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['ID', 'Guest', 'Room', 'Time Slot', 'Guests', 'Total', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {todayBookings.map(b => (
                    <tr key={b.booking_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewWalkin(b)}>
                      <td className="px-4 py-3 text-xs text-gray-500">{b.id}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{walkInName(b)}</p>
                        {b.specialRequests?.startsWith('Walk-in:') && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.roomType}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {fmtDateTime(b.checkIn)}<br />
                        <span className="text-gray-400">→ {fmtDateTime(b.checkOut)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">{b.guests}</td>
                      <td className="px-4 py-3 text-sm">{fmtMoney(b.total)}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {b.status === 'Pending' && (
                            <button
                              onClick={() => handleStatus(b.booking_id, 'Confirmed')}
                              disabled={actionLoading === b.booking_id}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-40"
                            >Confirm</button>
                          )}
                          {b.status === 'Confirmed' && (
                            <button
                              onClick={() => handleStatus(b.booking_id, 'Completed')}
                              disabled={actionLoading === b.booking_id}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-40"
                            >Complete</button>
                          )}
                          {['Pending', 'Confirmed'].includes(b.status) && (
                            <button
                              onClick={() => handleStatus(b.booking_id, 'Cancelled')}
                              disabled={actionLoading === b.booking_id}
                              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-40"
                            >Cancel</button>
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
