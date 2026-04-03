import { useState, useEffect, useMemo } from 'react';
import Sidebar from './Layout/Sidebar';
import Toast, { useToast } from '../../components/ui/Toast';
import BookingDetailModal from './BookingDetailModal';
import { getFdBookings, updateBookingStatus, checkInBooking, checkOutBooking } from '../../lib/frontdeskApi';


// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt.replace(' ', 'T')).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}
function fmtTime(dt) {
  if (!dt) return '—';
  return new Date(dt.replace(' ', 'T')).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}
function fmtMoney(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function parseWalkIn(b) {
  if (!b.specialRequests?.startsWith('Walk-in:')) return null;
  const name  = (b.specialRequests.match(/^Walk-in:\s*([^,]+)/) || [])[1]?.trim() || b.guest;
  const phone = (b.specialRequests.match(/Phone:\s*([^,]+)/) || [])[1]?.trim() || '—';
  const email = (b.specialRequests.match(/Email:\s*([^,]+)/) || [])[1]?.trim() || '—';
  return { name, phone, email };
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

function StatusBadge({ status }) {
  const cls = {
    Confirmed:   'bg-blue-100 text-blue-800',
    'Checked In':'bg-purple-100 text-purple-800',
    Completed:   'bg-green-100 text-green-800',
    Cancelled:   'bg-red-100 text-red-800',
    Pending:     'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${cls[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

// ─── component ────────────────────────────────────────────────────────────────
export default function Reservation() {
  const [bookings, setBookings]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const [sortBy, setSortBy]               = useState('ID');
  const [sortDir, setSortDir]             = useState('desc');
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('All');

  const [viewBooking, setViewBooking]     = useState(null);
  const [confirmState, setConfirmState]   = useState(null); // { bookingId, action, booking }
  const [toast, showToast, clearToast, toastType] = useToast();

  function load() {
    setLoading(true);
    getFdBookings()
      .then(data => { setBookings(data); setError(''); })
      .catch(() => setError('Failed to load bookings.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(field) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    let list = filterStatus === 'All' ? bookings : bookings.filter(b => b.status === filterStatus);
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter(b => {
        const wi = parseWalkIn(b);
        const name = (wi ? wi.name : b.guest) ?? '';
        return (
          name.toLowerCase().includes(term) ||
          (b.id ?? '').toLowerCase().includes(term) ||
          (b.roomType ?? '').toLowerCase().includes(term)
        );
      });
    }
    return [...list].sort((a, b) => {
      let valA, valB;
      if (sortBy === 'ID') {
        valA = a.id ?? ''; valB = b.id ?? '';
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortBy === 'Guest') {
        const wiA = parseWalkIn(a), wiB = parseWalkIn(b);
        valA = ((wiA ? wiA.name : a.guest) ?? '').toLowerCase();
        valB = ((wiB ? wiB.name : b.guest) ?? '').toLowerCase();
      } else if (sortBy === 'Room') {
        valA = (a.roomType ?? '').toLowerCase();
        valB = (b.roomType ?? '').toLowerCase();
      } else if (sortBy === 'Visit Time') {
        valA = a.checkIn ?? ''; valB = b.checkIn ?? '';
      } else if (sortBy === 'Guests') {
        valA = Number(a.guests ?? 0); valB = Number(b.guests ?? 0);
        return sortDir === 'asc' ? valA - valB : valB - valA;
      } else if (sortBy === 'Total') {
        valA = Number(a.total ?? 0); valB = Number(b.total ?? 0);
        return sortDir === 'asc' ? valA - valB : valB - valA;
      } else if (sortBy === 'Status') {
        const ORDER = { Pending: 0, 'Checked In': 1, Confirmed: 2, Cancelled: 3, Completed: 4 };
        valA = ORDER[a.status] ?? 5; valB = ORDER[b.status] ?? 5;
        return sortDir === 'asc' ? valA - valB : valB - valA;
      } else {
        valA = ''; valB = '';
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [bookings, filterStatus, searchTerm, sortBy, sortDir]);

  // ── status update (table row quick-actions only) ──────────────────────────
  function syncBooking(bookingId, updates) {
    setBookings(prev => prev.map(b => b.booking_id === bookingId ? { ...b, ...updates } : b));
  }

  async function execConfirm() {
    if (!confirmState) return;
    const { bookingId, action } = confirmState;
    setConfirmState(null);
    setActionLoading(bookingId);
    try {
      if (action === 'confirm') {
        await updateBookingStatus(bookingId, 'Confirmed');
        syncBooking(bookingId, { status: 'Confirmed' });
      } else if (action === 'checkin') {
        const res = await checkInBooking(bookingId);
        syncBooking(bookingId, { status: 'Checked In', checkedInAt: res.checked_in_at });
      } else if (action === 'checkout') {
        const res = await checkOutBooking(bookingId);
        syncBooking(bookingId, { status: 'Completed', checkedOutAt: res.checked_out_at });
      } else if (action === 'cancel') {
        await updateBookingStatus(bookingId, 'Cancelled');
        syncBooking(bookingId, { status: 'Cancelled' });
      }
    } catch { showToast('Failed to update booking.'); }
    finally { setActionLoading(null); }
  }

  const CONFIRM_CONFIG = {
    confirm:  { label: 'Confirm Booking', icon: 'fa-check',        color: 'blue',   desc: 'Mark this booking as confirmed?' },
    checkin:  { label: 'Check In Guest',  icon: 'fa-door-open',    color: 'purple', desc: 'Check in the guest for this booking?' },
    checkout: { label: 'Check Out Guest', icon: 'fa-sign-out-alt', color: 'green',  desc: 'Complete this booking and check out the guest?' },
    cancel:   { label: 'Cancel Booking',  icon: 'fa-ban',          color: 'red',    desc: 'Cancel this booking? This cannot be undone.' },
  };
  const COLOR_BTN = { blue: 'bg-blue-600 hover:bg-blue-700', purple: 'bg-purple-600 hover:bg-purple-700', green: 'bg-green-600 hover:bg-green-700', red: 'bg-red-600 hover:bg-red-700' };

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <Toast message={toast} type={toastType} onClose={clearToast} />
      {/* ── Quick-Action Confirmation Modal ── */}
      {confirmState && (() => {
        const cfg = CONFIRM_CONFIG[confirmState.action];
        const b   = confirmState.booking;
        const wi  = parseWalkIn(b);
        const guest = wi ? wi.name : b.guest;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
              <div className={`rounded-t-2xl px-6 py-4 flex items-center gap-3 ${{confirm:'bg-blue-600',checkin:'bg-purple-600',checkout:'bg-green-600',cancel:'bg-red-600'}[confirmState.action]}`}>
                <i className={`fas ${cfg.icon} text-white text-lg`}></i>
                <h3 className="text-white font-semibold text-base">{cfg.label}</h3>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-slate-600">{cfg.desc}</p>
                <div className="bg-slate-50 rounded-xl divide-y divide-slate-100 text-sm">
                  {[
                    ['Booking ID', b.id],
                    ['Guest',      guest],
                    ['Room',       b.roomType],
                    ['Total',      fmtMoney(b.total)],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between px-4 py-2">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-800">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 pb-5 flex justify-end gap-3">
                <button onClick={() => setConfirmState(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={execConfirm}
                  className={`px-4 py-2 rounded-xl text-sm text-white font-medium ${COLOR_BTN[cfg.color]}`}>
                  {cfg.label}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── View Booking Modal ── */}
      {viewBooking && (
        <BookingDetailModal
          booking={viewBooking}
          onClose={() => setViewBooking(null)}
          onUpdated={updated => {
            setViewBooking(updated);
            syncBooking(updated.booking_id, updated);
          }}
          showToast={showToast}
        />
      )}

      {/* ── Main ── */}
      <main className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Search + Filter */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <input type="text" placeholder="Search name, ID, room…"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-2 text-sm flex-1 min-w-[160px]" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border rounded px-3 py-2 text-sm">
              <option value="All">All Statuses</option>
              <option>Pending</option>
              <option>Confirmed</option>
              <option>Checked In</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
            <button onClick={load} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm ml-auto">
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-gray-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading bookings...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['ID', 'Guest', 'Room', 'Visit Time', 'Guests', 'Total', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button onClick={() => handleSort(h)}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors group">
                          {h}
                          <span className="text-gray-400 group-hover:text-blue-400">
                            {sortBy === h
                              ? <i className={`fas fa-arrow-${sortDir === 'asc' ? 'up' : 'down'} text-blue-500`}></i>
                              : <i className="fas fa-sort opacity-40"></i>}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No bookings found.</td></tr>
                  ) : filtered.map(b => {
                    const wi = parseWalkIn(b);
                    return (
                      <tr key={b.booking_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewBooking(b)}>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{b.id}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{wi ? wi.name : b.guest}</p>
                          <p className="text-xs text-gray-500">{wi ? wi.email : b.guest_email}</p>
                          {wi && <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded">Walk-in</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{b.roomType}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {fmtDateTime(b.checkIn)}<br />
                          <span className="text-gray-400">→ {fmtTime(b.checkOut)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{b.guests}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{fmtMoney(b.total)}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setViewBooking(b)} title="View details"
                              className="text-blue-600 hover:text-blue-800">
                              <i className="fas fa-eye"></i>
                            </button>
                            {b.status === 'Pending' && (
                              <button onClick={() => setConfirmState({ bookingId: b.booking_id, action: 'confirm', booking: b })}
                                disabled={actionLoading === b.booking_id}
                                title="Confirm" className="text-blue-600 hover:text-blue-800 disabled:opacity-40">
                                <i className="fas fa-check"></i>
                              </button>
                            )}
                            {b.status === 'Confirmed' && (
                              <button onClick={() => setConfirmState({ bookingId: b.booking_id, action: 'checkin', booking: b })}
                                disabled={actionLoading === b.booking_id}
                                title="Check In" className="text-purple-600 hover:text-purple-800 disabled:opacity-40">
                                <i className="fas fa-door-open"></i>
                              </button>
                            )}
                            {b.status === 'Checked In' && (
                              <button onClick={() => setConfirmState({ bookingId: b.booking_id, action: 'checkout', booking: b })}
                                disabled={actionLoading === b.booking_id}
                                title="Check Out" className="text-green-600 hover:text-green-800 disabled:opacity-40">
                                <i className="fas fa-sign-out-alt"></i>
                              </button>
                            )}
                            {b.status === 'Pending' && (
                              <button onClick={() => setConfirmState({ bookingId: b.booking_id, action: 'cancel', booking: b })}
                                disabled={actionLoading === b.booking_id}
                                title="Cancel" className="text-red-600 hover:text-red-800 disabled:opacity-40">
                                <i className="fas fa-ban"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </Sidebar>
  );
}
