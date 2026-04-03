import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import Sidebar from './Layout/Sidebar';
import { getFdBookings } from '../../lib/frontdeskApi';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ─── sample data (fallback when API has no bookings) ──────────────────────────
function makeSampleBookings() {
  const rooms  = ['Deluxe Room', 'Standard Room', 'Family Suite', 'Premium Cottage', 'Garden Villa'];
  const guests = ['Maria Santos', 'Juan dela Cruz', 'Ana Reyes', 'Pedro Lim', 'Rosa Garcia',
                  'Carlo Mendoza', 'Elena Torres', 'Miguel Cruz', 'Luz Bautista', 'Ramon Aquino',
                  'Celine Ramos', 'Dante Villanueva', 'Marites Ocampo', 'Ferdie Castillo', 'Liza Diaz'];
  const statuses = ['Completed','Completed','Completed','Confirmed','Cancelled','Completed','Confirmed'];
  const payments = ['gcash','cash','maya','gcash','cash'];
  const slots    = ['08:00','09:00','10:00','11:00','13:00','14:00'];

  let id = 9001;
  const bookings = [];

  // Spread ~2–4 bookings across each of the last 7 days
  const counts = [2, 3, 2, 4, 3, 2, 4]; // Mon→today
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const n = counts[6 - i];

    for (let j = 0; j < n; j++) {
      const g       = guests[(id - 9001) % guests.length];
      const room    = rooms[(id - 9001) % rooms.length];
      const slot    = slots[j % slots.length];
      const [hh]    = slot.split(':').map(Number);
      const checkIn = `${dateStr} ${slot}:00`;
      const checkOut = `${dateStr} ${String(hh + 8).padStart(2, '0')}:00:00`;
      const gCount  = (j % 3) + 2;
      const total   = 1500 + Math.max(0, gCount - 5) * 50;
      const status  = i === 0
        ? (j % 3 === 0 ? 'Confirmed' : j % 3 === 1 ? 'Completed' : 'Pending')
        : statuses[(id - 9001) % statuses.length];

      bookings.push({
        id:              `RES-${String(id).padStart(6, '0')}`,
        booking_id:      id,
        guest:           g,
        guest_email:     g.toLowerCase().replace(/\s+/g, '.') + '@example.com',
        guest_phone:     '+6391' + String(10000000 + id).slice(1),
        roomType:        room,
        checkIn,
        checkOut,
        guests:          gCount,
        total,
        status,
        paymentMethod:   payments[id % payments.length],
        specialRequests: '',
        createdAt:       checkIn,
      });
      id++;
    }
  }
  return bookings;
}

const SAMPLE_BOOKINGS = makeSampleBookings();

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtMoney(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
function fmtTime(dt) {
  if (!dt) return '—';
  return new Date(dt.replace(' ', 'T')).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function buildWeekChart(bookings) {
  const labels = [], confirmed = [], completed = [], cancelled = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = bookings.filter(b => b.checkIn?.slice(0, 10) === key);
    labels.push(d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }));
    confirmed.push(day.filter(b => b.status === 'Confirmed').length);
    completed.push(day.filter(b => b.status === 'Completed').length);
    cancelled.push(day.filter(b => b.status === 'Cancelled').length);
  }
  return { labels, confirmed, completed, cancelled };
}

function exportCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── component ────────────────────────────────────────────────────────────────
export default function Reports() {
  const [bookings, setBookings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [reportDate, setReportDate]   = useState(todayStr());
  const [usingDemo, setUsingDemo]     = useState(false);

  useEffect(() => {
    getFdBookings()
      .then(data => {
        if (data.length === 0) { setBookings(SAMPLE_BOOKINGS); setUsingDemo(true); }
        else { setBookings(data); setUsingDemo(false); }
        setError('');
      })
      .catch(() => {
        setBookings(SAMPLE_BOOKINGS);
        setUsingDemo(true);
        setError('');
      })
      .finally(() => setLoading(false));
  }, []);

  // Include check-ins for the selected date PLUS any cancellations on that date
  const dateBookings = bookings.filter(b =>
    b.checkIn?.slice(0, 10) === reportDate ||
    (b.status === 'Cancelled' && b.updatedAt?.slice(0, 10) === reportDate)
  );

  // Revenue = completed totals + forfeited reservation fees from cancellations
  const totalRevenue =
    dateBookings.filter(b => b.status === 'Completed').reduce((s, b) => s + Number(b.total ?? 0), 0) +
    dateBookings.filter(b => b.status === 'Cancelled').reduce((s, b) => s + Number(b.reservation_fee ?? 0), 0);

  const { labels, confirmed, completed, cancelled } = buildWeekChart(bookings);
  const chartData = {
    labels,
    datasets: [
      { label: 'Confirmed', data: confirmed, backgroundColor: 'rgba(59,130,246,0.7)',  borderRadius: 3 },
      { label: 'Completed', data: completed, backgroundColor: 'rgba(16,185,129,0.7)',  borderRadius: 3 },
      { label: 'Cancelled', data: cancelled, backgroundColor: 'rgba(239,68,68,0.5)',   borderRadius: 3 },
    ],
  };

  function handleExport() {
    const rows = [
      ['Booking ID', 'Guest', 'Room', 'Check-in', 'Check-out', 'Duration', 'Guests', 'Total', 'Status', 'Payment'],
      ...dateBookings.map(b => [
        b.id, b.guest, b.roomType,
        b.checkIn, b.checkOut, '8 hrs',
        b.guests, b.total, b.status, b.paymentMethod || '',
      ]),
    ];
    exportCSV(rows, `frontdesk-report-${reportDate}.csv`);
  }

  const reportDateLabel = new Date(reportDate + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <main className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        {/* Summary Cards for selected date */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Bookings', value: dateBookings.length,                                              color: 'blue',   icon: 'fa-calendar'      },
            { label: 'Confirmed',      value: dateBookings.filter(b => b.status === 'Confirmed').length,        color: 'indigo', icon: 'fa-check-circle'  },
            { label: 'Completed',      value: dateBookings.filter(b => b.status === 'Completed').length,        color: 'green',  icon: 'fa-check-double'  },
            { label: 'Revenue',        value: fmtMoney(totalRevenue),                                           color: 'purple', icon: 'fa-peso-sign'     },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-lg shadow p-5 flex items-center">
              <div className={`p-3 rounded-full bg-${card.color}-100 text-${card.color}-600 mr-4`}>
                <i className={`fas ${card.icon} text-lg`}></i>
              </div>
              <div>
                <p className="text-gray-500 text-xs">{card.label}</p>
                <p className="text-xl font-bold">{loading ? '—' : card.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Weekly Chart */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Bookings — Last 7 Days</h2>
            {loading ? (
              <div className="h-52 flex items-center justify-center text-gray-400">Loading...</div>
            ) : (
              <div className="h-52">
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                  }}
                />
              </div>
            )}
          </div>

          {/* Date selector + quick stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Daily Report</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
              <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
                className="border rounded px-3 py-2 w-full text-sm" />
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Total Bookings', dateBookings.length],
                ['Pending',        dateBookings.filter(b => b.status === 'Pending').length],
                ['Confirmed',      dateBookings.filter(b => b.status === 'Confirmed').length],
                ['Completed',      dateBookings.filter(b => b.status === 'Completed').length],
                ['Cancelled',      dateBookings.filter(b => b.status === 'Cancelled').length],
                ['Revenue',        fmtMoney(totalRevenue)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between border-b pb-1 last:border-0">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium">{loading ? '—' : val}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleExport}
              disabled={loading || dateBookings.length === 0}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <i className="fas fa-download mr-2"></i>Export CSV
            </button>
          </div>
        </div>

        {/* Activity Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Activity for {reportDateLabel}</h2>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 text-sm text-gray-600 border rounded px-3 py-1 hover:bg-gray-50">
              <i className="fas fa-print"></i> Print
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-gray-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading...
            </div>
          ) : dateBookings.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No bookings for this date.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Booking ID', 'Guest', 'Room', 'Check-in', 'Check-out', 'Duration', 'Guests', 'Total', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dateBookings.map(b => (
                    <tr key={b.booking_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500">{b.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{b.guest}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.roomType}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtTime(b.checkIn)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtTime(b.checkOut)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">8 hrs</td>
                      <td className="px-4 py-3 text-sm text-center">{b.guests}</td>
                      <td className="px-4 py-3 text-sm">{fmtMoney(b.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          b.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          b.status === 'Confirmed' ? 'bg-blue-100 text-blue-800' :
                          b.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold text-sm">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-right text-gray-600">Totals:</td>
                    <td className="px-4 py-3 text-center">
                      {dateBookings.reduce((s, b) => s + b.guests, 0)}
                    </td>
                    <td className="px-4 py-3">
                      {fmtMoney(dateBookings.reduce((s, b) => s + Number(b.total), 0))}
                    </td>
                    <td className="px-4 py-3 text-green-700">
                      {fmtMoney(totalRevenue)} collected
                    </td>
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
