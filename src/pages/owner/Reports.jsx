import { useEffect, useRef, useState, useMemo } from "react";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { getAnalyticsReport } from "../../lib/adminApi.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const ROOM_COLORS = ["rgba(59,130,246,0.7)","rgba(16,185,129,0.7)","rgba(251,191,36,0.7)","rgba(139,92,246,0.7)","rgba(236,72,153,0.7)"];
const DOT_COLORS  = ["#3b82f6","#10b981","#fbbf24","#8b5cf6","#ec4899"];
const PIE_COLORS  = ["rgba(59,130,246,0.8)","rgba(16,185,129,0.8)","rgba(251,191,36,0.8)","rgba(139,92,246,0.8)","rgba(236,72,153,0.8)"];

const STATUS_CLASSES = {
  Confirmed:   "bg-emerald-100 text-emerald-800",
  "Checked In":"bg-teal-100 text-teal-800",
  Completed:   "bg-blue-100 text-blue-800",
  Pending:     "bg-yellow-100 text-yellow-800",
  Cancelled:   "bg-red-100 text-red-800",
};


export default function OwnerReports() {
  const now = new Date();
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    getAnalyticsReport(month, year)
      .then((res) => setBookings(res.data.data ?? []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [month, year]);

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

  return (
    <div className="p-6 space-y-6">

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
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1e3a8a] rounded-lg hover:bg-[#152c6e] transition"
        >
          <i className="fas fa-print text-xs"></i>
          Print Report
        </button>
      </div>

      {/* Printable area */}
      <div ref={printRef} className="space-y-6">

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
    </div>
  );
}
