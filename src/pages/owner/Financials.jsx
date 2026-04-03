import { useEffect, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  getAnalyticsOverview,
  getAnalyticsBookings,
  getAnalyticsRooms,
} from "../../lib/adminApi.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

function printFinancials(dailyData, roomsData, overview, chartDays) {
  const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
  const period = `Last ${chartDays} Day${chartDays !== 1 ? 's' : ''}`;
  const fmtN = v => `₱${Number(v||0).toLocaleString('en-PH')}`;
  const totalRev = dailyData.reduce((s, r) => s + Number(r.revenue||0), 0);
  const totalBk  = dailyData.reduce((s, r) => s + Number(r.bookings||0), 0);
  const roomTotal = roomsData.reduce((s, r) => s + Number(r.revenue||0), 0);
  const roomBkTotal = roomsData.reduce((s, r) => s + Number(r.bookings||0), 0);
  const dailyRows = [...dailyData].reverse().map(r => `<tr><td>${r.date}</td><td style="text-align:center">${r.bookings}</td><td style="text-align:right">${fmtN(r.revenue)}</td><td style="text-align:right">${r.bookings>0?fmtN(Math.round(r.revenue/r.bookings)):'—'}</td></tr>`).join('');
  const roomRows = roomsData.map(r => `<tr><td>${r.label}</td><td style="text-align:center">${r.bookings}</td><td style="text-align:right">${fmtN(r.revenue)}</td><td style="text-align:right">${r.bookings>0?fmtN(Math.round(r.revenue/r.bookings)):'—'}</td></tr>`).join('');
  const revThisMonth = overview?.revenue_this_month ?? 0;
  const revLastMonth = overview?.revenue_last_month ?? 0;
  const revPct = revLastMonth > 0 ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100) : 0;
  const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10pt;color:#1a1a1a;padding:32px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px}.co{font-size:18pt;font-weight:bold;color:#1e3a8a}.cosub{font-size:9pt;color:#64748b;margin-top:3px}.rt{text-align:right}.rt h2{font-size:13pt;font-weight:bold;color:#1e3a8a}.rt p{font-size:10pt;color:#334155;margin-top:2px}.rt small{font-size:8pt;color:#94a3b8}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}.card{border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px}.lbl{font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.05em}.val{font-size:16pt;font-weight:bold;color:#0f172a;margin-top:4px}.hint{font-size:8pt;color:#94a3b8;margin-top:2px}.sec{margin-bottom:22px}.sech{font-size:9pt;font-weight:bold;color:#1e3a8a;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:10pt}th{background:#1e3a8a;color:#fff;padding:8px 10px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em}td{padding:6px 10px;border-bottom:1px solid #f1f5f9}tr:nth-child(even) td{background:#f8fafc}tfoot td{background:#1e3a8a!important;color:#fff!important;font-weight:bold;padding:8px 10px}.ftr{margin-top:28px;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;font-size:8pt;color:#94a3b8}@page{margin:1.5cm}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Financial Report</title><style>${css}</style></head><body>
