// src/frontdesk/components/BookingDetailModal.jsx
import { useState } from 'react';
import {
  updateBookingStatus, checkInBooking, checkOutBooking,
  addAmenity, removeAmenity, downloadStaffReceipt, updateBookingGuests,
} from '../../lib/frontdeskApi';

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt.replace(' ', 'T')).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}
function fmtMoney(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
function parseWalkIn(b) {
  if (!b?.specialRequests?.startsWith('Walk-in:')) return null;
  const name  = (b.specialRequests.match(/^Walk-in:\s*([^,]+)/) || [])[1]?.trim() || b.guest;
  const phone = (b.specialRequests.match(/Phone:\s*([^,]+)/)    || [])[1]?.trim() || '—';
  const email = (b.specialRequests.match(/Email:\s*([^,]+)/)    || [])[1]?.trim() || '—';
  return { name, phone, email };
}

function StatusBadge({ status }) {
  const cls = {
    Confirmed:    'bg-blue-100 text-blue-800',
    'Checked In': 'bg-purple-100 text-purple-800',
    Completed:    'bg-green-100 text-green-800',
    Cancelled:    'bg-red-100 text-red-800',
    Pending:      'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${cls[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function PayIcon({ method }) {
  const m = (method || '').toLowerCase();
  if (m === 'cash')
    return <span className="inline-flex items-center gap-1"><i className="fas fa-money-bill-wave text-green-600"></i> Cash</span>;
  if (m === 'gcash')
    return <span className="inline-flex items-center gap-1"><i className="fas fa-mobile-alt text-blue-500"></i> GCash</span>;
  if (m === 'maya' || m === 'paymaya')
    return <span className="inline-flex items-center gap-1"><i className="fas fa-mobile-alt text-green-500"></i> Maya</span>;
  return <span className="capitalize">{method || '—'}</span>;
}

const AMENITY_CATALOG = [
  { name: 'Pillow',  icon: 'fa-bed',        unit_price: 50,  type: 'qty'   },
  { name: 'Karaoke', icon: 'fa-microphone', unit_price: 800, type: 'fixed' },
];

// ─── action configs ───────────────────────────────────────────────────────────
const ACTION_CONFIG = {
  'confirm-booking': {
    label:   'Confirm Booking',
    icon:    'fa-check',
    color:   'blue',
    heading: 'Confirm this reservation?',
    desc:    'This commits the reservation. The guest will be notified.',
  },
  checkin: {
    label:   'Check In Guest',
    icon:    'fa-door-open',
    color:   'purple',
    heading: 'Check in this guest?',
    desc:    'This marks the guest as arrived. Ensure the balance has been collected.',
  },
  checkout: {
    label:   'Check Out Guest',
    icon:    'fa-sign-out-alt',
    color:   'green',
    heading: 'Check out this guest?',
    desc:    'This marks the booking as Completed. Make sure all charges are settled before proceeding.',
  },
  cancel: {
    label:   'Cancel Booking',
    icon:    'fa-ban',
    color:   'red',
    heading: 'Cancel this booking?',
    desc:    'This cannot be undone. The reservation fee is non-refundable.',
  },
  'remove-amenity': {
    label:   'Remove Add-on',
    icon:    'fa-times',
    color:   'red',
    heading: 'Remove this add-on?',
    desc:    'This will remove the item and adjust the booking total.',
  },
};

const COLOR = {
  blue:   { btn: 'bg-blue-600 hover:bg-blue-700',     banner: 'bg-blue-50 border-blue-200 text-blue-800'   },
  purple: { btn: 'bg-purple-600 hover:bg-purple-700', banner: 'bg-purple-50 border-purple-200 text-purple-800' },
  green:  { btn: 'bg-green-600 hover:bg-green-700',   banner: 'bg-green-50 border-green-200 text-green-800' },
  red:    { btn: 'bg-red-600 hover:bg-red-700',       banner: 'bg-red-50 border-red-200 text-red-800'      },
};

/**
 * BookingDetailModal
 */
export default function BookingDetailModal({ booking: initialBooking, onClose, onUpdated, showToast }) {
  const [booking,       setBooking]       = useState(initialBooking);
  const [actionLoading,    setActionLoading]    = useState(false);
  const [addingAmenity,    setAddingAmenity]    = useState(null);
  const [amenityLoading,   setAmenityLoading]   = useState(false);
  const [receiptLoading,   setReceiptLoading]   = useState(false);
  const [guestEdit,        setGuestEdit]        = useState(false);
  const [guestCount,       setGuestCount]       = useState(initialBooking.guests ?? 1);
  const [guestLoading,     setGuestLoading]     = useState(false);
  // pendingAction: { type, amenityId?, amenityName?, amenityTotal? } | null
  const [pendingAction,    setPendingAction]    = useState(null);

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
        await updateBookingStatus(booking.booking_id, 'Confirmed');
        applyUpdate({ status: 'Confirmed' });
      } else if (type === 'checkin') {
        const res = await checkInBooking(booking.booking_id);
        applyUpdate({ status: 'Checked In', checkedInAt: res.checked_in_at });
      } else if (type === 'checkout') {
        const res = await checkOutBooking(booking.booking_id);
        applyUpdate({ status: 'Completed', checkedOutAt: res.checked_out_at });
      } else if (type === 'cancel') {
        await updateBookingStatus(booking.booking_id, 'Cancelled');
        applyUpdate({ status: 'Cancelled' });
      } else if (type === 'remove-amenity') {
        const res = await removeAmenity(booking.booking_id, amenityId);
        applyUpdate({
          amenities: (booking.amenities || []).filter(a => a.id !== amenityId),
          total: res.new_total,
        });
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
      const res = await updateBookingGuests(booking.booking_id, guestCount);
      applyUpdate({ guests: res.guests, total: res.total });
      setGuestEdit(false);
      showToast?.(`Guest count updated to ${res.guests}. New total: ${fmtMoney(res.total)}`);
    } catch {
      showToast?.('Failed to update guest count.');
    } finally {
      setGuestLoading(false);
    }
  }

  async function handleAddAmenity() {
    if (!addingAmenity?.name) return;
    setAmenityLoading(true);
    try {
      const res = await addAmenity(booking.booking_id, addingAmenity.name, addingAmenity.qty || 1);
      applyUpdate({
        amenities: [...(booking.amenities || []), res.data],
        total: res.new_total,
      });
      setAddingAmenity(null);
    } catch (err) {
      showToast?.(err?.response?.data?.message || 'Failed to add amenity.');
    } finally { setAmenityLoading(false); }
  }

  async function handleDownloadReceipt() {
    setReceiptLoading(true);
    try {
      const blob = await downloadStaffReceipt(booking.booking_id);
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

  const wi         = parseWalkIn(booking);
  const guestName  = wi ? wi.name  : booking.guest;
  const guestEmail = wi ? wi.email : (booking.guest_email || '—');
  const guestPhone = wi ? wi.phone : (booking.guest_phone || '—');
  const balanceDue = Math.max(0, (booking.total || 0) - (booking.reservation_fee || 0));

  const cfg   = pendingAction ? ACTION_CONFIG[pendingAction.type] : null;
  const clr   = cfg ? COLOR[cfg.color] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
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
                  <span className="text-gray-500">Booking</span>
                  <span className="font-semibold">{booking.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Guest</span>
                  <span className="font-semibold">{guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Room</span>
                  <span className="font-semibold">{booking.roomType}</span>
                </div>
                {pendingAction.type === 'checkout' && (
                  <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                    <span className="text-gray-500">Total Amount</span>
                    <span className="font-bold text-green-700">{fmtMoney(booking.total)}</span>
                  </div>
                )}
                {pendingAction.type === 'remove-amenity' && (
                  <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                    <span className="text-gray-500">Item</span>
                    <span className="font-semibold">{pendingAction.amenityName} — {fmtMoney(pendingAction.amenityTotal)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPendingAction(null)}
                  className="flex-1 px-3 py-2 border border-gray-300 bg-white rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">
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
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Booking details grid */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded text-sm mb-4">
            <div>
              <p className="text-xs text-gray-500">Guest</p>
              <p className="font-medium">{guestName}</p>
              {wi && <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded">Walk-in</span>}
            </div>
            <div><p className="text-xs text-gray-500">Status</p><StatusBadge status={booking.status} /></div>
            <div><p className="text-xs text-gray-500">Email</p><p>{guestEmail}</p></div>
            <div><p className="text-xs text-gray-500">Phone</p><p>{guestPhone}</p></div>
            <div><p className="text-xs text-gray-500">Room Type</p><p className="font-medium">{booking.roomType}</p></div>
            <div>
              <p className="text-xs text-gray-500">Guests</p>
              {guestEdit ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <button onClick={() => setGuestCount(g => Math.max(1, g - 1))}
                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-sm font-bold">−</button>
                  <span className="w-6 text-center font-medium">{guestCount}</span>
                  <button onClick={() => setGuestCount(g => g + 1)}
                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-sm font-bold">+</button>
                  <button onClick={handleUpdateGuests} disabled={guestLoading}
                    className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                    {guestLoading ? '…' : 'Save'}
                  </button>
                  <button onClick={() => { setGuestEdit(false); setGuestCount(booking.guests); }}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p>{booking.guests} pax</p>
                  {['Confirmed', 'Checked In'].includes(booking.status) && (
                    <button onClick={() => { setGuestEdit(true); setGuestCount(booking.guests); }}
                      className="text-xs text-blue-600 hover:underline">
                      <i className="fas fa-user-plus mr-0.5"></i>Edit
                    </button>
                  )}
                </div>
              )}
            </div>
            <div><p className="text-xs text-gray-500">Check-in</p><p>{fmtDateTime(booking.checkIn)}</p></div>
            <div><p className="text-xs text-gray-500">Check-out</p><p>{fmtDateTime(booking.checkOut)}</p></div>
            {booking.checkedInAt && (
              <div><p className="text-xs text-gray-500">Actual Check-in</p>
                <p className="text-purple-700 font-medium">{fmtDateTime(booking.checkedInAt)}</p></div>
            )}
            {booking.checkedOutAt && (
              <div><p className="text-xs text-gray-500">Actual Check-out</p>
                <p className="text-green-700 font-medium">{fmtDateTime(booking.checkedOutAt)}</p></div>
            )}
            <div>
              <p className="text-xs text-gray-500">Total Amount</p>
              <p className="font-semibold text-blue-700">{fmtMoney(booking.total)}</p>
            </div>
            <div><p className="text-xs text-gray-500">Payment Method</p><PayIcon method={booking.paymentMethod} /></div>
            {booking.promo_code && Number(booking.discount) > 0 && (
              <div className="col-span-2">
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-tag text-green-600 text-xs"></i>
                    <div>
                      <p className="text-xs text-green-700 font-semibold">Promo Applied</p>
                      <p className="text-sm font-mono font-bold text-green-800">{booking.promo_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-green-700">Discount</p>
                    <p className="text-sm font-bold text-green-800">−{fmtMoney(booking.discount)}</p>
                  </div>
                </div>
              </div>
            )}
            {!wi && booking.specialRequests && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Special Requests</p>
                <p className="italic text-gray-700">{booking.specialRequests}</p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Booked On</p>
              <p>{fmtDateTime(booking.createdAt)}</p>
            </div>
          </div>

          {/* Amenities */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Amenities</p>
            {(booking.amenities?.length ?? 0) === 0 ? (
              <p className="text-xs text-gray-400 mb-2">No amenities added.</p>
            ) : (
              <div className="space-y-1 mb-2">
                {booking.amenities.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                    <span>
                      <i className={`fas ${a.name === 'Karaoke' ? 'fa-microphone' : 'fa-bed'} mr-2 text-gray-500`}></i>
                      {a.name}{a.qty > 1 && ` × ${a.qty}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs">{fmtMoney(a.total)}</span>
                      {['Confirmed', 'Checked In'].includes(booking.status) && (
                        <button
                          onClick={() => setPendingAction({ type: 'remove-amenity', amenityId: a.id, amenityName: a.name, amenityTotal: a.total })}
                          disabled={amenityLoading}
                          className="text-red-400 hover:text-red-600 text-xs disabled:opacity-40"
                          title="Remove"
                        ><i className="fas fa-times"></i></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {['Confirmed', 'Checked In'].includes(booking.status) && (
              addingAmenity ? (
                <div className="border rounded-lg p-3 bg-blue-50">
                  <p className="text-xs font-medium text-gray-700 mb-2">Add Amenity</p>
                  <div className="flex gap-2 mb-2">
                    {AMENITY_CATALOG.map(cat => (
                      <button key={cat.name} type="button"
                        onClick={() => setAddingAmenity({ name: cat.name, qty: 1 })}
                        className={`flex-1 py-2 rounded border text-xs font-medium transition-colors ${
                          addingAmenity.name === cat.name
                            ? 'border-blue-500 bg-blue-100 text-blue-700'
                            : 'border-gray-300 bg-white text-gray-600'
                        }`}
                      >
                        <i className={`fas ${cat.icon} mr-1`}></i>{cat.name}
                        <br /><span className="text-gray-400">₱{cat.unit_price}{cat.type === 'qty' ? '/ea' : ' flat'}</span>
                      </button>
                    ))}
                  </div>
                  {addingAmenity.name === 'Pillow' && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-600">Qty:</span>
                      <button onClick={() => setAddingAmenity(a => ({ ...a, qty: Math.max(1, (a.qty || 1) - 1) }))}
                        className="w-6 h-6 border rounded text-xs">−</button>
                      <span className="w-6 text-center text-sm">{addingAmenity.qty}</span>
                      <button onClick={() => setAddingAmenity(a => ({ ...a, qty: Math.min(10, (a.qty || 1) + 1) }))}
                        className="w-6 h-6 border rounded text-xs">+</button>
                      <span className="ml-auto text-xs font-medium text-blue-700">
                        ₱{(addingAmenity.qty || 1) * 50}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setAddingAmenity(null)}
                      className="px-3 py-1 border rounded text-xs text-gray-600">Cancel</button>
                    <button onClick={handleAddAmenity} disabled={amenityLoading}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-40">
                      {amenityLoading ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingAmenity({ name: 'Pillow', qty: 1 })}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <i className="fas fa-plus-circle"></i> Add amenity
                </button>
              )
            )}
          </div>

          {/* Actions — hidden while confirmation is pending */}
          {!pendingAction && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              {['Pending', 'Confirmed'].includes(booking.status) && (
                <button onClick={() => setPendingAction({ type: 'checkin' })}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50">
                  <i className="fas fa-door-open mr-1"></i>Check In
                </button>
              )}
              {booking.status === 'Checked In' && (
                <button onClick={() => setPendingAction({ type: 'checkout' })}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
                  <i className="fas fa-sign-out-alt mr-1"></i>Check Out
                </button>
              )}
              {booking.status === 'Pending' && (
                <button onClick={() => setPendingAction({ type: 'cancel' })}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                  <i className="fas fa-times mr-1"></i>Cancel
                </button>
              )}
              {booking.status === 'Completed' && (
                <button onClick={handleDownloadReceipt} disabled={receiptLoading}
                  className="px-3 py-2 bg-sky-600 text-white rounded text-sm hover:bg-sky-700 disabled:opacity-50">
                  {receiptLoading
                    ? <><i className="fas fa-spinner fa-spin mr-1"></i>Downloading...</>
                    : <><i className="fas fa-file-pdf mr-1"></i>Receipt</>}
                </button>
              )}
              <button onClick={onClose}
                className="px-3 py-2 border rounded text-sm text-gray-700">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
