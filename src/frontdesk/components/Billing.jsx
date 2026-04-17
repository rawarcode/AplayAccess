import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Layout/Sidebar';
import { getFdBookings, collectPayment, downloadStaffReceipt } from '../../lib/frontdeskApi';
import { api } from '../../lib/api';
import Toast, { useToast } from '../../components/ui/Toast';
import { fmtMoney, fmtDate, fmtDateTime, localDateStr } from '../../lib/format';


// ─── helpers ──────────────────────────────────────────────────────────────────
// '24hr-pm' is kept for legacy bookings created before the flexible 24hr
// start-hour; new bookings only use '24hr'. Priced the same as '24hr'.
const FALLBACK_RATES = { day: 50, night: 80, '24hr': 100, '24hr-pm': 100 };

function calcEntrance(b, entranceRates = FALLBACK_RATES) {
  // Use stored value if available (after check-in), otherwise compute from guests × rate
  if (b.entranceFee != null && Number(b.entranceFee) > 0) return Number(b.entranceFee);
  const rate = entranceRates[b.bookingType ?? 'day'] ?? 50;
  return (b.guests ?? 1) * rate;
}

const todayStr = () => localDateStr();


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
function BillingDetailDrawer({ booking: b, onClose, onCollect, onDownloadReceipt, downloading, entranceRates }) {
  if (!b) return null;

  // Grand total = current room total + current entrance fee. Paid so far
  // comes from the backend (paidAmount — maintained across payments + fee
  // changes). Outstanding is what still needs to be collected at the counter.
  const entranceNow = calcEntrance(b, entranceRates);
  const grandTotal  = Number(b.total ?? 0) + entranceNow;
  const paidSoFar   = Number(b.paidAmount ?? 0);
  const outstanding = Math.max(0, grandTotal - paidSoFar);
  const balanceDue  = outstanding; // legacy alias, kept so downstream JSX reads naturally

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

                {/* Entrance fee line (calculated from guests × rate; stored value takes precedence after check-in) */}
                {(() => {
                  const rate = entranceRates[b.bookingType ?? 'day'] ?? 50;
                  return entranceNow > 0 && (
                    <div className="flex justify-between px-4 py-2.5 border-t border-amber-100 bg-amber-50 text-amber-800 text-xs">
                      <span className="flex items-center gap-1.5">
                        <i className="fas fa-ticket-alt"></i>
                        Entrance Fee ({b.guests} pax × ₱{rate})
                      </span>
                      <span className="font-semibold">{fmtMoney(entranceNow)}</span>
                    </div>
                  );
                })()}

                {/* Grand total */}
                <div className="flex justify-between px-4 py-3 bg-slate-800 text-white font-bold text-base">
                  <span>Grand Total</span>
                  <span>{fmtMoney(grandTotal)}</span>
                </div>

                {/* Paid so far / outstanding — status line */}
                {b.status === 'Cancelled' ? (
                  <div className="flex justify-between px-4 py-3 bg-rose-50 text-rose-700 font-semibold">
                    <span>Forfeited (Non-refundable)</span>
                    <span>{fmtMoney(b.reservationFee ?? 0)}</span>
                  </div>
                ) : (
                  <>
                    {paidSoFar > 0 && (
                      <div className="flex justify-between px-4 py-2.5 border-t text-emerald-700">
                        <span>Paid so far</span>
                        <span>− {fmtMoney(paidSoFar)}</span>
                      </div>
                    )}
                    {outstanding > 0 ? (
                      <div className="flex justify-between px-4 py-3 bg-sky-50 text-sky-800 font-bold text-base">
                        <span>Outstanding Balance</span>
                        <span>{fmtMoney(outstanding)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between px-4 py-3 bg-emerald-50 text-emerald-700 font-semibold">
                        <span>{b.status === 'Completed' ? 'Total Collected' : 'Fully Paid'}</span>
                        <span>{fmtMoney(paidSoFar)}</span>
                      </div>
                    )}
                  </>
                )}
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
          {/* Receipt — available for any booking with collected money
              (Confirmed / Checked In / Completed / Cancelled). Sits next
              to the primary action so staff can reprint receipts inline
              without leaving the billing drawer. */}
          {b.status !== 'Pending' && (
            <button
              onClick={() => onDownloadReceipt(b.bookingId)}
              disabled={downloading === b.bookingId}
              className={`py-2.5 ${b.status === 'Completed' ? 'flex-1' : 'px-4'} bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-60 transition`}
              title="Download receipt (PDF)"
            >
              <i className={`fas ${downloading === b.bookingId ? 'fa-spinner fa-spin' : 'fa-file-pdf'} mr-2`}></i>
              {downloading === b.bookingId
                ? 'Preparing...'
                : b.status === 'Completed' ? 'Download Receipt' : 'Receipt'}
            </button>
          )}
          {b.status === 'Cancelled' && (
            <p className="flex-1 text-center text-sm text-rose-600 py-2">
              <i className="fas fa-ban mr-1"></i>Reservation fee forfeited
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
  const [entranceRates, setEntranceRates] = useState(FALLBACK_RATES);

  useEffect(() => {
    function loadBookings(initial = false) {
      getFdBookings()
        .then(data => { setBookings(data); setError(''); })
        .catch(() => setError('Failed to load billing data.'))
        .finally(() => { if (initial) setLoading(false); });
    }
    loadBookings(true);
    // Poll every 20s so guest-count / amenity edits from Reservation or
    // WalkIn pages reflect here without the user reopening the drawer.
    const id = setInterval(() => loadBookings(false), 20_000);


    api.get('/api/pricing')
      .then(r => {
        const d = r.data?.data;
        if (d) setEntranceRates({
          day:      Number(d.entrance_fee_day   ?? 50),
          night:    Number(d.entrance_fee_night  ?? 80),
          '24hr':   Number(d.entrance_fee_24hr   ?? 100),
          '24hr-pm': Number(d.entrance_fee_24hr  ?? 100),
        });
      })
      .catch(() => {});
    return () => clearInterval(id);
  }, []);

  // Keep the open detail drawer / payment modal in sync with the polled
  // bookings list — if guest count or amenities change elsewhere, the
  // currently-open booking should reflect the new amounts immediately.
  useEffect(() => {
    setSelected(prev => prev ? (bookings.find(b => b.bookingId === prev.bookingId) ?? null) : prev);
    setBilling(prev  => prev ? (bookings.find(b => b.bookingId === prev.bookingId) ?? null) : prev);
  }, [bookings]);

  const today = todayStr();

  // Which bookings count as "today's billing"?
  //   - Any booking with a check-in date of today (past, present, or future that day)
  //   - Any Checked-In booking regardless of when it started — the guest is
  //     still here, balance may still be outstanding, and staff needs it
  //     visible past midnight (a 24hr stay that started at 11:50 PM yesterday
  //     shouldn't disappear from billing at 12:01 AM).
  //   - Confirmed bookings whose check-out window is still open (similar
  //     reasoning — active reservations shouldn't fall off overnight).
  //   - Bookings that completed or were cancelled today (recent history).
  const todayAll = useMemo(() => bookings.filter(b => {
    if (b.checkIn?.slice(0, 10) === today) return true;
    if (b.status === 'Checked In') return true;
    if (b.status === 'Confirmed' && b.checkOut) {
      const co = new Date(String(b.checkOut).replace(' ', 'T'));
      if (!isNaN(co.getTime()) && co > new Date()) return true;
    }
    if (b.status === 'Completed' && b.checkedOutAt?.slice(0, 10) === today) return true;
    if (b.status === 'Cancelled' && b.updatedAt?.slice(0, 10) === today) return true;
    return false;
  }), [bookings, today]);

  // When there's a search term, widen the search across ALL bookings
  // (not just today's). This lets staff find past billings to review
  // details or reprint a receipt without leaving the Billing page.
  // Without a term, the view stays scoped to today + in-progress stays.
  const isSearching = searchTerm.trim().length > 0;
  const searchedTodayAll = useMemo(() => {
    if (!isSearching) return todayAll;
    const term = searchTerm.trim().toLowerCase();
    return bookings.filter(b =>
      (b.guest ?? '').toLowerCase().includes(term)
        || (b.id ?? '').toLowerCase().includes(term)
        || (b.roomType ?? '').toLowerCase().includes(term)
        || (b.guestEmail ?? '').toLowerCase().includes(term)
        || (b.guestPhone ?? '').includes(term.replace(/\s/g, ''))
    );
  }, [bookings, todayAll, searchTerm, isSearching]);

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

  // Bookings awaiting balance collection: Confirmed/Checked In with any
  // outstanding balance. Using outstanding (derived from paidAmount) means
  // a booking that was fully paid, then had extra guests added, correctly
  // shows up here again.
  const { todayConfirmed, todayCompleted, todayCancelled, revenueToday } = useMemo(() => {
    const outstandingFor = b =>
      Math.max(0, Number(b.total ?? 0) + calcEntrance(b, entranceRates) - Number(b.paidAmount ?? 0));
    const todayConfirmed  = todayAll.filter(b => (b.status === 'Confirmed' || b.status === 'Checked In') && outstandingFor(b) > 0);
    const todayCompleted  = todayAll.filter(b => b.status === 'Completed');
    const todayCancelled  = todayAll.filter(b => b.status === 'Cancelled');
    // Revenue = paid_amount (backend-maintained single source of truth).
    const revenueToday = todayAll.reduce((s, b) => s + Number(b.paidAmount ?? 0), 0);
    return { todayConfirmed, todayCompleted, todayCancelled, revenueToday };
  }, [todayAll, entranceRates]);

  async function handleCollect() {
    if (!billing) return;
    setPaying(true);
    try {
      const ef = calcEntrance(billing, entranceRates);
      await collectPayment(billing.bookingId, payMethod, ef);
      // Optimistically mark fully paid and bring paidAmount up to the new
      // grand total so the UI updates without waiting on the next 20s poll.
      setBookings(prev =>
        prev.map(b => b.bookingId === billing.bookingId
          ? { ...b, fullyPaid: true, paymentMethod: payMethod, entranceFee: ef, paidAmount: Number(b.total ?? 0) + ef }
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

  // Outstanding for the collect-payment modal = grand total - paid_amount.
  // Uses backend-maintained paidAmount so it correctly reflects staged
  // collections (reservation fee online, then balance + entrance at the
  // counter, then deltas when fees change post-payment).
  const billingEntrance   = billing ? calcEntrance(billing, entranceRates) : 0;
  const billingGrandTotal = billing ? Number(billing.total ?? 0) + billingEntrance : 0;
  const billingPaidSoFar  = billing ? Number(billing.paidAmount ?? 0) : 0;
  const billingOutstanding = Math.max(0, billingGrandTotal - billingPaidSoFar);

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
        entranceRates={entranceRates}
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
                    {billingEntrance > 0 && (
                      <div className="flex justify-between px-4 py-2.5 border-b bg-amber-50 text-amber-800 text-xs">
                        <span className="flex items-center gap-1.5">
                          <i className="fas fa-ticket-alt"></i>
                          Entrance Fee ({billing.guests} pax × ₱{entranceRates[billing.bookingType ?? 'day'] ?? 50})
                        </span>
                        <span className="font-semibold">{fmtMoney(billingEntrance)}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-3 bg-slate-800 text-white font-bold text-base">
                      <span>Grand Total</span>
                      <span>{fmtMoney(billingGrandTotal)}</span>
                    </div>
                    {billingPaidSoFar > 0 && (
                      <div className="flex justify-between px-4 py-2.5 border-t text-emerald-700">
                        <span>Paid so far</span>
                        <span>− {fmtMoney(billingPaidSoFar)}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-3 bg-sky-600 text-white font-bold text-base">
                      <span>Collect Now</span>
                      <span>{fmtMoney(billingOutstanding)}</span>
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
                  {paying ? 'Processing...' : `Collect ${fmtMoney(billingOutstanding)}`}
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
                      {fmtMoney(Math.max(0, Number(b.total ?? 0) + calcEntrance(b, entranceRates) - Number(b.paidAmount ?? 0)))}
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

        {/* Full today's table — becomes a "search all" view when a term is entered */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div>
              <h2 className="text-lg font-semibold">
                {isSearching ? 'Search Results' : "Today's Billing Summary"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSearching
                  ? <>Searching across <strong>all bookings</strong>, including past. Clear to return to today.</>
                  : <>Today + in-progress stays. Type a name / ID / room to search past billings.</>}
              </p>
            </div>
            <div className="ml-auto relative">
              <input type="text" aria-label="Search bookings" placeholder="Search guest, ID, room, email, phone…"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-sky-400" />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              {isSearching && (
                <button type="button" onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  aria-label="Clear search" title="Clear search">
                  <i className="fas fa-times-circle text-xs"></i>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading...
            </div>
          ) : isSearching && searchedTodayAll.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <i className="fas fa-search text-2xl mb-2 block opacity-50"></i>
              <p>No bookings match "<strong>{searchTerm}</strong>".</p>
              <button type="button" onClick={() => setSearchTerm('')}
                className="mt-2 text-sky-600 hover:underline text-sm">
                Clear search
              </button>
            </div>
          ) : !isSearching && todayAll.length === 0 ? (
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
                          : <span className="text-sky-700">{fmtMoney(Math.max(0, Number(b.total ?? 0) + calcEntrance(b, entranceRates) - Number(b.paidAmount ?? 0)))}</span>
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
                        {b.status !== 'Pending' && (
                          <button
                            onClick={() => handleDownloadReceipt(b.bookingId, b.id)}
                            disabled={downloading === b.bookingId}
                            className="px-3 py-1 bg-sky-600 text-white rounded text-xs hover:bg-sky-700 disabled:opacity-60 flex items-center gap-1"
                            title="Download receipt (PDF)"
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
                      {fmtMoney(todayAll.filter(b => !['Cancelled', 'Pending'].includes(b.status)).reduce((s, b) => s + Number(b.total || 0) + calcEntrance(b, entranceRates), 0))}
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
