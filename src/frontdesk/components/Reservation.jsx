import { useState, useEffect, useMemo } from 'react';
import Sidebar from './Layout/Sidebar';
import NotificationBell from '../../components/ui/NotificationBell';
import Toast, { useToast } from '../../components/ui/Toast';
import {
  getFdBookings, updateBookingStatus,
  checkInBooking, checkOutBooking,
  addAmenity, removeAmenity,
} from '../../lib/frontdeskApi';

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

const AMENITY_CATALOG = [
  { name: 'Pillow',  icon: 'fa-bed',        unit_price: 50,  type: 'qty'   },
  { name: 'Karaoke', icon: 'fa-microphone', unit_price: 800, type: 'fixed' },
];

// ─── component ────────────────────────────────────────────────────────────────
export default function Reservation() {
  const [bookings, setBookings]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const [sortBy, setSortBy]               = useState('Guest Name');
  const [sortDir, setSortDir]             = useState('asc');
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('All');

  const [viewBooking, setViewBooking]     = useState(null);

  // Amenity add state (within modal)
  const [addingAmenity, setAddingAmenity] = useState(null); // { name, qty }
  const [amenityLoading, setAmenityLoading] = useState(false);
  const [toast, showToast, clearToast, toastType] = useToast();

  function load() {
    setLoading(true);
    getFdBookings()
      .then(data => { setBookings(data); setError(''); })
      .catch(() => setError('Failed to load bookings.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

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
      let valA = '', valB = '';
      if (sortBy === 'Guest Name') {
        const wiA = parseWalkIn(a), wiB = parseWalkIn(b);
        valA = ((wiA ? wiA.name : a.guest) ?? '').toLowerCase();
        valB = ((wiB ? wiB.name : b.guest) ?? '').toLowerCase();
      } else if (sortBy === 'Reservation ID') {
        valA = a.id ?? ''; valB = b.id ?? '';
      } else if (sortBy === 'Room Type') {
        valA = (a.roomType ?? '').toLowerCase();
        valB = (b.roomType ?? '').toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [bookings, filterStatus, searchTerm, sortBy, sortDir]);

  // ── status update (confirm / cancel) ──────────────────────────────────────
  function syncBooking(bookingId, updates) {
    setBookings(prev => prev.map(b => b.booking_id === bookingId ? { ...b, ...updates } : b));
    if (viewBooking?.booking_id === bookingId) setViewBooking(v => ({ ...v, ...updates }));
  }

  async function handleStatus(bookingId, newStatus) {
    setActionLoading(bookingId);
    try {
      await updateBookingStatus(bookingId, newStatus);
      syncBooking(bookingId, { status: newStatus });
    } catch { showToast('Failed to update booking status.'); }
    finally { setActionLoading(null); }
  }

  async function handleCheckIn(bookingId) {
    setActionLoading(bookingId);
    try {
      const res = await checkInBooking(bookingId);
      syncBooking(bookingId, { status: 'Checked In', checkedInAt: res.checked_in_at });
    } catch { showToast('Failed to check in.'); }
    finally { setActionLoading(null); }
  }

  async function handleCheckOut(bookingId) {
    setActionLoading(bookingId);
    try {
      const res = await checkOutBooking(bookingId);
      syncBooking(bookingId, { status: 'Completed', checkedOutAt: res.checked_out_at });
    } catch { showToast('Failed to check out.'); }
    finally { setActionLoading(null); }
  }

  // ── amenities ──────────────────────────────────────────────────────────────
  async function handleAddAmenity() {
    if (!addingAmenity?.name || !viewBooking) return;
    setAmenityLoading(true);
    try {
      const res = await addAmenity(viewBooking.booking_id, addingAmenity.name, addingAmenity.qty || 1);
      const newAmenity = res.data;
      const newTotal   = res.new_total;
      const updated = {
        amenities: [...(viewBooking.amenities || []), newAmenity],
        total: newTotal,
      };
      syncBooking(viewBooking.booking_id, updated);
      setAddingAmenity(null);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to add amenity.');
    } finally {
      setAmenityLoading(false);
    }
  }

  async function handleRemoveAmenity(amenityId, amenityTotal) {
    if (!viewBooking) return;
    setAmenityLoading(true);
    try {
      const res = await removeAmenity(viewBooking.booking_id, amenityId);
      const updated = {
        amenities: (viewBooking.amenities || []).filter(a => a.id !== amenityId),
        total: res.new_total,
      };
      syncBooking(viewBooking.booking_id, updated);
    } catch { showToast('Failed to remove amenity.'); }
    finally { setAmenityLoading(false); }
  }

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <Toast message={toast} type={toastType} onClose={clearToast} />
      {/* ── View Booking Modal ── */}
      {viewBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Booking — {viewBooking.id}</h3>
                <button onClick={() => { setViewBooking(null); setAddingAmenity(null); }}
                  className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {(() => {
                const wi = parseWalkIn(viewBooking);
                const guestName  = wi ? wi.name  : viewBooking.guest;
                const guestEmail = wi ? wi.email : (viewBooking.guest_email || '—');
                const guestPhone = wi ? wi.phone : (viewBooking.guest_phone || '—');
                return (
                  <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded text-sm mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Guest</p>
                      <p className="font-medium">{guestName}</p>
                      {wi && <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded">Walk-in</span>}
                    </div>
                    <div><p className="text-xs text-gray-500">Status</p><StatusBadge status={viewBooking.status} /></div>
                    <div><p className="text-xs text-gray-500">Email</p><p>{guestEmail}</p></div>
                    <div><p className="text-xs text-gray-500">Phone</p><p>{guestPhone}</p></div>
                    <div><p className="text-xs text-gray-500">Room Type</p><p className="font-medium">{viewBooking.roomType}</p></div>
                    <div><p className="text-xs text-gray-500">Guests</p><p>{viewBooking.guests} pax</p></div>
                    <div><p className="text-xs text-gray-500">Check-in</p><p>{fmtDateTime(viewBooking.checkIn)}</p></div>
                    <div><p className="text-xs text-gray-500">Check-out</p><p>{fmtDateTime(viewBooking.checkOut)}</p></div>
                    {viewBooking.checkedInAt && (
                      <div><p className="text-xs text-gray-500">Actual Check-in</p>
                        <p className="text-purple-700 font-medium">{fmtDateTime(viewBooking.checkedInAt)}</p></div>
                    )}
                    {viewBooking.checkedOutAt && (
                      <div><p className="text-xs text-gray-500">Actual Check-out</p>
                        <p className="text-green-700 font-medium">{fmtDateTime(viewBooking.checkedOutAt)}</p></div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Total Amount</p>
                      <p className="font-semibold text-blue-700">{fmtMoney(viewBooking.total)}</p>
                    </div>
                    <div><p className="text-xs text-gray-500">Payment Method</p><PayIcon method={viewBooking.paymentMethod} /></div>
                    {!wi && viewBooking.specialRequests && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Special Requests</p>
                        <p className="italic text-gray-700">{viewBooking.specialRequests}</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Booked On</p>
                      <p>{fmtDateTime(viewBooking.createdAt)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* ── Amenities ── */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Amenities</p>
                {(viewBooking.amenities?.length ?? 0) === 0 ? (
                  <p className="text-xs text-gray-400 mb-2">No amenities added.</p>
                ) : (
                  <div className="space-y-1 mb-2">
                    {viewBooking.amenities.map(a => (
                      <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                        <span>
                          <i className={`fas ${a.name === 'Karaoke' ? 'fa-microphone' : 'fa-bed'} mr-2 text-gray-500`}></i>
                          {a.name} {a.qty > 1 && `× ${a.qty}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-xs">{fmtMoney(a.total)}</span>
                          {['Confirmed', 'Checked In'].includes(viewBooking.status) && (
                            <button
                              onClick={() => handleRemoveAmenity(a.id, a.total)}
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

                {/* Add amenity — only for active bookings */}
                {['Confirmed', 'Checked In'].includes(viewBooking.status) && (
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

              {/* Modal actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {viewBooking.status === 'Pending' && (
                  <button onClick={() => handleStatus(viewBooking.booking_id, 'Confirmed')}
                    disabled={actionLoading === viewBooking.booking_id}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                    <i className="fas fa-check mr-1"></i>Confirm
                  </button>
                )}
                {viewBooking.status === 'Confirmed' && (
                  <button onClick={() => handleCheckIn(viewBooking.booking_id)}
                    disabled={actionLoading === viewBooking.booking_id}
                    className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50">
                    <i className="fas fa-door-open mr-1"></i>Check In
                  </button>
                )}
                {viewBooking.status === 'Checked In' && (
                  <button onClick={() => handleCheckOut(viewBooking.booking_id)}
                    disabled={actionLoading === viewBooking.booking_id}
                    className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
                    <i className="fas fa-sign-out-alt mr-1"></i>Check Out
                  </button>
                )}
                {['Pending', 'Confirmed'].includes(viewBooking.status) && (
                  <button onClick={() => handleStatus(viewBooking.booking_id, 'Cancelled')}
                    disabled={actionLoading === viewBooking.booking_id}
                    className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                    <i className="fas fa-times mr-1"></i>Cancel
                  </button>
                )}
                <button onClick={() => { setViewBooking(null); setAddingAmenity(null); }}
                  className="px-3 py-2 border rounded text-sm text-gray-700">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-gray-800">Reservations</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button onClick={load} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Search + Filter */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            {['Guest Name', 'Reservation ID', 'Room Type'].map(field => (
              <button key={field} onClick={() => handleSort(field)}
                className={`flex items-center gap-1 px-3 py-2 rounded border text-sm font-medium transition ${
                  sortBy === field ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}>
                {field}
                {sortBy === field && <i className={`fas fa-arrow-${sortDir === 'asc' ? 'up' : 'down'} text-xs`}></i>}
              </button>
            ))}
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
                    {['ID', 'Guest', 'Room', 'Visit Time', 'Guests', 'Total', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No bookings found.</td></tr>
                  ) : filtered.map(b => {
                    const wi = parseWalkIn(b);
                    return (
                      <tr key={b.booking_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setViewBooking(b); setAddingAmenity(null); }}>
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
                            <button onClick={() => { setViewBooking(b); setAddingAmenity(null); }} title="View details"
                              className="text-blue-600 hover:text-blue-800">
                              <i className="fas fa-eye"></i>
                            </button>
                            {b.status === 'Pending' && (
                              <button onClick={() => handleStatus(b.booking_id, 'Confirmed')}
                                disabled={actionLoading === b.booking_id}
                                title="Confirm" className="text-blue-600 hover:text-blue-800 disabled:opacity-40">
                                <i className="fas fa-check"></i>
                              </button>
                            )}
                            {b.status === 'Confirmed' && (
                              <button onClick={() => handleCheckIn(b.booking_id)}
                                disabled={actionLoading === b.booking_id}
                                title="Check In" className="text-purple-600 hover:text-purple-800 disabled:opacity-40">
                                <i className="fas fa-door-open"></i>
                              </button>
                            )}
                            {b.status === 'Checked In' && (
                              <button onClick={() => handleCheckOut(b.booking_id)}
                                disabled={actionLoading === b.booking_id}
                                title="Check Out" className="text-green-600 hover:text-green-800 disabled:opacity-40">
                                <i className="fas fa-sign-out-alt"></i>
                              </button>
                            )}
                            {['Pending', 'Confirmed'].includes(b.status) && (
                              <button onClick={() => handleStatus(b.booking_id, 'Cancelled')}
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
