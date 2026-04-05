import { useEffect, useState, useMemo } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { getAnalyticsReport, getAnalyticsBookings, getAnalyticsRooms, getAnalyticsOverview } from "../../lib/adminApi.js";
import Toast, { useToast } from "../../components/ui/Toast";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const ROOM_COLORS = ["rgba(59,130,246,0.7)","rgba(16,185,129,0.7)","rgba(251,191,36,0.7)","rgba(139,92,246,0.7)","rgba(236,72,153,0.7)"];
const DOT_COLORS  = ["#3b82f6","#10b981","#fbbf24","#8b5cf6","#ec4899"];
const PIE_COLORS  = ["rgba(59,130,246,0.8)","rgba(16,185,129,0.8)","rgba(251,191,36,0.8)","rgba(139,92,246,0.8)","rgba(236,72,153,0.8)"];

function printReport({ bookings, active, revenue, avgVal, nights, period, roomTypes, roomRevenue, roomBookings }) {
  const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
  const statusBadge = (s) => {
    const map = { Completed:'#1e40af:#dbeafe', Confirmed:'#065f46:#d1fae5', Pending:'#92400e:#fef3c7', Cancelled:'#991b1b:#fee2e2', 'Checked In':'#0f766e:#ccfbf1' };
    const [fg, bg] = (map[s] || '#374151:#f3f4f6').split(':');
    return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:8pt;font-weight:bold;color:${fg};background:${bg}">${s}</span>`;
  };
  const fmtN = v => Number(v||0).toLocaleString('en-PH');
  const statusCount = (s) => bookings.filter(b => b.status === s).length;
  const roomRows = roomTypes.map((r, i) => roomBookings[i] > 0 ? `<tr><td>${r}</td><td style="text-align:center">${roomBookings[i]}</td><td style="text-align:right">₱${fmtN(roomRevenue[i])}</td><td style="text-align:right">₱${fmtN(Math.round(roomRevenue[i]/roomBookings[i]))}</td></tr>` : '').join('');
  const bookingRows = bookings.map(b => `<tr${b.status==='Cancelled'?' style="color:#94a3b8"':''}><td>${b.guest}</td><td>${b.room}</td><td>${b.payment||'—'}</td><td style="text-align:center">${b.nights}</td><td style="text-align:right">${b.status==='Cancelled'?`<s>₱${fmtN(b.total)}</s>`:`₱${fmtN(b.total)}`}</td><td>${statusBadge(b.status)}</td></tr>`).join('');
  const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11pt;color:#1a1a1a;padding:32px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px}.co{font-size:18pt;font-weight:bold;color:#1e3a8a}.cosub{font-size:9pt;color:#64748b;margin-top:3px}.rt{text-align:right}.rt h2{font-size:13pt;font-weight:bold;color:#1e3a8a}.rt p{font-size:10pt;color:#334155;margin-top:2px}.rt small{font-size:8pt;color:#94a3b8}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}.card{border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px}.lbl{font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.05em}.val{font-size:17pt;font-weight:bold;color:#0f172a;margin-top:4px}.hint{font-size:8pt;color:#94a3b8;margin-top:2px}.srow{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:24px}.sbox{border:1px solid #e2e8f0;border-radius:6px;padding:10px;text-align:center}.sbox .n{font-size:20pt;font-weight:bold;color:#0f172a}.sbox .s{font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.sec{margin-bottom:22px}.sech{font-size:9pt;font-weight:bold;color:#1e3a8a;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:10pt}th{background:#1e3a8a;color:#fff;padding:8px 10px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em}td{padding:7px 10px;border-bottom:1px solid #f1f5f9}tr:nth-child(even) td{background:#f8fafc}tfoot td{background:#1e3a8a!important;color:#fff!important;font-weight:bold;padding:8px 10px}.ftr{margin-top:28px;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;font-size:8pt;color:#94a3b8}@page{margin:1.5cm}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Monthly Report — ${period}</title><style>${css}</style></head><body>
<div class="hdr"><div><div class="co">AplayAccess</div><div class="cosub">Aplaya Beach Resort · Booking Management System</div></div><div class="rt"><h2>Monthly Report</h2><p>${period}</p><small>Generated: ${now}</small></div></div>
<div class="cards"><div class="card"><div class="lbl">Total Revenue</div><div class="val">₱${fmtN(revenue)}</div><div class="hint">Excluding cancelled</div></div><div class="card"><div class="lbl">Total Bookings</div><div class="val">${bookings.length}</div><div class="hint">${active.length} active · ${bookings.length-active.length} cancelled</div></div><div class="card"><div class="lbl">Avg. Stay Value</div><div class="val">₱${fmtN(Math.round(avgVal))}</div><div class="hint">Per active booking</div></div><div class="card"><div class="lbl">Total Nights</div><div class="val">${Math.round(nights)}</div><div class="hint">Active bookings only</div></div></div>
<div class="sec"><div class="sech">Booking Status Breakdown</div><div class="srow">${['Confirmed','Checked In','Completed','Pending','Cancelled'].map(s=>`<div class="sbox"><div class="n">${statusCount(s)}</div><div class="s">${s}</div></div>`).join('')}</div></div>
<div class="sec"><div class="sech">Revenue by Room Type</div><table><thead><tr><th>Room Type</th><th style="text-align:center">Bookings</th><th style="text-align:right">Revenue</th><th style="text-align:right">Avg / Booking</th></tr></thead><tbody>${roomRows}</tbody><tfoot><tr><td>Total</td><td style="text-align:center">${active.length}</td><td style="text-align:right">₱${fmtN(revenue)}</td><td style="text-align:right">₱${active.length?fmtN(Math.round(revenue/active.length)):'—'}</td></tr></tfoot></table></div>
<div class="sec"><div class="sech">Booking Details</div><table><thead><tr><th>Guest</th><th>Room Type</th><th>Payment</th><th style="text-align:center">Nights</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead><tbody>${bookingRows}</tbody><tfoot><tr><td colspan="4">Total (excl. cancelled)</td><td style="text-align:right">₱${fmtN(revenue)}</td><td></td></tr></tfoot></table></div>
<div class="ftr"><span>AplayAccess · Aplaya Beach Resort</span><span>Confidential — Internal use only</span><span>Generated: ${now}</span></div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script></body></html>`;
  const w = window.open('','_blank'); w.document.write(html); w.document.close();
}

const STATUS_CLASSES = {
  Confirmed:   "bg-emerald-100 text-emerald-800",
  "Checked In":"bg-teal-100 text-teal-800",
  Completed:   "bg-blue-100 text-blue-800",
  Pending:     "bg-yellow-100 text-yellow-800",
  Cancelled:   "bg-red-100 text-red-800",
};


const BAR_COLORS = ["rgba(59,130,246,0.7)","rgba(16,185,129,0.7)","rgba(251,191,36,0.7)","rgba(139,92,246,0.7)","rgba(236,72,153,0.7)"];

export default function OwnerReports() {
  const now = new Date();
  const [toast, showToast, clearToast, toastType] = useToast();
  const [tab, setTab] = useState("monthly"); // "monthly" | "analytics"

  // ── Monthly Report state ──────────────────────────────────────────────────
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [year,     setYear]     = useState(now.getFullYear());
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    getAnalyticsReport(month, year)
      .then((res) => setBookings(res.data.data ?? []))
      .catch(() => { setBookings([]); showToast("Failed to load report data.", "error"); })
      .finally(() => setLoading(false));
  }, [month, year]);

  // ── Analytics state ───────────────────────────────────────────────────────
  const [chartDays,    setChartDays]    = useState(30);
  const [overview,     setOverview]     = useState(null);
  const [dailyData,    setDailyData]    = useState([]);
  const [roomsData,    setRoomsData]    = useState([]);
  const [loadingOv,    setLoadingOv]    = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);

  useEffect(() => {
    getAnalyticsOverview()
      .then((res) => setOverview(res.data.data))
      .catch(() => showToast("Failed to load report data.", "error"))
      .finally(() => setLoadingOv(false));
  }, []);

  useEffect(() => {
    setLoadingChart(true);
    Promise.all([getAnalyticsBookings(chartDays), getAnalyticsRooms(chartDays)])
      .then(([dRes, rRes]) => { setDailyData(dRes.data.data ?? []); setRoomsData(rRes.data.data ?? []); })
      .catch(() => showToast("Failed to load report data.", "error"))
      .finally(() => setLoadingChart(false));
  }, [chartDays]);

  const active  = useMemo(() => bookings.filter((b) => b.status !== "Cancelled"), [bookings]);
  const revenue = useMemo(() => active.reduce((s, b) => s + Number(b.total ?? 0), 0), [active]);
  const avgVal  = active.length ? revenue / active.length : 0;
  const nights  = useMemo(() => active.reduce((s, b) => s + Number(b.nights ?? 0), 0), [active]);
  const period  = `${MONTH_NAMES[month - 1]} ${year}`;

  // Room type breakdown
  const roomTypes    = useMemo(() => [...new Set(bookings.map((b) => b.room))], [bookings]);
  const roomRevenue  = useMemo(() => roomTypes.map((r) => active.filter((b) => b.room === r).reduce((s, b) => s + Number(b.total ?? 0), 0)), [roomTypes, active]);
  const roomBookings = useMemo(() => roomTypes.map((r) => active.filter((b) => b.room === r).length), [roomTypes, active]);

  const roomBarData = {
    labels: roomTypes,
    datasets: [{
      label: "Revenue (₱)",
      data: roomRevenue,
      backgroundColor: ROOM_COLORS,
      borderRadius: 6,
    }],
  };

  // Payment + status pies
  const paymentTypes  = useMemo(() => [...new Set(bookings.map((b) => b.payment))], [bookings]);
  const statusTypes   = useMemo(() => [...new Set(bookings.map((b) => b.status))],  [bookings]);

  const paymentPieData = {
    labels: paymentTypes,
    datasets: [{ data: paymentTypes.map((p) => bookings.filter((b) => b.payment === p).length), backgroundColor: PIE_COLORS }],
  };
  const statusPieData = {
    labels: statusTypes,
    datasets: [{ data: statusTypes.map((s) => bookings.filter((b) => b.status === s).length), backgroundColor: PIE_COLORS }],
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { ticks: { callback: (v) => `₱${(v / 1000).toFixed(0)}k` } } },
  };
  const pieOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };

  // Generate years: 2 years back to current
  const currentYear = now.getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  // ── Analytics chart data ─────────────────────────────────────────────────
  const shortLabel = (d) => (d ?? "").slice(5);
  const revThisMonth  = overview?.revenue_this_month ?? 0;
  const revLastMonth  = overview?.revenue_last_month ?? 0;
  const revPct = revLastMonth > 0 ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100) : 0;
  const totalRev = dailyData.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const totalBk  = dailyData.reduce((s, r) => s + Number(r.bookings ?? 0), 0);

  const revenueLineData = {
    labels: dailyData.map((d) => shortLabel(d.date)),
    datasets: [{ label: "Revenue", data: dailyData.map((d) => Number(d.revenue ?? 0)), borderColor: "rgba(59,130,246,0.8)", backgroundColor: "rgba(59,130,246,0.1)", tension: 0.3, fill: true }],
  };
  const bookingsLineData = {
    labels: dailyData.map((d) => shortLabel(d.date)),
    datasets: [{ label: "Bookings", data: dailyData.map((d) => Number(d.bookings ?? 0)), borderColor: "rgba(16,185,129,0.8)", backgroundColor: "rgba(16,185,129,0.1)", tension: 0.3, fill: true }],
  };
  const analyticsRoomBarData = {
    labels: roomsData.map((r) => r.label),
    datasets: [{ label: "Revenue (₱)", data: roomsData.map((r) => Number(r.revenue ?? 0)), backgroundColor: roomsData.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]), borderRadius: 6 }],
  };
  const lineOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } };
  const analyticsBarOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { ticks: { callback: (v) => `₱${(v/1000).toFixed(0)}k` } } } };

  return (
    <div className="p-6 space-y-6">

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[["monthly","fa-file-alt","Monthly Report"],["analytics","fa-chart-line","Analytics"]].map(([key,icon,label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab===key ? "border-[#1e3a8a] text-[#1e3a8a]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <i className={`fas ${icon} text-xs`}></i>{label}
          </button>
        ))}
      </div>

      {/* ── Analytics Tab ───────────────────────────────────────────────── */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: "Revenue This Month", value: loadingOv ? "—" : fmt(revThisMonth), sub: `vs ${fmt(revLastMonth)} last month`, color: "bg-blue-50 text-blue-800" },
              { label: "Month-on-Month", value: loadingOv ? "—" : `${revPct >= 0 ? "+" : ""}${revPct}%`, sub: "vs previous month", color: revPct >= 0 ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800" },
              { label: `Revenue (${chartDays}d)`, value: loadingChart ? "—" : fmt(totalRev), sub: `${totalBk} bookings`, color: "bg-purple-50 text-purple-800" },
              { label: "Avg / Booking", value: loadingChart ? "—" : fmt(totalBk > 0 ? Math.round(totalRev / totalBk) : 0), sub: `last ${chartDays} days`, color: "bg-yellow-50 text-yellow-800" },
            ].map(c => (
              <div key={c.label} className={`rounded-lg p-5 ${c.color}`}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
                <p className="text-xs opacity-60 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Period selector */}
          <div className="flex justify-end">
            <select value={chartDays} onChange={(e) => setChartDays(Number(e.target.value))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 365 days</option>
            </select>
          </div>

          {/* Line charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6"><h2 className="text-lg font-semibold mb-4">Daily Revenue</h2><div className="h-64">{loadingChart ? <p className="text-sm text-gray-400">Loading...</p> : <Line data={revenueLineData} options={lineOptions} />}</div></div>
            <div className="bg-white rounded-lg shadow p-6"><h2 className="text-lg font-semibold mb-4">Daily Bookings</h2><div className="h-64">{loadingChart ? <p className="text-sm text-gray-400">Loading...</p> : <Line data={bookingsLineData} options={lineOptions} />}</div></div>
          </div>

          {/* Revenue by room type */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Revenue by Room Type</h2>
            {loadingChart ? <p className="text-sm text-gray-400">Loading...</p> : roomsData.length === 0 ? <p className="text-sm text-gray-400">No data for this period</p> : (
              <>
                <div style={{ height: Math.max(224, 224 + (roomsData.length - 4) * 28) }}><Bar data={analyticsRoomBarData} options={analyticsBarOptions} /></div>
                <div className={`mt-4 divide-y divide-slate-100 ${roomsData.length >= 5 ? "grid grid-cols-2 gap-x-6 divide-y-0" : ""}`}>
                  {roomsData.map((r, i) => (
                    <div key={r.label} className="flex items-center justify-between py-2 border-b border-slate-100">
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} /><span className="text-sm text-gray-700 truncate">{r.label}</span></div>
                      <div className="text-right shrink-0 ml-3"><p className="text-sm font-semibold text-gray-900">{fmt(r.revenue)}</p><p className="text-xs text-gray-400">{r.bookings} bookings</p></div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Daily breakdown table */}
          <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Daily Breakdown</h3>
              <button onClick={() => { /* print financials */ }} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#1e3a8a] border border-[#1e3a8a] rounded-lg hover:bg-blue-50 transition">
                <i className="fas fa-print text-xs"></i>Print
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr><th className="px-6 py-3 text-left">Date</th><th className="px-6 py-3 text-left">Bookings</th><th className="px-6 py-3 text-left">Revenue</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingChart ? <tr><td colSpan={3} className="px-6 py-6 text-center text-slate-400">Loading...</td></tr>
                    : [...dailyData].reverse().map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50"><td className="px-6 py-3 text-slate-500">{row.date}</td><td className="px-6 py-3">{row.bookings}</td><td className="px-6 py-3 font-medium text-slate-900">{fmt(row.revenue)}</td></tr>
                    ))}
                </tbody>
                {!loadingChart && dailyData.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-300 text-sm font-semibold">
                    <tr><td className="px-6 py-3 text-slate-700">Total</td><td className="px-6 py-3 text-slate-900">{totalBk}</td><td className="px-6 py-3 text-slate-900">{fmt(totalRev)}</td></tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Monthly Report Tab ───────────────────────────────────────────── */}
      {tab === "monthly" && (<>

      {/* Header controls */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={() => printReport({ bookings, active, revenue, avgVal, nights, period, roomTypes, roomRevenue, roomBookings })}
          disabled={loading || bookings.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1e3a8a] rounded-lg hover:bg-[#152c6e] disabled:opacity-40 transition"
        >
          <i className="fas fa-print text-xs"></i>
          Print Report
        </button>
      </div>

      {/* Printable area */}
      <div className="space-y-6">

        {/* Report title */}
        <div className="bg-[#1e3a8a] text-white rounded-xl px-6 py-5">
          <p className="text-blue-200 text-sm uppercase tracking-wide">Monthly Report</p>
          <h2 className="text-2xl font-bold mt-1">{period}</h2>
          <p className="text-blue-200 text-sm mt-1">Aplaya Beach Resort</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue",   value: loading ? "—" : fmt(revenue),           icon: "fa-money-bill-wave", color: "bg-green-100 text-green-600"  },
            { label: "Total Bookings",  value: loading ? "—" : bookings.length,          icon: "fa-calendar-check",  color: "bg-blue-100 text-blue-600"    },
            { label: "Avg. Stay Value", value: loading ? "—" : fmt(Math.round(avgVal)),  icon: "fa-calculator",      color: "bg-purple-100 text-purple-600" },
            { label: "Total Nights",    value: loading ? "—" : Math.round(nights),                   icon: "fa-moon",            color: "bg-yellow-100 text-yellow-600" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs">{c.label}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                </div>
                <div className={`p-3 rounded-full ${c.color}`}>
                  <i className={`fas ${c.icon} text-lg`}></i>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue by Room Type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Revenue by Room Type</h3>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : active.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No data for this period.</p>
          ) : (
            <>
              <div style={{ height: Math.max(208, 208 + (roomTypes.length - 4) * 28) }}>
                <Bar data={roomBarData} options={barOptions} />
              </div>
              <div className={`mt-4 ${roomTypes.length >= 5 ? "grid grid-cols-2 gap-x-6" : "divide-y divide-slate-100"}`}>
                {roomTypes.map((r, i) => (
                  roomBookings[i] > 0 && (
                    <div key={r} className="flex items-center justify-between py-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                        <span className="text-sm text-gray-700 truncate">{r}</span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-semibold text-gray-900">{fmt(roomRevenue[i])}</p>
                        <p className="text-xs text-gray-400">{roomBookings[i]} booking{roomBookings[i] !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </>
          )}
        </div>

        {/* Status + Payment charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Booking Status</h3>
            <div className="h-52">
              {loading ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : bookings.length > 0 ? (
                <Pie data={statusPieData} options={pieOptions} />
              ) : (
                <p className="text-gray-400 text-sm text-center pt-16">No data for this period.</p>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Payment Methods</h3>
            <div className="h-52">
              {loading ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : bookings.length > 0 ? (
                <Pie data={paymentPieData} options={pieOptions} />
              ) : (
                <p className="text-gray-400 text-sm text-center pt-16">No data for this period.</p>
              )}
            </div>
          </div>
        </div>

        {/* Booking list */}
        <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Booking Details — {period}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Guest</th>
                  <th className="px-6 py-3 text-left">Room Type</th>
                  <th className="px-6 py-3 text-left">Payment</th>
                  <th className="px-6 py-3 text-left">Nights</th>
                  <th className="px-6 py-3 text-left">Amount</th>
                  <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Loading...</td></tr>
                ) : bookings.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">No bookings for this period.</td></tr>
                ) : bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{b.guest}</td>
                    <td className="px-6 py-3 text-slate-500">{b.room}</td>
                    <td className="px-6 py-3 text-slate-500">{b.payment || "—"}</td>
                    <td className="px-6 py-3">{b.nights}</td>
                    <td className="px-6 py-3 font-medium">
                      {b.status === "Cancelled"
                        ? <span className="line-through text-slate-400">{fmt(b.total)}</span>
                        : fmt(b.total)}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[b.status] || "bg-gray-100 text-gray-800"}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {!loading && bookings.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-semibold text-sm">
                  <tr>
                    <td colSpan={4} className="px-6 py-3 text-slate-700">Total (excl. cancelled)</td>
                    <td className="px-6 py-3 text-slate-900">{fmt(revenue)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>

      </>)}

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
