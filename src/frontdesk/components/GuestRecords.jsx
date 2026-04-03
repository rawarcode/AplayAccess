import { useState, useEffect, useMemo } from 'react';
import Sidebar from './Layout/Sidebar';
import { getFdBookings } from '../../lib/frontdeskApi';

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt.replace(' ', 'T')).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
function fmtMoney(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
function initials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Parse real guest info from walk-in special_requests
function parseWalkIn(b) {
  if (!b.specialRequests?.startsWith('Walk-in:')) return null;
  const name  = (b.specialRequests.match(/^Walk-in:\s*([^,]+)/) || [])[1]?.trim() || b.guest;
  const phone = (b.specialRequests.match(/Phone:\s*([^,]+)/) || [])[1]?.trim() || '—';
  const email = (b.specialRequests.match(/Email:\s*([^,]+)/) || [])[1]?.trim() || '—';
  return { name, phone, email };
}

// ─── component ────────────────────────────────────────────────────────────────
export default function GuestRecords() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [viewGuest, setViewGuest] = useState(null);

  useEffect(() => {
    getFdBookings()
      .then(data => { setBookings(data); setError(''); })
      .catch(() => setError('Failed to load guest records.'))
      .finally(() => setLoading(false));
  }, []);

  // Group bookings by guest email (or name if email missing)
  const guests = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      const wi  = parseWalkIn(b);
      const key = wi
        ? (wi.email !== '—' ? wi.email : wi.name)
        : (b.guest_email || b.guest);
      if (!map[key]) {
        map[key] = {
          name:  wi ? wi.name  : b.guest,
          email: wi ? wi.email : (b.guest_email || '—'),
          phone: wi ? wi.phone : (b.guest_phone || '—'),
          visits: [],
        };
      }
      map[key].visits.push(b);
    });

    return Object.values(map).map(g => {
      const sorted  = [...g.visits].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
      const done    = g.visits.filter(v => v.status === 'Completed');
      return {
        ...g,
        visits:         sorted,
        totalVisits:    g.visits.length,
        completedVisits: done.length,
        lastVisit:      sorted[0]?.checkIn ?? null,
        totalSpend:     done.reduce((s, v) => s + Number(v.total), 0),
      };
    }).sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
  }, [bookings]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter(g =>
      g.name.toLowerCase().includes(term) ||
      g.email.toLowerCase().includes(term) ||
      g.phone.includes(term)
    );
  }, [guests, search]);

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      {/* ── View Guest Modal ── */}
      {viewGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Visit History — {viewGuest.name}</h3>
                <button onClick={() => setViewGuest(null)} className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Guest profile */}
              <div className="flex items-center mb-5 p-4 bg-gray-50 rounded">
                <div className="h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold mr-4 flex-shrink-0">
                  {initials(viewGuest.name)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{viewGuest.name}</p>
                  <p className="text-sm text-gray-600">{viewGuest.email}</p>
                  <p className="text-sm text-gray-500">{viewGuest.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-700">{viewGuest.completedVisits}</p>
                  <p className="text-xs text-gray-500">Completed</p>
                  <p className="text-sm font-semibold text-green-700 mt-1">{fmtMoney(viewGuest.totalSpend)}</p>
                  <p className="text-xs text-gray-500">Total Spend</p>
                </div>
              </div>

              {/* Visit history table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['ID', 'Room', 'Date', 'Guests', 'Amount', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {viewGuest.visits.map(v => (
                      <tr key={v.booking_id}>
                        <td className="px-3 py-2 text-xs text-gray-400">{v.id}</td>
                        <td className="px-3 py-2">{v.roomType}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtDate(v.checkIn)}</td>
                        <td className="px-3 py-2 text-center">{v.guests}</td>
                        <td className="px-3 py-2">{fmtMoney(v.total)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            v.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            v.status === 'Confirmed' ? 'bg-blue-100 text-blue-800' :
                            v.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>{v.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 text-sm font-semibold">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right text-gray-600">Totals:</td>
                      <td className="px-3 py-2 text-center">{viewGuest.visits.reduce((s, v) => s + v.guests, 0)}</td>
                      <td className="px-3 py-2 text-green-700">{fmtMoney(viewGuest.totalSpend)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end mt-4">
                <button onClick={() => setViewGuest(null)}
                  className="px-4 py-2 border rounded text-sm text-gray-700">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Search */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-full w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-sm text-gray-500 whitespace-nowrap">
              {loading ? '—' : `${filtered.length} guest${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-gray-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading records...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Guest', 'Contact', 'Total Visits', 'Completed', 'Last Visit', 'Total Spend', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No guests found.</td>
                    </tr>
                  ) : filtered.map((g, i) => (
                    <tr key={i}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setViewGuest(g)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold mr-3 flex-shrink-0 text-sm">
                            {initials(g.name)}
                          </div>
                          <p className="font-medium text-sm text-gray-900">{g.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-700">{g.email}</p>
                        <p className="text-xs text-gray-500">{g.phone}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-center text-gray-700">{g.totalVisits}</td>
                      <td className="px-4 py-4 text-sm text-center font-medium text-green-700">{g.completedVisits}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{fmtDate(g.lastVisit)}</td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-800">{fmtMoney(g.totalSpend)}</td>
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewGuest(g)}
                          className="text-blue-600 hover:text-blue-800 text-sm">
                          <i className="fas fa-eye mr-1"></i>View
                        </button>
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