<div class="hdr"><div><div class="co">AplayAccess</div><div class="cosub">Aplaya Beach Resort · Booking Management System</div></div><div class="rt"><h2>Financial Report</h2><p>${period}</p><small>Generated: ${now}</small></div></div>
<div class="cards"><div class="card"><div class="lbl">Revenue (${period})</div><div class="val">${fmtN(totalRev)}</div><div class="hint">${totalBk} bookings</div></div><div class="card"><div class="lbl">This Month Revenue</div><div class="val">${fmtN(revThisMonth)}</div><div class="hint">vs ${fmtN(revLastMonth)} last month</div></div><div class="card"><div class="lbl">Month-on-Month</div><div class="val" style="color:${revPct>=0?'#16a34a':'#dc2626'}">${revPct>=0?'+':''}${revPct}%</div><div class="hint">vs previous month</div></div><div class="card"><div class="lbl">Avg / Booking</div><div class="val">${totalBk>0?fmtN(Math.round(totalRev/totalBk)):'—'}</div><div class="hint">${period}</div></div></div>
<div class="sec"><div class="sech">Revenue by Room Type</div><table><thead><tr><th>Room Type</th><th style="text-align:center">Bookings</th><th style="text-align:right">Revenue</th><th style="text-align:right">Avg / Booking</th></tr></thead><tbody>${roomRows}</tbody><tfoot><tr><td>Total</td><td style="text-align:center">${roomBkTotal}</td><td style="text-align:right">${fmtN(roomTotal)}</td><td></td></tr></tfoot></table></div>
<div class="sec"><div class="sech">Daily Breakdown</div><table><thead><tr><th>Date</th><th style="text-align:center">Bookings</th><th style="text-align:right">Revenue</th><th style="text-align:right">Avg / Booking</th></tr></thead><tbody>${dailyRows}</tbody><tfoot><tr><td>Total</td><td style="text-align:center">${totalBk}</td><td style="text-align:right">${fmtN(totalRev)}</td><td style="text-align:right">${totalBk>0?fmtN(Math.round(totalRev/totalBk)):'—'}</td></tr></tfoot></table></div>
<div class="ftr"><span>AplayAccess · Aplaya Beach Resort</span><span>Confidential — Internal use only</span><span>Generated: ${now}</span></div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script></body></html>`;
  const w = window.open('','_blank'); w.document.write(html); w.document.close();
}


const BAR_COLORS = [
  "rgba(59, 130, 246, 0.7)",
  "rgba(16, 185, 129, 0.7)",
  "rgba(251, 191, 36, 0.7)",
  "rgba(139, 92, 246, 0.7)",
  "rgba(236, 72, 153, 0.7)",
];
const DOT_COLORS = ["#3b82f6", "#10b981", "#fbbf24", "#8b5cf6", "#ec4899"];

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "top" } },
};

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "top" } },
  scales: { y: { ticks: { callback: (v) => `₱${(v / 1000).toFixed(0)}k` } } },
};


export default function OwnerFinancials() {
  const [chartDays, setChartDays] = useState(30);

  const [overview,   setOverview]   = useState(null);
  const [dailyData,  setDailyData]  = useState([]);
  const [roomsData,  setRoomsData]  = useState([]);
  const [loadingOv,  setLoadingOv]  = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);

  // Overview: load once
  useEffect(() => {
    getAnalyticsOverview()
      .then((res) => setOverview(res.data.data))
      .catch(() => {})
      .finally(() => setLoadingOv(false));
  }, []);

  // Daily + rooms: reload when period changes
  useEffect(() => {
    setLoadingChart(true);
    Promise.all([
      getAnalyticsBookings(chartDays),
      getAnalyticsRooms(chartDays),
    ])
      .then(([dailyRes, roomsRes]) => {
        setDailyData(dailyRes.data.data ?? []);
        setRoomsData(roomsRes.data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingChart(false));
  }, [chartDays]);

  // Derived overview values
  const revThisMonth  = overview?.revenue_this_month  ?? 0;
  const revLastMonth  = overview?.revenue_last_month  ?? 0;
  const revPct = revLastMonth > 0
    ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100)
    : 0;
  const bookingsDiff = (overview?.bookings_this_month ?? 0) - (overview?.bookings_last_month ?? 0);

  // Chart datasets
  const shortLabel = (date) => (date ?? "").slice(5);

  const revenueLineData = {
    labels: dailyData.map((d) => shortLabel(d.date)),
    datasets: [{
      label: "This Period",
      data: dailyData.map((d) => Number(d.revenue ?? 0)),
      borderColor: "rgba(59, 130, 246, 0.8)",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      tension: 0.3,
      fill: true,
    }],
  };

  const bookingsLineData = {
    labels: dailyData.map((d) => shortLabel(d.date)),
    datasets: [{
      label: "This Period",
      data: dailyData.map((d) => Number(d.bookings ?? 0)),
      borderColor: "rgba(16, 185, 129, 0.8)",
      backgroundColor: "rgba(16, 185, 129, 0.1)",
      tension: 0.3,
      fill: true,
    }],
  };

  const roomBarData = {
    labels: roomsData.map((r) => r.label),
    datasets: [{
      label: "Revenue (₱)",
      data: roomsData.map((r) => Number(r.revenue ?? 0)),
      backgroundColor: roomsData.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
      borderRadius: 6,
    }],
  };

  return (
    <div className="p-6 space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-blue-800">Revenue Summary</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">This Month</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">This Month</span>
              <span className="font-medium">{loadingOv ? "—" : fmt(revThisMonth)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Month</span>
              <span className="font-medium">{loadingOv ? "—" : fmt(revLastMonth)}</span>
            </div>
            <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
              <span className="font-medium text-gray-700">Change</span>
              <span className={`font-bold ${revPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {loadingOv ? "—" : `${revPct >= 0 ? "+" : ""}${revPct}%`}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-green-800">Bookings Summary</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">This Month</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">This Month</span>
              <span className="font-medium">{loadingOv ? "—" : (overview?.bookings_this_month ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Month</span>
              <span className="font-medium">{loadingOv ? "—" : (overview?.bookings_last_month ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Confirmed</span>
              <span className="font-medium">{loadingOv ? "—" : (overview?.confirmed_bookings ?? 0)}</span>
            </div>
            <div className="flex justify-between border-t border-green-200 pt-2 mt-2">
              <span className="font-medium text-gray-700">Change</span>
              <span className={`font-bold ${bookingsDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                {loadingOv ? "—" : `${bookingsDiff >= 0 ? "+" : ""}${bookingsDiff}`}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-800">Guest Summary</h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">All Time</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Guests</span>
              <span className="font-medium">{loadingOv ? "—" : (overview?.total_guests ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pending Bookings</span>
              <span className="font-medium">{loadingOv ? "—" : (overview?.pending_bookings ?? 0)}</span>
            </div>
            <div className="flex justify-between border-t border-purple-200 pt-2 mt-2">
              <span className="font-medium text-gray-700">Total Bookings</span>
              <span className="font-bold text-purple-700">{loadingOv ? "—" : (overview?.total_bookings ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex justify-end">
        <select
          value={chartDays}
          onChange={(e) => setChartDays(Number(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 365 days</option>
        </select>
      </div>

      {/* Line charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Revenue</h2>
          <div className="h-64">
            {loadingChart ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : dailyData.length > 0 ? (
              <Line data={revenueLineData} options={lineOptions} />
            ) : (
              <p className="text-sm text-gray-400">No data for this period</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Bookings</h2>
          <div className="h-64">
            {loadingChart ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : dailyData.length > 0 ? (
              <Line data={bookingsLineData} options={lineOptions} />
            ) : (
              <p className="text-sm text-gray-400">No data for this period</p>
            )}
          </div>
        </div>
      </div>

      {/* Revenue by Room Type */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Revenue by Room Type</h2>
        {loadingChart ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : roomsData.length === 0 ? (
          <p className="text-sm text-gray-400">No room data for this period</p>
        ) : (
          <>
            {/* Chart height scales with room count; min 224px, +28px per room above 4 */}
            <div style={{ height: Math.max(224, 224 + (roomsData.length - 4) * 28) }}>
              <Bar data={roomBarData} options={barOptions} />
            </div>
            {/* Legend list: 2-col grid when ≥5 rooms, single col otherwise */}
            <div className={`mt-4 divide-y divide-slate-100 ${roomsData.length >= 5 ? "grid grid-cols-2 gap-x-6 divide-y-0" : ""}`}>
              {roomsData.map((r, i) => (
                <div key={r.label} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                    />
                    <span className="text-sm text-gray-700 truncate">{r.label}</span>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-gray-900">{fmt(r.revenue)}</p>
                    <p className="text-xs text-gray-400">{r.bookings} bookings</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Daily Breakdown Table */}
      <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Daily Breakdown</h3>
          <button
            onClick={() => printFinancials(dailyData, roomsData, overview, chartDays)}
            disabled={loadingChart}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#1e3a8a] border border-[#1e3a8a] rounded-lg hover:bg-blue-50 disabled:opacity-40 transition"
          >
            <i className="fas fa-print text-xs"></i>
            Print Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Bookings</th>
                <th className="px-6 py-3 text-left">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loadingChart ? (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-slate-400">Loading...</td>
                </tr>
              ) : [...dailyData].reverse().map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-500">{row.date}</td>
                  <td className="px-6 py-3">{row.bookings}</td>
                  <td className="px-6 py-3 font-medium text-slate-900">{fmt(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
            {!loadingChart && dailyData.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 text-sm font-semibold">
                <tr>
                  <td className="px-6 py-3 text-slate-700">Total</td>
                  <td className="px-6 py-3 text-slate-900">
                    {dailyData.reduce((s, r) => s + Number(r.bookings ?? 0), 0)}
                  </td>
                  <td className="px-6 py-3 text-slate-900">
                    {fmt(dailyData.reduce((s, r) => s + Number(r.revenue ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
}
