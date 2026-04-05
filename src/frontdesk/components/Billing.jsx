import { useState, useEffect } from 'react';
import Sidebar from './Layout/Sidebar';
import { getFdBookings, updateBookingStatus, downloadStaffReceipt } from '../../lib/frontdeskApi';
import Toast, { useToast } from '../../components/ui/Toast';


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
function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt.replace(' ', 'T')).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
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

function isExpiredPending(b) {
  if (b.status !== 'Pending') return false;
  if (b.fully_paid) return false;
  const created = new Date(b.createdAt ?? b.created_at);
  return Date.now() - created.getTime() > 5 * 60 * 1000;
}

function StatusBadge({ status, booking }) {
  if (status === 'Pending' && booking && isExpiredPending(booking)) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1 w-fit">
        <i className="fas fa-times-circle text-[10px]"></i>Expired
      </span>
    );
  }
  const cls = {
    Confirmed:    'bg-blue-100 text-blue-800',
    Completed:    'bg-green-100 text-green-800',
    Cancelled:    'bg-red-100 text-red-800',
    Pending:      'bg-yellow-100 text-yellow-800',
    'Checked In': 'bg-purple-100 text-purple-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${cls[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

// ─── detail drawer ────────────────────────────────────────────────────────────
function BillingDetailDrawer({ booking: b, onClose, onCollect, onDownloadReceipt, downloading }) {
  if (!b) return null;

  const balanceDue = Math.max(0, Number(b.total ?? 0) - Number(b.reservation_fee ?? 0));

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto z-40 border-l border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Billing Detail</h3>
            <p className="text-xs text-gray-400">{b.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 p-6 space-y-5">

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Status</span>
            <StatusBadge status={b.status} booking={b} />
          </div>

          {/* Guest info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
            <p className="font-semibold text-gray-800 text-base">{b.guest}</p>
            <p className="text-gray-500">{b.roomType} · {b.guests} pax</p>
            <p className="text-gray-400 text-xs mt-1">
              {fmtDateTime(b.checkIn)} → {fmtDateTime(b.checkOut)}
            </p>
          </div>

          {/* Payment method */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Payment Method</span>
            <PayIcon method={b.payment_method} />
          </div>

          {/* Bill breakdown */}
          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="flex justify-between px-4 py-3 border-b bg-gray-50">
              <span className="text-gray-500">Visit Rate</span>
              <span className="font-medium">{fmtMoney(b.total)}</span>
            </div>
            {Number(b.reservation_fee ?? 0) > 0 && (
              <div className="flex justify-between px-4 py-3 border-b text-green-700">
                <span>Reservation Fee Paid</span>
                <span>− {fmtMoney(b.reservation_fee)}</span>
              </div>
            )}
            {b.status === 'Cancelled' ? (
              <div className="flex justify-between px-4 py-3 bg-red-50 text-red-700 font-semibold">
                <span>Forfeited (Non-refundable)</span>
                <span>{fmtMoney(b.reservation_fee ?? 0)}</span>
              </div>
            ) : b.status === 'Completed' ? (
              <div className="flex justify-between px-4 py-3 bg-green-50 text-green-700 font-semibold">
                <span>Total Collected</span>
                <span>{fmtMoney(b.total)}</span>
              </div>
            ) : (
              <div className="flex justify-between px-4 py-3 bg-blue-50 text-blue-800 font-bold text-base">
                <span>Balance Due</span>
                <span>{fmtMoney(balanceDue)}</span>
              </div>
            )}
          </div>

          {/* Amenities if any */}
          {b.amenities?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Add-ons</p>
              <div className="space-y-1">
                {b.amenities.map((a, i) => (
                  <div key={i} className="flex justify-between text-sm text-gray-600">
                    <span>{a.name} × {a.qty}</span>
                    <span>{fmtMoney(a.total ?? (a.unit_price * a.qty))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Special requests */}
          {b.special_requests && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Special Requests</p>
              <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded p-3">
                {b.special_requests}
              </p>
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
          {b.status === 'Confirmed' && (
            <button
              onClick={() => onCollect(b)}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              <i className="fas fa-hand-holding-usd mr-2"></i>Collect Payment
            </button>
          )}
          {b.status === 'Completed' && (
            <button
              onClick={() => onDownloadReceipt(b.booking_id)}
              disabled={downloading === b.booking_id}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition"
            >
              <i className={`fas ${downloading === b.booking_id ? 'fa-spinner fa-spin' : 'fa-file-pdf'} mr-2`}></i>
              {downloading === b.booking_id ? 'Preparing...' : 'Download Receipt'}
            </button>
          )}
          {b.status === 'Cancelled' && (
            <p className="flex-1 text-center text-sm text-rose-600 py-2">
              <i className="fas fa-ban mr-1"></i>Booking cancelled — reservation fee forfeited
            </p>
          )}
          {b.status === 'Pending' && (
            <p className="flex-1 text-center text-sm text-yellow-700 py-2">
              <i className="fas fa-clock mr-1"></i>Awaiting guest payment confirmation
            </p>
          )}
          <button onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">
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

  const todayAll = bookings.filter(b =>
    b.checkIn?.slice(0, 10) === today ||
    (b.status === 'Cancelled' && b.updatedAt?.slice(0, 10) === today)
  );

  const sortedTodayAll = [...todayAll].sort((a, b) => {
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
  });

  const todayConfirmed  = todayAll.filter(b => b.status === 'Confirmed');
  const todayCompleted  = todayAll.filter(b => b.status === 'Completed');
  const todayCancelled  = todayAll.filter(b => b.status === 'Cancelled');

  const revenueToday =
    todayCompleted.reduce((s, b) => s + Number(b.total ?? 0), 0) +
    todayCancelled.reduce((s, b) => s + Number(b.reservation_fee ?? 0), 0);

  async function handleCollect() {
    if (!billing) return;
    setPaying(true);
    try {
      await updateBookingStatus(billing.booking_id, 'Completed');
      setBookings(prev =>
        prev.map(b => b.booking_id === billing.booking_id ? { ...b, status: 'Completed' } : b)
      );
      setBilling(null);
      setSelected(null);
      showToast('Payment collected successfully!', 'success');
    } catch {
      showToast('Failed to update booking. Please try again.', 'error');
    } finally {
      setPaying(false);
    }
  }

  async function handleDownloadReceipt(bookingId) {
    setDownloading(bookingId);
    try {
      const blob = await downloadStaffReceipt(bookingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${bookingId}.pdf`;
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

  const balanceDue = billing ? Math.max(0, Number(billing.total) - Number(billing.reservation_fee ?? 0)) : 0;

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* ── Detail Drawer ── */}
      <BillingDetailDrawer
        booking={selected}
        onClose={() => setSelected(null)}
        onCollect={openCollect}
        onDownloadReceipt={handleDownloadReceipt}
        downloading={downloading}
      />

      {/* ── Payment Collection Modal ── */}
      {billing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Collect Payment — {billing.id}</h3>
                <button onClick={() => setBilling(null)} className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Guest summary */}
              <div className="p-4 bg-gray-50 rounded mb-4 text-sm">
                <p className="font-medium text-gray-800">{billing.guest}</p>
                <p className="text-gray-600">{billing.roomType} · {billing.guests} pax</p>
                <p className="text-gray-500 text-xs mt-1">
                  {fmtDateTime(billing.checkIn)} → {fmtDateTime(billing.checkOut)}
                </p>
              </div>

              {/* Bill breakdown */}
              <div className="border rounded mb-4 text-sm">
                <div className="flex justify-between px-4 py-3 border-b">
                  <span className="text-gray-600">Full Visit Rate</span>
                  <span>{fmtMoney(billing.total)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 border-b text-green-700">
                  <span>Reservation Fee (paid online)</span>
                  <span>− {fmtMoney(billing.reservation_fee ?? 0)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 font-semibold text-blue-800 text-base">
                  <span>Balance Due Now</span>
                  <span>{fmtMoney(balanceDue)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <div className="flex gap-2">
                  {[
                    { value: 'Cash',  icon: 'fa-money-bill-wave', color: 'text-green-600' },
                    { value: 'GCash', icon: 'fa-mobile-alt',      color: 'text-blue-500'  },
                    { value: 'Maya',  icon: 'fa-mobile-alt',      color: 'text-green-500' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setPayMethod(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded text-sm font-medium transition-colors ${
                        payMethod === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
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
                  className="px-4 py-2 border rounded text-sm text-gray-700">
                  Cancel
                </button>
                <button onClick={handleCollect} disabled={paying}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-60">
                  <i className="fas fa-check mr-1"></i>
                  {paying ? 'Processing...' : `Collect ${fmtMoney(balanceDue)} & Complete`}
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
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <i className="fas fa-file-invoice-dollar text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Awaiting Collection</p>
              <h3 className="text-2xl font-bold">{loading ? '—' : todayConfirmed.length}</h3>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <i className="fas fa-check-circle text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Completed Today</p>
              <h3 className="text-2xl font-bold">{loading ? '—' : todayCompleted.length}</h3>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
              <i className="fas fa-peso-sign text-xl"></i>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Revenue Today</p>
              <h3 className="text-xl font-bold">
                {loading ? '—' : fmtMoney(revenueToday)}
              </h3>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        {/* Awaiting payment */}
        {!loading && todayConfirmed.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-blue-700">
              <i className="fas fa-exclamation-circle mr-2"></i>
              Awaiting Payment Collection ({todayConfirmed.length})
            </h2>
            <div className="space-y-3">
              {todayConfirmed.map(b => (
                <div key={b.booking_id}
                  onClick={() => setSelected(b)}
                  className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 transition">
                  <div>
                    <p className="font-medium">{b.guest}</p>
                    <p className="text-sm text-gray-600">{b.roomType} · {b.guests} pax</p>
                    <p className="text-xs text-gray-500">
                      {fmtDateTime(b.checkIn)} → {fmtDateTime(b.checkOut)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Balance Due</p>
                    <p className="font-bold text-blue-700 text-lg">
                      {fmtMoney(Math.max(0, Number(b.total) - Number(b.reservation_fee ?? 0)))}
                    </p>
                    <button
                      onClick={e => { e.stopPropagation(); openCollect(b); }}
                      className="mt-2 px-4 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
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
          <h2 className="text-lg font-semibold mb-4">Today's Billing Summary</h2>

          {loading ? (
            <div className="py-10 text-center text-gray-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading...
            </div>
          ) : todayAll.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No bookings for today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[['Booking ID','Booking ID'],['Guest','Guest'],['Room','Room'],['Time Slot','Time Slot'],['Visit Rate','Visit Rate'],['Status','Status']].map(([label,key]) => (
                      <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        <button onClick={() => { if(sortBy===key) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(key);setSortDir('asc');} }}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors group">
                          {label}
                          <span className="text-gray-400 group-hover:text-blue-400">
                            {sortBy===key ? <i className={`fas fa-arrow-${sortDir==='asc'?'up':'down'} text-blue-500`}></i> : <i className="fas fa-sort opacity-40"></i>}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance Due</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedTodayAll.map(b => (
                    <tr key={b.booking_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelected(b)}
                    >
                      <td className="px-4 py-3 text-xs text-gray-500">{b.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{b.guest}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.roomType}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {fmtDateTime(b.checkIn)}<br />
                        <span className="text-gray-400">→ {fmtDateTime(b.checkOut)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{fmtMoney(b.total)}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {b.status === 'Completed'
                          ? <span className="text-green-600"><i className="fas fa-check mr-1"></i>Collected</span>
                          : b.status === 'Cancelled'
                          ? <span className="text-rose-600"><i className="fas fa-ban mr-1"></i>Forfeited {fmtMoney(b.reservation_fee ?? 0)}</span>
                          : <span className="text-blue-700">{fmtMoney(Math.max(0, Number(b.total) - Number(b.reservation_fee ?? 0)))}</span>
                        }
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {b.status === 'Confirmed' && (
                          <button
                            onClick={() => openCollect(b)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Collect
                          </button>
                        )}
                        {b.status === 'Completed' && (
                          <button
                            onClick={() => handleDownloadReceipt(b.booking_id)}
                            disabled={downloading === b.booking_id}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1"
                          >
                            <i className={`fas ${downloading === b.booking_id ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
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
                <tfoot className="bg-gray-50 text-sm font-semibold">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-gray-600">Totals:</td>
                    <td className="px-4 py-3">
                      {fmtMoney(todayAll.reduce((s, b) => s + Number(b.total), 0))}
                    </td>
                    <td className="px-4 py-3 text-green-700">
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
