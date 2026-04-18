// src/frontdesk/components/BookingDetailModal.jsx
import { useState, useEffect } from 'react';
import {
  updateBookingStatus, checkInBooking, checkOutBooking,
  addAmenity, removeAmenity, downloadStaffReceipt, updateBookingGuests,
  getFdRooms, getFdBookings, transferRoom,
} from '../../lib/frontdeskApi';
import { api } from '../../lib/api';
import { applyPromoToBooking } from '../../lib/adminApi';
import { fmtDateTime, fmtMoney } from '../../lib/format';

// Entrance fee rates per adult — matches Setting::pricing() defaults.
// Fallback rates for pre-mount / offline render. Live rates come from
// /api/pricing and are passed in explicitly so staff never see stale
// numbers when the owner has updated the Settings. '24hr-pm' is kept
// for legacy bookings created before the flexible 24hr start-hour.
const FALLBACK_RATES = { day: 50, night: 80, '24hr': 100, '24hr-pm': 100 };

function entranceFeeForBooking(booking, rates = FALLBACK_RATES) {
  const type   = booking.bookingType ?? 'day';
  const rate   = rates[type] ?? FALLBACK_RATES[type] ?? 50;
  // Use stored DB value when available (after check-in/walk-in); otherwise compute expected
  const amount = (booking.entranceFee != null && Number(booking.entranceFee) > 0)
    ? Number(booking.entranceFee)
    : (booking.guests ?? 1) * rate;
  return { rate, amount };
}

// ─── helpers ──────────────────────────────────────────────────────────────────
// Gate on the backend-attributed `source` — special_requests is user-
// controlled on online bookings, so a guest could craft "Walk-in: …" to
// forge identity/contact display. `source` is derived server-side from
// reservation_fee + paymongo_link_id and can't be spoofed by payload.
function parseWalkIn(b) {
  if (b?.source !== 'walk-in') return null;
  if (!b.specialRequests?.startsWith('Walk-in:')) return null;
  const name  = (b.specialRequests.match(/^Walk-in:\s*([^,]+)/) || [])[1]?.trim() || b.guest;
  const phone = (b.specialRequests.match(/Phone:\s*([^,]+)/)    || [])[1]?.trim() || '—';
  const email = (b.specialRequests.match(/Email:\s*([^,]+)/)    || [])[1]?.trim() || '—';
  // Notes is the free-form guest request that the walk-in form appends.
  // Grab everything after "Notes:" so multi-comma notes aren't truncated.
  const notesMatch = b.specialRequests.match(/Notes:\s*(.+)$/);
  const notes = notesMatch?.[1]?.trim() || '';
  return { name, phone, email, notes };
}

function isExpiredPending(b) {
  if (!b || b.status !== 'Pending') return false;
  if (b.paymongoLinkId) return false; // payment session in progress — not expired
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  return new Date(b.createdAt) < fiveMinAgo;
}

