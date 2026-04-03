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


function printDailyReport(dateBookings, reportDateLabel, totalRevenue) {
  const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
  const fmtM = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  const fmtT = dt => { if (!dt) return '—'; return new Date(dt.replace(' ','T')).toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit',hour12:true}); };
  const statusBadge = (s) => {
    const map = { Completed:'#1e40af:#dbeafe', Confirmed:'#065f46:#d1fae5', Pending:'#92400e:#fef3c7', Cancelled:'#991b1b:#fee2e2', 'Checked In':'#0f766e:#ccfbf1' };
    const [fg, bg] = (map[s] || '#374151:#f3f4f6').split(':');
    return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:8pt;font-weight:bold;color:${fg};background:${bg}">${s}</span>`;
  };
  const statusCount = (s) => dateBookings.filter(b => b.status === s).length;
  const grossTotal = dateBookings.reduce((s,b) => s + Number(b.total||0), 0);
  const totalGuests = dateBookings.reduce((s,b) => s + (b.guests||0), 0);
  const tableRows = dateBookings.map(b => `<tr${b.status==='Cancelled'?' style="color:#94a3b8"':''}><td style="font-family:monospace;font-size:8.5pt;color:#64748b">${b.id}</td><td>${b.guest}</td><td>${b.roomType}</td><td>${fmtT(b.checkIn)}</td><td>${fmtT(b.checkOut)}</td><td style="text-align:center">8 hrs</td><td style="text-align:center">${b.guests}</td><td style="text-align:right">${fmtM(b.total)}</td><td>${statusBadge(b.status)}</td></tr>`).join('');
  const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10pt;color:#1a1a1a;padding:32px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px}.co{font-size:18pt;font-weight:bold;color:#1e3a8a}.cosub{font-size:9pt;color:#64748b;margin-top:3px}.rt{text-align:right}.rt h2{font-size:13pt;font-weight:bold;color:#1e3a8a}.rt p{font-size:10pt;color:#334155;margin-top:2px}.rt small{font-size:8pt;color:#94a3b8}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}.card{border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px}.lbl{font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.05em}.val{font-size:16pt;font-weight:bold;color:#0f172a;margin-top:4px}.hint{font-size:8pt;color:#94a3b8;margin-top:2px}.srow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}.sbox{border:1px solid #e2e8f0;border-radius:6px;padding:10px;text-align:center}.sbox .n{font-size:18pt;font-weight:bold;color:#0f172a}.sbox .s{font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.sech{font-size:9pt;font-weight:bold;color:#1e3a8a;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px;margin-top:20px}table{width:100%;border-collapse:collapse;font-size:9pt}th{background:#1e3a8a;color:#fff;padding:7px 8px;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.04em}td{padding:6px 8px;border-bottom:1px solid #f1f5f9}tr:nth-child(even) td{background:#f8fafc}tfoot td{background:#1e3a8a!important;color:#fff!important;font-weight:bold;padding:7px 8px}.ftr{margin-top:28px;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;font-size:8pt;color:#94a3b8}@page{margin:1.5cm}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Daily Report — ${reportDateLabel}</title><style>${css}</style></head><body>
<div class="hdr"><div><div class="co">AplayAccess</div><div class="cosub">Aplaya Beach Resort · Front Desk</div></div><div class="rt"><h2>Daily Activity Report</h2><p>${reportDateLabel}</p><small>Generated: ${now}</small></div></div>
<div class="cards"><div class="card"><div class="lbl">Total Bookings</div><div class="val">${dateBookings.length}</div></div><div class="card"><div class="lbl">Total Guests</div><div class="val">${totalGuests}</div></div><div class="card"><div class="lbl">Revenue Collected</div><div class="val" style="font-size:13pt">${fmtM(totalRevenue)}</div><div class="hint">Completed + forfeited fees</div></div><div class="card"><div class="lbl">Gross Total</div><div class="val" style="font-size:13pt">${fmtM(grossTotal)}</div><div class="hint">Cancelled = reservation fee only</div></div></div>
<div class="sech" style="margin-top:0">Status Breakdown</div><div class="srow">${['Confirmed','Completed','Pending','Cancelled'].map(s=>`<div class="sbox"><div class="n">${statusCount(s)}</div><div class="s">${s}</div></div>`).join('')}</div>
<div class="sech">Booking Details</div>
<table><thead><tr><th>ID</th><th>Guest</th><th>Room</th><th>Check-in</th><th>Check-out</th><th style="text-align:center">Duration</th><th style="text-align:center">Guests</th><th style="text-align:right">Total</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody><tfoot><tr><td colspan="6">Totals</td><td style="text-align:center">${totalGuests}</td><td style="text-align:right">${fmtM(grossTotal)}</td><td style="text-align:right">${fmtM(totalRevenue)} collected</td></tr></tfoot></table>
<div class="ftr"><span>AplayAccess · Aplaya Beach Resort · Front Desk</span><span>Confidential — Internal use only</span><span>Generated: ${now}</span></div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script></body></html>`;
  const w = window.open('','_blank'); w.document.write(html); w.document.close();
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

  // Revenue = completed totals + full total for cancelled (whatever was paid is retained)
  const totalRevenue =
    dateBookings.filter(b => b.status === 'Completed').reduce((s, b) => s + Number(b.total ?? 0), 0) +
    dateBookings.filter(b => b.status === 'Cancelled').reduce((s, b) => s + Number(b.total ?? 0), 0);

  const { labels, confirmed, completed, cancelled } = buildWeekChart(bookings);
  const chartData = {
    labels,
    datasets: [
      { label: 'Confirmed', data: confirmed, backgroundColor: 'rgba(59,130,246,0.7)',  borderRadius: 3 },
      { label: 'Completed', data: completed, backgroundColor: 'rgba(16,185,129,0.7)',  borderRadius: 3 },
      { label: 'Cancelled', data: cancelled, backgroundColor: 'rgba(239,68,68,0.5)',   borderRadius: 3 },
    ],
  };


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
              onClick={() => printDailyReport(dateBookings, reportDateLabel, totalRevenue)}
              disabled={loading || dateBookings.length === 0}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <i className="fas fa-print mr-2"></i>Print Report
            </button>
          </div>
        </div>

        {/* Activity Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Activity for {reportDateLabel}</h2>
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
