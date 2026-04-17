import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Layout/Sidebar';
import { getFdBookings, collectPayment, downloadStaffReceipt } from '../../lib/frontdeskApi';
import Toast, { useToast } from '../../components/ui/Toast';
import { fmtMoney, fmtDate, fmtDateTime } from '../../lib/format';


// ─── helpers ──────────────────────────────────────────────────────────────────
const ENTRANCE_RATES = { day: 50, night: 80, '24hr': 100, '24hr-pm': 100 };

function calcEntrance(b) {
  // Use stored value if available (after check-in), otherwise compute from guests × rate
  if (b.entranceFee != null && Number(b.entranceFee) > 0) return Number(b.entranceFee);
  const rate = ENTRANCE_RATES[b.bookingType ?? 'day'] ?? 50;
  return (b.guests ?? 1) * rate;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }


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

function isExpiredPending(b) {
  if (b.status !== 'Pending') return false;
  if (b.fullyPaid) return false;
  const created = new Date(b.createdAt);
  return Date.now() - created.getTime() > 5 * 60 * 1000;
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
    Completed:    'bg-emerald-100 text-emerald-800',
    Cancelled:    'bg-rose-100 text-rose-800',
    Pending:      'bg-amber-100 text-amber-800',
    'Checked In': 'bg-violet-100 text-violet-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${cls[status] ?? 'bg-slate-100 text-slate-800'}`}>
      {status}
    </span>
  );
}