function StatusBadge({ status, booking }) {
  if (status === 'Pending' && booking && isExpiredPending(booking)) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-rose-100 text-rose-700 flex items-center gap-1 w-fit">
        <i className="fas fa-times-circle text-[10px]"></i>Expired
      </span>
    );
  }
  const cls = {
    Confirmed:    'bg-sky-100 text-sky-800',
    'Checked In': 'bg-violet-100 text-violet-800',
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

function PayIcon({ method }) {
  const m = (method || '').toLowerCase();
  if (m === 'cash')
    return <span className="inline-flex items-center gap-1"><i className="fas fa-money-bill-wave text-emerald-600"></i> Cash</span>;
  if (m === 'gcash')
    return <span className="inline-flex items-center gap-1"><i className="fas fa-mobile-alt text-sky-500"></i> GCash</span>;
  if (m === 'maya' || m === 'paymaya')
    return <span className="inline-flex items-center gap-1"><i className="fas fa-mobile-alt text-emerald-500"></i> Maya</span>;
  return <span className="capitalize">{method || '—'}</span>;
}

// Addons fetched from API — see useEffect below

// ─── action configs ───────────────────────────────────────────────────────────
const ACTION_CONFIG = {
  'confirm-booking': {
    label:   'Confirm Booking',
    icon:    'fa-check',
    color:   'sky',
    heading: 'Confirm this reservation?',
    desc:    'This commits the reservation. The guest will be notified.',
  },
  checkin: {
    label:   'Check In Guest',
    icon:    'fa-door-open',
    color:   'violet',
    heading: 'Check in this guest?',
    desc:    'Ensure the balance and entrance fee have been collected before checking in.',
  },
  checkout: {
    label:   'Check Out Guest',
    icon:    'fa-sign-out-alt',
    color:   'emerald',
    heading: 'Check out this guest?',
    desc:    'This marks the booking as Completed. Make sure all charges are settled before proceeding.',
  },
  cancel: {
    label:   'Cancel Booking',
    icon:    'fa-ban',
    color:   'rose',
    heading: 'Cancel this booking?',
    desc:    'This cannot be undone. The reservation fee is non-refundable.',
  },
  'remove-amenity': {
    label:   'Remove Add-on',
    icon:    'fa-times',
    color:   'rose',
    heading: 'Remove this add-on?',
    desc:    'This will remove the item and adjust the booking total.',
  },
};

const COLOR = {
  sky:     { btn: 'bg-sky-600 hover:bg-sky-700',       banner: 'bg-sky-50 border-sky-200 text-sky-800'       },
  violet:  { btn: 'bg-violet-600 hover:bg-violet-700', banner: 'bg-violet-50 border-violet-200 text-violet-800' },
  emerald: { btn: 'bg-emerald-600 hover:bg-emerald-700', banner: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  rose:    { btn: 'bg-rose-600 hover:bg-rose-700',     banner: 'bg-rose-50 border-rose-200 text-rose-800'    },
};

/**
 * BookingDetailModal
 */
export default function BookingDetailModal({ booking: initialBooking, onClose, onUpdated, showToast }) {
  const [booking,       setBooking]       = useState(initialBooking);
  const [addonCatalog,     setAddonCatalog]     = useState([]);
  const [actionLoading,    setActionLoading]    = useState(false);
  const [addingAmenity,    setAddingAmenity]    = useState(null);
  // Live entrance rates from /api/pricing so the modal never displays or
  // sends stale hardcoded numbers after the owner updates pricing.
  const [entranceRates,    setEntranceRates]    = useState(FALLBACK_RATES);

  useEffect(() => {
    api.get('/api/addons')
      .then(r => setAddonCatalog(r.data?.data ?? []))
      .catch(() => {});
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
  const [amenityLoading,   setAmenityLoading]   = useState(false);
  const [receiptLoading,   setReceiptLoading]   = useState(false);
  const [guestEdit,        setGuestEdit]        = useState(false);
  const [guestCount,       setGuestCount]       = useState(initialBooking.guests ?? 1);
  const [guestLoading,     setGuestLoading]     = useState(false);
  const [promoInput,       setPromoInput]       = useState('');
  const [promoLoading,     setPromoLoading]     = useState(false);
  const [promoError,       setPromoError]       = useState('');
  // pendingAction: { type, amenityId?, amenityName?, amenityTotal? } | null
  const [pendingAction,    setPendingAction]    = useState(null);
  const [transferOpen,     setTransferOpen]     = useState(false);
  const [transferRoomId,   setTransferRoomId]   = useState('');
  const [transferring,     setTransferring]     = useState(false);
  const [rooms,            setRooms]            = useState([]);
  const [roomsLoading,     setRoomsLoading]     = useState(false);
  // All bookings — only fetched when the Transfer picker opens, so the
  // filter can count overlaps per target room against its quantity.
  const [allBookings,      setAllBookings]      = useState([]);

  function applyUpdate(updates) {
    const updated = { ...booking, ...updates };
    setBooking(updated);
    onUpdated?.(updated);
  }

  // ── actual executors ──────────────────────────────────────────────────────
  async function execAction() {
    if (!pendingAction) return;
    const { type, amenityId } = pendingAction;
    setPendingAction(null);
    setActionLoading(true);
    try {
      if (type === 'confirm-booking') {
        await updateBookingStatus(booking.bookingId, 'Confirmed');
        applyUpdate({ status: 'Confirmed' });
      } else if (type === 'checkin') {
        // Don't pass entrance_fee — the backend computes it from the
        // current Setting::pricing() rate so staff can't accidentally
        // persist a stale hardcoded amount that bypasses the owner's
        // pricing settings.
        const res = await checkInBooking(booking.bookingId);
        // Use the full formatted booking from the backend so paidAmount /
        // fullyPaid / entranceFee all stay in sync. Narrow-field spreads
        // here would leave those fields stale and mislead billing.
        applyUpdate(res.data ?? { status: 'Checked In', checkedInAt: res.checkedInAt, entranceFee: ef });
      } else if (type === 'checkout') {
        const res = await checkOutBooking(booking.bookingId);
        applyUpdate(res.data ?? { status: 'Completed', checkedOutAt: res.checkedOutAt });
      } else if (type === 'cancel') {
        await updateBookingStatus(booking.bookingId, 'Cancelled');
        applyUpdate({ status: 'Cancelled' });
      } else if (type === 'remove-amenity') {
        const res = await removeAmenity(booking.bookingId, amenityId);
        const newTotal = Number(res.newTotal);
        const updated  = {
          ...booking,
          amenities: (booking.amenities || []).filter(a => a.id !== amenityId),
          total: newTotal,
          fullyPaid: (typeof res.fullyPaid === 'boolean') ? res.fullyPaid : booking.fullyPaid,
          outstanding: (res.outstanding != null) ? Number(res.outstanding) : booking.outstanding,
        };
        setBooking(updated);
        onUpdated?.(updated);
      }
    } catch {
      showToast?.('Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateGuests() {
    if (guestCount === booking.guests) { setGuestEdit(false); return; }
    setGuestLoading(true);
    try {
      const res = await updateBookingGuests(booking.bookingId, guestCount);
      // Pull the full formatted booking from the response so entranceFee,
      // paidAmount, fullyPaid, and outstanding all reflect the backend's
      // recomputation (otherwise the billing breakdown stays stale).
      applyUpdate(res.data ?? { guests: res.guests });
      setGuestEdit(false);
      const freshEntrance = Number(res.data?.entranceFee ?? res.guests * (ENTRANCE_RATES[booking.bookingType ?? 'day'] ?? 50));
      showToast?.(`Guest count updated to ${res.guests}. Entrance fee: ${fmtMoney(freshEntrance)}.`);
    } catch {
      showToast?.('Failed to update guest count.');
    } finally {
      setGuestLoading(false);
    }
  }

  async function handleApplyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await applyPromoToBooking(booking.bookingId, promoInput.trim());
      const code = res.data.promo_code;
      applyUpdate({ promoCode: code, discount: res.data.discount, total: res.data.total });
      setPromoInput('');
      showToast?.(`Promo code "${code}" applied. Discount: ${fmtMoney(res.data.discount)}`);
    } catch (err) {
      setPromoError(err?.response?.data?.message || 'Invalid promo code.');
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleAddAmenity() {
    if (!addingAmenity?.name) return;
    setAmenityLoading(true);
    try {
      const res = await addAmenity(booking.bookingId, addingAmenity.name, addingAmenity.qty || 1);
      const newAmenity = res.data;
      const newTotal   = Number(res.newTotal);
      // Also pull the freshly-derived fullyPaid and outstanding from the
      // backend so the detail drawer reflects that adding a paid-up
      // amenity reopens the balance.
      const updated    = {
        ...booking,
        amenities: [...(booking.amenities || []), newAmenity],
        total: newTotal,
        fullyPaid: (typeof res.fullyPaid === 'boolean') ? res.fullyPaid : booking.fullyPaid,
        outstanding: (res.outstanding != null) ? Number(res.outstanding) : booking.outstanding,
      };
      setBooking(updated);
      onUpdated?.(updated);
      setAddingAmenity(null);
    } catch (err) {
      showToast?.(err?.response?.data?.message || 'Failed to add add-on.');
    } finally { setAmenityLoading(false); }
  }

  async function handleDownloadReceipt() {
    setReceiptLoading(true);
    try {
      const blob = await downloadStaffReceipt(booking.bookingId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${booking.id}-receipt.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast?.('Failed to download receipt.');
    } finally {
      setReceiptLoading(false);
    }
  }

  function openTransfer() {
    setTransferOpen(true);
    setTransferRoomId('');
    setRoomsLoading(true);
    // Also fetch the full bookings list so the transfer filter can
    // count overlapping stays per room and compare to room.quantity —
    // matches the safer check the main Reservation page uses and the
    // backend's transferRoom guard (which rejects when overlap count
    // >= quantity). Always refetch so stale cached data doesn't hide
    // newly-created conflicts.
    Promise.all([getFdRooms(), getFdBookings()])
      .then(([roomsData, bookingsData]) => {
        setRooms(roomsData);
        setAllBookings(bookingsData);
      })
      .catch(() => {})
      .finally(() => setRoomsLoading(false));
  }

  async function handleTransfer() {
    if (!transferRoomId) return;
    setTransferring(true);
    try {
      const res = await transferRoom(booking.bookingId, Number(transferRoomId));
      const newRoomName = rooms.find(r => String(r.id) === String(transferRoomId))?.name ?? res.room_name;
      applyUpdate({ roomType: newRoomName, roomId: Number(transferRoomId) });
      setTransferOpen(false);
      setTransferRoomId('');
      showToast?.(`Guest transferred to ${newRoomName}.`);
    } catch (err) {
      showToast?.(err?.response?.data?.message ?? 'Transfer failed. Room may be occupied.');
    } finally {
      setTransferring(false);
    }
  }

  const wi         = parseWalkIn(booking);
  const guestName  = wi ? wi.name  : booking.guest;
  const guestEmail = wi ? wi.email : (booking.guestEmail || '—');
  const guestPhone = wi ? wi.phone : (booking.guestPhone || '—');
  const balanceDue = Math.max(0, (booking.total || 0) - (booking.reservationFee || 0));

  const cfg   = pendingAction ? ACTION_CONFIG[pendingAction.type] : null;
  const clr   = cfg ? COLOR[cfg.color] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
         role="dialog" aria-modal="true" aria-label="Booking details"
         onMouseDown={e => e.target === e.currentTarget && !pendingAction && onClose()}>
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">

          {/* ── Confirmation Panel ── */}
          {pendingAction && cfg && (
            <div className={`mb-4 rounded-xl border p-4 ${clr.banner}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${clr.btn} text-white`}>
                  <i className={`fas ${cfg.icon} text-sm`}></i>
                </div>
                <div>
                  <p className="font-semibold text-sm">{cfg.heading}</p>
                  <p className="text-xs mt-0.5 opacity-80">{cfg.desc}</p>
                </div>
              </div>

              {/* Summary rows */}
              <div className="bg-white/60 rounded-lg px-3 py-2 text-xs space-y-1 mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking</span>
                  <span className="font-semibold">{booking.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Guest</span>
                  <span className="font-semibold">{guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Room</span>
                  <span className="font-semibold">{booking.roomType}</span>
                </div>
                {pendingAction.type === 'checkin' && (() => {
                  const { rate, amount } = entranceFeeForBooking(booking, entranceRates);
                  return (
                    <>
                      <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                        <span className="text-slate-500">Balance due (room)</span>
                        <span className="font-bold text-violet-700">{fmtMoney(balanceDue)}</span>
                      </div>
                      <div className="flex justify-between pt-0.5">
                        <span className="text-amber-600 flex items-center gap-1">
                          <i className="fas fa-ticket-alt text-[10px]"></i>
                          Entrance fee ({booking.guests ?? 1} pax × ₱{rate})
                        </span>
                        <span className="font-bold text-amber-700">{fmtMoney(amount)}</span>
                      </div>
                      <p className="text-amber-600 text-[10px] pt-0.5">Collect entrance fee at the gate — not in booking total.</p>
                    </>
                  );
                })()}
                {pendingAction.type === 'checkout' && (
                  <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                    <span className="text-slate-500">Total Amount</span>
                    <span className="font-bold text-emerald-700">{fmtMoney(booking.total)}</span>
                  </div>
                )}
                {pendingAction.type === 'remove-amenity' && (
                  <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                    <span className="text-slate-500">Item</span>
                    <span className="font-semibold">{pendingAction.amenityName} — {fmtMoney(pendingAction.amenityTotal)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPendingAction(null)}
                  className="flex-1 px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={execAction} disabled={actionLoading}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-60 ${clr.btn}`}>
                  {actionLoading
                    ? <><i className="fas fa-spinner fa-spin mr-1"></i>Processing...</>
                    : <><i className={`fas ${cfg.icon} mr-1`}></i>{cfg.label}</>}
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Booking — {booking.id}</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-700" aria-label="Close">
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Booking details grid */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded text-sm mb-4">
            <div>
              <p className="text-xs text-slate-500">Guest</p>
              <p className="font-medium">{guestName}</p>
              {wi && <span className="text-xs text-sky-600 bg-sky-50 px-1 rounded">Walk-in</span>}
            </div>
            <div><p className="text-xs text-slate-500">Status</p><StatusBadge status={booking.status} booking={booking} /></div>
            <div><p className="text-xs text-slate-500">Email</p><p>{guestEmail}</p></div>
            <div><p className="text-xs text-slate-500">Phone</p><p>{guestPhone}</p></div>
            <div><p className="text-xs text-slate-500">Room Type</p><p className="font-medium">{booking.roomType}</p></div>
            <div>
              <p className="text-xs text-slate-500">Guests</p>
              <p>{booking.guests} pax</p>
            </div>
            <div><p className="text-xs text-slate-500">Check-in</p><p>{fmtDateTime(booking.checkIn)}</p></div>
            <div><p className="text-xs text-slate-500">Check-out</p><p>{fmtDateTime(booking.checkOut)}</p></div>
            {booking.checkedInAt && (
              <div><p className="text-xs text-slate-500">Actual Check-in</p>
                <p className="text-violet-700 font-medium">{fmtDateTime(booking.checkedInAt)}</p></div>
            )}
            {booking.checkedOutAt && (
              <div><p className="text-xs text-slate-500">Actual Check-out</p>
                <p className="text-emerald-700 font-medium">{fmtDateTime(booking.checkedOutAt)}</p></div>
            )}
            <div>
              <p className="text-xs text-slate-500">Total Amount</p>
              <p className="font-semibold text-sky-700">{fmtMoney(booking.total)}</p>
            </div>
            <div><p className="text-xs text-slate-500">Payment Method</p><PayIcon method={booking.paymentMethod} /></div>
            {booking.promoCode && Number(booking.discount) > 0 && (
              <div className="col-span-2">
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-tag text-emerald-600 text-xs"></i>
                    <div>
                      <p className="text-xs text-emerald-700 font-semibold">Promo Applied</p>
                      <p className="text-sm font-mono font-bold text-emerald-800">{booking.promoCode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-700">Discount</p>
                    <p className="text-sm font-bold text-emerald-800">−{fmtMoney(booking.discount)}</p>
                  </div>
                </div>
              </div>
            )}
            {!['Completed','Cancelled'].includes(booking.status) && !booking.promoCode && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500 mb-1">Apply Promo Code</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                    placeholder="Enter promo code"
                    aria-label="Promo code"
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 font-mono uppercase"
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm rounded-lg disabled:opacity-50"
                  >
                    {promoLoading ? <i className="fas fa-spinner fa-spin"></i> : 'Apply'}
                  </button>
                </div>
                {promoError && <p className="text-xs text-rose-500 mt-1">{promoError}</p>}
              </div>
            )}
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Booked On</p>
              <p>{fmtDateTime(booking.createdAt)}</p>
            </div>
          </div>

          {/* Special requests — prominent callout so frontdesk staff can't
              miss guest-authored notes (e.g. allergies, early check-in,
              anniversary requests). Works for both regular and walk-in
              bookings (walk-in metadata lives in specialRequests as well,
              so we surface the Notes: slice only). */}
          {(() => {
            const note = wi ? wi.notes : booking.specialRequests;
            if (!note) return null;
            return (
              <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 flex gap-3 shadow-sm">
                <div className="shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                  <i className="fas fa-note-sticky text-amber-600" aria-hidden="true"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Special request from guest
                  </p>
                  <p className="mt-1 text-sm text-amber-900 whitespace-pre-wrap break-words">
                    {note}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Guest Count + Entrance Fee — shown for active bookings */}
          {['Pending', 'Confirmed', 'Checked In'].includes(booking.status) && (() => {
            const { rate, amount } = entranceFeeForBooking(booking, entranceRates);
            return (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
                {/* Guest count editor */}
                {['Confirmed', 'Checked In'].includes(booking.status) && (
                  <div className="px-4 py-3 flex items-center justify-between border-b border-amber-200">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-users text-amber-600"></i>
                      <span className="text-sm font-semibold text-amber-900">Number of Guests</span>
                    </div>
                    {guestEdit ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setGuestCount(g => Math.max(1, g - 1))}
                          className="w-11 h-11 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-base font-bold text-amber-800">−</button>
                        <span className="w-8 text-center font-bold text-lg text-amber-900">{guestCount}</span>
                        <button onClick={() => setGuestCount(g => g + 1)}
                          className="w-11 h-11 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-base font-bold text-amber-800">+</button>
                        <button onClick={handleUpdateGuests} disabled={guestLoading}
                          className="ml-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 disabled:opacity-50">
                          {guestLoading ? '…' : 'Save'}
                        </button>
                        <button onClick={() => { setGuestEdit(false); setGuestCount(booking.guests); }}
                          className="px-2 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg text-xs hover:bg-amber-100">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setGuestEdit(true); setGuestCount(booking.guests); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-medium text-amber-800 hover:bg-amber-100 transition">
                        <span className="font-bold text-lg">{booking.guests}</span>
                        <span className="text-xs">pax</span>
                        <i className="fas fa-pen text-xs text-amber-500 ml-1"></i>
                      </button>
                    )}
                  </div>
                )}
                {/* Entrance fee display */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-ticket-alt text-amber-500"></i>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Entrance Fee at Gate</p>
                      <p className="text-amber-700 text-xs">
                        {booking.guests ?? 1} pax × ₱{rate}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-amber-800 text-lg">{fmtMoney(amount)}</p>
                </div>
              </div>
            );
          })()}

          {/* Add-ons */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Add-ons</p>
            {(booking.amenities?.length ?? 0) === 0 ? (
              <p className="text-xs text-slate-400 mb-2">No add-ons added.</p>
            ) : (
              <div className="space-y-1 mb-2">
                {booking.amenities.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-slate-50 rounded px-3 py-2 text-sm">
                    <span>
                      <i className={`fas ${addonCatalog.find(c => c.name === a.name)?.icon || 'fa-tag'} mr-2 text-slate-500`}></i>
                      {a.name}{a.qty > 1 && ` × ${a.qty}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-xs">{fmtMoney(a.total)}</span>
                      {['Confirmed', 'Checked In'].includes(booking.status) && (
                        <button
                          onClick={() => setPendingAction({ type: 'remove-amenity', amenityId: a.id, amenityName: a.name, amenityTotal: a.total })}
                          disabled={amenityLoading}
                          className="text-rose-400 hover:text-rose-600 text-xs disabled:opacity-40"
                          title="Remove"
                         aria-label="Remove"><i className="fas fa-times"></i></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {['Confirmed', 'Checked In'].includes(booking.status) && addonCatalog.length > 0 && (
              addingAmenity ? (
                <div className="border rounded-lg p-3 bg-sky-50">
                  <p className="text-xs font-medium text-slate-700 mb-2">Add Add-on</p>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {addonCatalog.map(cat => (
                      <button key={cat.id} type="button"
                        onClick={() => setAddingAmenity({ id: cat.id, name: cat.name, qty: 1, unit_price: cat.price, per_booking: cat.per_booking, max_qty: cat.max_qty, icon: cat.icon })}
                        className={`flex-1 py-2 rounded border text-xs font-medium transition-colors ${
                          addingAmenity.name === cat.name
                            ? 'border-sky-500 bg-sky-100 text-sky-700'
                            : 'border-slate-300 bg-white text-slate-600'
                        }`}
                      >
                        <i className={`fas ${cat.icon || 'fa-tag'} mr-1`}></i>{cat.name}
                        <br /><span className="text-slate-400">₱{Number(cat.price).toLocaleString()}{!cat.per_booking ? '/ea' : ' flat'}</span>
                      </button>
                    ))}
                  </div>
                  {!addingAmenity.per_booking && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-slate-600">Qty:</span>
                      <button onClick={() => setAddingAmenity(a => ({ ...a, qty: Math.max(1, (a.qty || 1) - 1) }))}
                        className="w-11 h-11 border rounded text-sm">−</button>
                      <span className="w-6 text-center text-sm">{addingAmenity.qty}</span>
                      <button onClick={() => setAddingAmenity(a => ({ ...a, qty: Math.min(a.max_qty || 10, (a.qty || 1) + 1) }))}
                        className="w-11 h-11 border rounded text-sm">+</button>
                      <span className="ml-auto text-xs font-medium text-sky-700">
                        ₱{((addingAmenity.qty || 1) * addingAmenity.unitPrice).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setAddingAmenity(null)}
                      className="px-3 py-1 border rounded text-xs text-slate-600">Cancel</button>
                    <button onClick={handleAddAmenity} disabled={amenityLoading}
                      className="px-3 py-1 bg-sky-600 text-white rounded text-xs hover:bg-sky-700 disabled:opacity-40">
                      {amenityLoading ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const first = addonCatalog[0];
                    setAddingAmenity({ id: first.id, name: first.name, qty: 1, unit_price: first.price, per_booking: first.per_booking, max_qty: first.max_qty, icon: first.icon });
                  }}
                  className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1"
                >
                  <i className="fas fa-plus-circle"></i> Add add-on
                </button>
              )
            )}
          </div>

          {/* Transfer Room Panel */}
          {transferOpen && (
            <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                  <i className="fas fa-exchange-alt text-white text-xs"></i>
                </div>
                <div>
                  <p className="font-semibold text-sm text-violet-900">Transfer to Another Room</p>
                  <p className="text-xs text-violet-700">Currently in: <strong>{booking.roomType}</strong></p>
                </div>
              </div>
              {roomsLoading ? (
                <p className="text-xs text-violet-600"><i className="fas fa-spinner fa-spin mr-1"></i>Loading rooms...</p>
              ) : (() => {
                // Match the Reservation page / backend transferRoom guard:
                // count overlapping active stays per room id, then allow
                // the room only while count < room.quantity. Parse date
                // strings via .replace(' ', 'T') so Safari / strict engines
                // don't return Invalid Date on "YYYY-MM-DD HH:mm".
                const parseDT = (s) => new Date(String(s ?? '').replace(' ', 'T'));
                const transferStart = parseDT(booking.checkIn);
                const transferEnd   = parseDT(booking.checkOut);
                const overlapCounts = new Map();
                for (const b of allBookings) {
                  if (b.bookingId === booking.bookingId) continue;
                  if (['Cancelled', 'Completed'].includes(b.status)) continue;
                  const s = parseDT(b.checkIn);
                  const e = parseDT(b.checkOut);
                  if (isNaN(s.getTime()) || isNaN(e.getTime())) continue;
                  if (s < transferEnd && e > transferStart) {
                    overlapCounts.set(b.roomId, (overlapCounts.get(b.roomId) ?? 0) + 1);
                  }
                }
                const available = rooms.filter(r => {
                  if (String(r.id) === String(booking.roomId)) return false;
                  const taken = overlapCounts.get(r.id) ?? 0;
                  const qty   = Number(r.quantity ?? 1);
                  return taken < qty;
                });
                if (available.length === 0) {
                  return (
                    <p className="text-sm text-rose-700 mb-3">
                      No other rooms have free units for this time slot.
                    </p>
                  );
                }
                return (
                  <select value={transferRoomId} onChange={e => setTransferRoomId(e.target.value)}
                    aria-label="Transfer to room"
                    className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white">
                    <option value="">Select a room...</option>
                    {available.map(r => {
                      const qty   = Number(r.quantity ?? 1);
                      const taken = overlapCounts.get(r.id) ?? 0;
                      const free  = Math.max(0, qty - taken);
                      const suffix = qty > 1 ? ` — ${free} of ${qty} free` : '';
                      return (
                        <option key={r.id} value={r.id}>{r.name}{suffix}</option>
                      );
                    })}
                  </select>
                );
              })()}
              <div className="flex gap-2">
                <button onClick={() => { setTransferOpen(false); setTransferRoomId(''); }}
                  className="flex-1 px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={handleTransfer} disabled={!transferRoomId || transferring || roomsLoading}
                  className="flex-1 px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 disabled:opacity-60">
                  {transferring
                    ? <><i className="fas fa-spinner fa-spin mr-1"></i>Transferring...</>
                    : <><i className="fas fa-exchange-alt mr-1"></i>Confirm Transfer</>}
                </button>
              </div>
            </div>
          )}

          {/* Actions — hidden while confirmation is pending */}
          {!pendingAction && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              {/* Check In is only offered for Confirmed bookings — Pending
                  means payment hasn't been verified yet. Staff must collect
                  payment first (which moves the booking to Confirmed), then
                  check in. The backend enforces this too; this hides the
                  button so staff don't try the disallowed path. */}
              {booking.status === 'Confirmed' && !isExpiredPending(booking) && (
                <button onClick={() => setPendingAction({ type: 'checkin' })}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-violet-600 text-white rounded text-sm hover:bg-violet-700 disabled:opacity-50">
                  <i className="fas fa-door-open mr-1"></i>Check In
                </button>
              )}
              {booking.status === 'Checked In' && !transferOpen && (
                <button onClick={openTransfer}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-violet-600 text-white rounded text-sm hover:bg-violet-700 disabled:opacity-50">
                  <i className="fas fa-exchange-alt mr-1"></i>Transfer
                </button>
              )}
              {booking.status === 'Checked In' && (
                <button onClick={() => setPendingAction({ type: 'checkout' })}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-50">
                  <i className="fas fa-sign-out-alt mr-1"></i>Check Out
                </button>
              )}
              {booking.status === 'Pending' && !isExpiredPending(booking) && (
                <button onClick={() => setPendingAction({ type: 'cancel' })}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-rose-600 text-white rounded text-sm hover:bg-rose-700 disabled:opacity-50">
                  <i className="fas fa-times mr-1"></i>Cancel
                </button>
              )}
              {/* Receipt is available for any booking that has been paid to
                  some degree — Pending rows have no collected amounts yet,
                  so the PDF would be empty. Confirmed / Checked In /
                  Completed / Cancelled all have meaningful records. */}
              {booking.status !== 'Pending' && (
                <button onClick={handleDownloadReceipt} disabled={receiptLoading}
                  className="px-3 py-2 bg-sky-600 text-white rounded text-sm hover:bg-sky-700 disabled:opacity-50">
                  {receiptLoading
                    ? <><i className="fas fa-spinner fa-spin mr-1"></i>Downloading...</>
                    : <><i className="fas fa-file-pdf mr-1"></i>Receipt</>}
                </button>
              )}
              <button onClick={onClose}
                className="px-3 py-2 border rounded text-sm text-slate-700">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