// ─── detail drawer ────────────────────────────────────────────────────────────
function BillingDetailDrawer({ booking: b, onClose, onCollect, onDownloadReceipt, downloading }) {
  if (!b) return null;

  const balanceDue = b.fullyPaid ? 0 : Math.max(0, Number(b.total ?? 0) - Number(b.reservationFee ?? 0));

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto z-40 border-l border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Billing Detail</h3>
            <p className="text-xs text-slate-400">{b.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl" aria-label="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 p-6 space-y-5">

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Status</span>
            <StatusBadge status={b.status} booking={b} />
          </div>

          {/* Guest info */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-1 text-sm">
            <p className="font-semibold text-slate-800 text-base">{b.guest}</p>
            <p className="text-slate-500">{b.roomType} · {b.guests} pax</p>
            <p className="text-slate-400 text-xs mt-1">
              {fmtDateTime(b.checkIn)} → {fmtDateTime(b.checkOut)}
            </p>
          </div>

          {/* Payment method */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Payment Method</span>
            <PayIcon method={b.paymentMethod} />
          </div>

          {/* Bill breakdown */}
          {(() => {
            const amenityTotal = (b.amenities ?? []).reduce((s, a) => s + Number(a.total ?? (a.unitPrice * a.qty) ?? 0), 0);
            const discount     = Number(b.discount ?? 0);
            const roomRate     = Number(b.total ?? 0) + discount - amenityTotal;
            const hasExtras    = amenityTotal > 0 || discount > 0;

            return (
              <div className="border rounded-lg overflow-hidden text-sm">
                {/* Room rate */}
                <div className="flex justify-between px-4 py-3 border-b bg-slate-50">
                  <span className="text-slate-500">Room Rate</span>
                  <span className="font-medium">{fmtMoney(roomRate)}</span>
                </div>

                {/* Add-ons */}
                {b.amenities?.length > 0 && b.amenities.map((a, i) => (
                  <div key={i} className="flex justify-between px-4 py-2.5 border-b text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <i className="fas fa-plus-circle text-xs text-slate-400"></i>
                      {a.name} × {a.qty}
                    </span>
                    <span>{fmtMoney(a.total ?? (a.unitPrice * a.qty))}</span>
                  </div>
                ))}

                {/* Promo discount */}
                {discount > 0 && (
                  <div className="flex justify-between px-4 py-2.5 border-b text-emerald-700">
                    <span className="flex items-center gap-1.5">
                      <i className="fas fa-tag text-xs"></i>
                      Promo{b.promoCode ? ` (${b.promoCode})` : ''}
                    </span>
                    <span>− {fmtMoney(discount)}</span>
                  </div>
                )}

                {/* Subtotal — only show when there are extras */}
                {hasExtras && (
                  <div className="flex justify-between px-4 py-3 border-b bg-slate-50 font-semibold text-slate-800">
                    <span>Total</span>
                    <span>{fmtMoney(b.total)}</span>
                  </div>
                )}

                {/* Reservation fee paid */}
                {Number(b.reservationFee ?? 0) > 0 && (
                  <div className="flex justify-between px-4 py-2.5 border-b text-emerald-700">
                    <span>Reservation Fee Paid</span>
                    <span>− {fmtMoney(b.reservationFee)}</span>
                  </div>
                )}

                {/* Balance / status row */}
                {b.status === 'Cancelled' ? (
                  <div className="flex justify-between px-4 py-3 bg-rose-50 text-rose-700 font-semibold">
                    <span>Forfeited (Non-refundable)</span>
                    <span>{fmtMoney(b.reservationFee ?? 0)}</span>
                  </div>
                ) : b.status === 'Completed' ? (
                  <div className="flex justify-between px-4 py-3 bg-emerald-50 text-emerald-700 font-semibold">
                    <span>Total Collected</span>
                    <span>{fmtMoney(b.total)}</span>
                  </div>
                ) : b.fullyPaid ? (
                  <div className="flex justify-between px-4 py-3 bg-emerald-50 text-emerald-700 font-semibold">
                    <span>Fully Paid</span>
                    <span>{fmtMoney(b.total)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between px-4 py-3 bg-sky-50 text-sky-800 font-bold text-base">
                    <span>Balance Due</span>
                    <span>{fmtMoney(balanceDue)}</span>
                  </div>
                )}

                {/* Entrance fee — always show (calculated from guests × rate if not yet stored) */}
                {(() => {
                  const ef = calcEntrance(b);
                  const rate = ENTRANCE_RATES[b.bookingType ?? 'day'] ?? 50;
                  return ef > 0 && (
                    <div className="flex justify-between px-4 py-2.5 border-t border-amber-100 bg-amber-50 text-amber-800 text-xs">
                      <span className="flex items-center gap-1.5">
                        <i className="fas fa-ticket-alt"></i>
                        Entrance Fee ({b.guests} pax × ₱{rate})
                      </span>
                      <span className="font-semibold">{fmtMoney(ef)}</span>
                    </div>
                  );
                })()}

                {/* Grand total */}
                <div className="flex justify-between px-4 py-3 bg-slate-800 text-white font-bold text-base">
                  <span>Grand Total</span>
                  <span>{fmtMoney(Number(b.total ?? 0) + calcEntrance(b))}</span>
                </div>
              </div>
            );
          })()}

          {/* Special requests */}
          {b.specialRequests && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Special Requests</p>
              <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded p-3">
                {b.specialRequests}
              </p>
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex gap-3">
          {b.status === 'Confirmed' && !b.fullyPaid && (
            <button
              onClick={() => onCollect(b)}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
            >
              <i className="fas fa-hand-holding-usd mr-2"></i>Collect Payment
            </button>
          )}
          {b.status === 'Confirmed' && b.fullyPaid && (
            <div className="flex-1 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium text-center">
              <i className="fas fa-check-circle mr-2"></i>Fully Paid Online
            </div>
          )}
          {b.status === 'Completed' && (
            <button
              onClick={() => onDownloadReceipt(b.bookingId)}
              disabled={downloading === b.bookingId}
              className="flex-1 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-60 transition"
            >
              <i className={`fas ${downloading === b.bookingId ? 'fa-spinner fa-spin' : 'fa-file-pdf'} mr-2`}></i>
              {downloading === b.bookingId ? 'Preparing...' : 'Download Receipt'}
            </button>
          )}
          {b.status === 'Cancelled' && (
            <p className="flex-1 text-center text-sm text-rose-600 py-2">
              <i className="fas fa-ban mr-1"></i>Booking cancelled — reservation fee forfeited
            </p>
          )}
          {b.status === 'Pending' && (
            <p className="flex-1 text-center text-sm text-amber-700 py-2">
              <i className="fas fa-clock mr-1"></i>Awaiting guest payment confirmation
            </p>
          )}
          <button onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition">
            Close
          </button>
        </div>
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────────
export default function Billing() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy,  setSortBy]  = useState('Time Slot');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(null);   // booking shown in detail drawer
  const [billing, setBilling]   = useState(null);   // booking in collect-payment modal
  const [payMethod, setPayMethod] = useState('Cash');
  const [paying, setPaying]     = useState(false);
  const [downloading, setDownloading] = useState(null); // bookingId being downloaded

  const [toast, showToast, clearToast, toastType] = useToast();

  useEffect(() => {
    getFdBookings()
      .then(data => { setBookings(data); setError(''); })
      .catch(() => setError('Failed to load billing data.'))
      .finally(() => setLoading(false));
  }, []);

  const today = todayStr();

  const todayAll = useMemo(() => bookings.filter(b =>
    b.checkIn?.slice(0, 10) === today ||
    (b.status === 'Cancelled' && b.updatedAt?.slice(0, 10) === today)
  ), [bookings, today]);

  const searchedTodayAll = useMemo(() => searchTerm.trim()
    ? todayAll.filter(b => {
        const term = searchTerm.trim().toLowerCase();
        return (b.guest ?? '').toLowerCase().includes(term)
          || (b.id ?? '').toLowerCase().includes(term)
          || (b.roomType ?? '').toLowerCase().includes(term);
      })
    : todayAll, [todayAll, searchTerm]);

  const sortedTodayAll = useMemo(() => [...searchedTodayAll].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === 'Booking ID') { aVal = a.id ?? '';             bVal = b.id ?? ''; }
    else if (sortBy === 'Guest')      { aVal = (a.guest ?? '').toLowerCase();      bVal = (b.guest ?? '').toLowerCase(); }
    else if (sortBy === 'Room')       { aVal = (a.roomType ?? '').toLowerCase();   bVal = (b.roomType ?? '').toLowerCase(); }
    else if (sortBy === 'Visit Rate') { aVal = Number(a.total ?? 0);               bVal = Number(b.total ?? 0); }
    else if (sortBy === 'Status')     { aVal = a.status ?? '';                     bVal = b.status ?? ''; }
    else { aVal = a.checkIn ?? ''; bVal = b.checkIn ?? ''; }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
    return 0;
  }), [searchedTodayAll, sortBy, sortDir]);

  // Bookings awaiting balance collection: Confirmed/Checked In that haven't been fully paid yet
  const { todayConfirmed, todayCompleted, todayCancelled, revenueToday } = useMemo(() => {
    const todayConfirmed  = todayAll.filter(b => (b.status === 'Confirmed' || b.status === 'Checked In') && !b.fullyPaid);
    const todayCompleted  = todayAll.filter(b => b.status === 'Completed');
    const todayCancelled  = todayAll.filter(b => b.status === 'Cancelled');
    const todayActive     = todayAll.filter(b => !['Cancelled', 'Pending'].includes(b.status));
    const revenueToday =
      todayActive.reduce((s, b) => s + Number(b.total ?? 0) + calcEntrance(b), 0) +
      todayCancelled.reduce((s, b) => s + Number(b.reservationFee ?? 0), 0);
    return { todayConfirmed, todayCompleted, todayCancelled, revenueToday };
  }, [todayAll]);

  async function handleCollect() {
    if (!billing) return;
    setPaying(true);
    try {
      await collectPayment(billing.bookingId, payMethod);
      setBookings(prev =>
        prev.map(b => b.bookingId === billing.bookingId
          ? { ...b, fullyPaid: true, paymentMethod: payMethod }
          : b)
      );
      setBilling(null);
      setSelected(null);
      showToast('Payment collected successfully!', 'success');
    } catch {
      showToast('Failed to collect payment. Please try again.', 'error');
    } finally {
      setPaying(false);
    }
  }

  async function handleDownloadReceipt(bookingId, resId) {
    setDownloading(bookingId);
    try {
      const blob = await downloadStaffReceipt(bookingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resId ?? bookingId}-receipt.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showToast('Failed to download receipt. Please try again.', 'error');
    } finally {
      setDownloading(null);
    }
  }

  function openCollect(b) {
    setSelected(null);
    setBilling(b);
    setPayMethod('Cash');
  }

  const balanceDue = billing ? (billing.fullyPaid ? 0 : Math.max(0, Number(billing.total) - Number(billing.reservationFee ?? 0))) : 0;

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <Helmet><title>Billing — Frontdesk</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* ── Detail Drawer ── */}
      <BillingDetailDrawer
        booking={selected}
        onClose={() => setSelected(null)}
        onCollect={openCollect}
        onDownloadReceipt={(id) => handleDownloadReceipt(id, selected?.id)}
        downloading={downloading}
      />

      {/* ── Payment Collection Modal ── */}
      {billing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Collect payment">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Collect Payment — {billing.id}</h3>
                <button onClick={() => setBilling(null)} className="text-slate-500 hover:text-slate-700" aria-label="Close">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Guest summary */}
              <div className="p-4 bg-slate-50 rounded mb-4 text-sm">
                <p className="font-medium text-slate-800">{billing.guest}</p>
                <p className="text-slate-600">{billing.roomType} · {billing.guests} pax</p>
                <p className="text-slate-500 text-xs mt-1">
                  {fmtDateTime(billing.checkIn)} → {fmtDateTime(billing.checkOut)}
                </p>
              </div>

              {/* Bill breakdown */}
              {(() => {
                const bAmenityTotal = (billing.amenities ?? []).reduce((s, a) => s + Number(a.total ?? (a.unitPrice * a.qty) ?? 0), 0);
                const bDiscount     = Number(billing.discount ?? 0);
                const bRoomRate     = Number(billing.total ?? 0) + bDiscount - bAmenityTotal;
                const bEntrance     = calcEntrance(billing);
                return (
                  <div className="border rounded mb-4 text-sm overflow-hidden">
                    <div className="flex justify-between px-4 py-2.5 border-b">
                      <span className="text-slate-600">Room Rate</span>
                      <span>{fmtMoney(bRoomRate)}</span>
                    </div>
                    {billing.amenities?.length > 0 && billing.amenities.map((a, i) => (
                      <div key={i} className="flex justify-between px-4 py-2 border-b text-slate-600">
                        <span>{a.name} × {a.qty}</span>
                        <span>{fmtMoney(a.total ?? (a.unitPrice * a.qty))}</span>
                      </div>
                    ))}
                    {bDiscount > 0 && (
                      <div className="flex justify-between px-4 py-2 border-b text-emerald-700">
                        <span><i className="fas fa-tag mr-1 text-xs"></i>Promo{billing.promoCode ? ` (${billing.promoCode})` : ''}</span>
                        <span>− {fmtMoney(bDiscount)}</span>
                      </div>
                    )}
                    {Number(billing.reservationFee ?? 0) > 0 && (
                      <div className="flex justify-between px-4 py-2.5 border-b text-emerald-700">
                        <span>Reservation Fee (paid online)</span>
                        <span>− {fmtMoney(billing.reservationFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-3 border-b font-semibold text-sky-800 text-base">
                      <span>Balance Due Now</span>
                      <span>{fmtMoney(balanceDue)}</span>
                    </div>
                    {bEntrance > 0 && (
                      <div className="flex justify-between px-4 py-2.5 border-b bg-amber-50 text-amber-800 text-xs">
                        <span className="flex items-center gap-1.5">
                          <i className="fas fa-ticket-alt"></i>
                          Entrance Fee ({billing.guests} pax × ₱{ENTRANCE_RATES[billing.bookingType ?? 'day'] ?? 50})
                        </span>
                        <span className="font-semibold">{fmtMoney(bEntrance)}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-3 bg-slate-800 text-white font-bold text-base">
                      <span>Grand Total</span>
                      <span>{fmtMoney(balanceDue + bEntrance)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Payment method */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <div className="flex gap-2">
                  {[
                    { value: 'Cash',  icon: 'fa-money-bill-wave', color: 'text-emerald-600' },
                    { value: 'GCash', icon: 'fa-mobile-alt',      color: 'text-sky-500'  },
                    { value: 'Maya',  icon: 'fa-mobile-alt',      color: 'text-emerald-500' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setPayMethod(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded text-sm font-medium transition-colors ${
                        payMethod === opt.value
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <i className={`fas ${opt.icon} ${payMethod === opt.value ? '' : opt.color}`}></i>
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setBilling(null)}
                  className="px-4 py-2 border rounded text-sm text-slate-700">
                  Cancel
                </button>
                <button onClick={handleCollect} disabled={paying}
                  className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-60">
                  <i className="fas fa-check mr-1"></i>
                  {paying ? 'Processing...' : `Collect ${fmtMoney(balanceDue + calcEntrance(billing))}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-5 flex items-center">
            <div className="p-3 rounded-full bg-sky-100 text-sky-600 mr-4">
              <i className="fas fa-file-invoice-dollar text-xl"></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm">Awaiting Collection</p>
              <h3 className="text-2xl font-bold">{loading ? '—' : todayConfirmed.length}</h3>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex items-center">
            <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 mr-4">
              <i className="fas fa-check-circle text-xl"></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm">Completed Today</p>
              <h3 className="text-2xl font-bold">{loading ? '—' : todayCompleted.length}</h3>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
              <i className="fas fa-peso-sign text-xl"></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm">Revenue Today</p>
              <h3 className="text-xl font-bold">
                {loading ? '—' : fmtMoney(revenueToday)}
              </h3>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        {/* Awaiting payment */}
        {!loading && todayConfirmed.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-sky-700">
              <i className="fas fa-exclamation-circle mr-2"></i>
              Awaiting Payment Collection ({todayConfirmed.length})
            </h2>
            <div className="space-y-3">
              {todayConfirmed.map(b => (
                <div key={b.bookingId}
                  onClick={() => setSelected(b)}
                  className="flex items-center justify-between p-4 border rounded-lg bg-sky-50 cursor-pointer hover:bg-sky-100 transition">
                  <div>
                    <p className="font-medium">{b.guest}</p>
                    <p className="text-sm text-slate-600">{b.roomType} · {b.guests} pax</p>
                    <p className="text-xs text-slate-500">
                      {fmtDateTime(b.checkIn)} → {fmtDateTime(b.checkOut)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Total to Collect</p>
                    <p className="font-bold text-sky-700 text-lg">
                      {fmtMoney(Math.max(0, Number(b.total) - Number(b.reservationFee ?? 0)) + calcEntrance(b))}
                    </p>
                    <button
                      onClick={e => { e.stopPropagation(); openCollect(b); }}
                      className="mt-2 px-4 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"
                    >
                      <i className="fas fa-hand-holding-usd mr-1"></i>Collect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full today's table */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <h2 className="text-lg font-semibold">Today's Billing Summary</h2>
            <input type="text" aria-label="Search bookings" placeholder="Search guest, ID, room…"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="ml-auto border border-slate-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading...
            </div>
          ) : todayAll.length === 0 ? (
            <p className="text-slate-400 text-center py-6">No bookings for today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[['Booking ID','Booking ID'],['Guest','Guest'],['Room','Room'],['Time Slot','Time Slot'],['Visit Rate','Visit Rate'],['Status','Status']].map(([label,key]) => (
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">To Collect</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedTodayAll.map(b => (
                    <tr key={b.bookingId}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelected(b)}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500">{b.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{b.guest}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{b.roomType}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {fmtDateTime(b.checkIn)}<br />
                        <span className="text-slate-400">→ {fmtDateTime(b.checkOut)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{fmtMoney(b.total)}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {b.status === 'Completed'
                          ? <span className="text-emerald-600"><i className="fas fa-check mr-1"></i>Collected</span>
                          : b.status === 'Cancelled'
                          ? <span className="text-rose-600"><i className="fas fa-ban mr-1"></i>Forfeited {fmtMoney(b.reservationFee ?? 0)}</span>
                          : b.fullyPaid
                          ? <span className="text-emerald-600"><i className="fas fa-check mr-1"></i>Paid</span>
                          : <span className="text-sky-700">{fmtMoney(Math.max(0, Number(b.total) - Number(b.reservationFee ?? 0)) + calcEntrance(b))}</span>
                        }
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {b.status === 'Confirmed' && !b.fullyPaid && (
                          <button
                            onClick={() => openCollect(b)}
                            className="px-3 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700"
                          >
                            Collect
                          </button>
                        )}
                        {b.status === 'Confirmed' && b.fullyPaid && (
                          <span className="text-xs text-emerald-600 font-medium"><i className="fas fa-check-circle mr-1"></i>Paid</span>
                        )}
                        {b.status === 'Completed' && (
                          <button
                            onClick={() => handleDownloadReceipt(b.bookingId, b.id)}
                            disabled={downloading === b.bookingId}
                            className="px-3 py-1 bg-sky-600 text-white rounded text-xs hover:bg-sky-700 disabled:opacity-60 flex items-center gap-1"
                          >
                            <i className={`fas ${downloading === b.bookingId ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
                            Receipt
                          </button>
                        )}
                        {b.status === 'Cancelled' && (
                          <span className="text-xs text-rose-500">
                            <i className="fas fa-ban mr-1"></i>Cancelled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 text-sm font-semibold">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-slate-600">Totals:</td>
                    <td className="px-4 py-3">
                      {fmtMoney(todayAll.filter(b => !['Cancelled', 'Pending'].includes(b.status)).reduce((s, b) => s + Number(b.total || 0) + calcEntrance(b), 0))}
                    </td>
                    <td className="px-4 py-3 text-emerald-700">
                      {fmtMoney(revenueToday)} earned
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </main>
    </Sidebar>
  );
}
