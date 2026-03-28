import { useState, useRef } from "react";
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

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

// All sample bookings with month info for filtering
const ALL_BOOKINGS = [
  { id: 1,  month: 3, year: 2026, guest: "Maria Santos",    room: "Beachfront Suite", payment: "GCash",   total: 12000, status: "Confirmed", nights: 2 },
  { id: 2,  month: 3, year: 2026, guest: "John dela Cruz",  room: "Standard Room",    payment: "Cash",    total: 4500,  status: "Completed", nights: 1 },
  { id: 3,  month: 3, year: 2026, guest: "Ana Reyes",       room: "Family Cottage",   payment: "PayMaya", total: 9800,  status: "Confirmed", nights: 2 },
  { id: 4,  month: 3, year: 2026, guest: "Carlo Lim",       room: "Deluxe Room",      payment: "GCash",   total: 7200,  status: "Completed", nights: 2 },
  { id: 5,  month: 3, year: 2026, guest: "Rosa Mendoza",    room: "Beachfront Suite", payment: "Cash",    total: 12000, status: "Pending",   nights: 2 },
  { id: 6,  month: 3, year: 2026, guest: "Luis Garcia",     room: "Standard Room",    payment: "GCash",   total: 4500,  status: "Completed", nights: 1 },
  { id: 7,  month: 3, year: 2026, guest: "Celia Torres",    room: "Deluxe Room",      payment: "PayMaya", total: 7200,  status: "Cancelled", nights: 2 },
  { id: 8,  month: 3, year: 2026, guest: "Ramon Cruz",      room: "Family Cottage",   payment: "Cash",    total: 9800,  status: "Completed", nights: 2 },
  { id: 9,  month: 3, year: 2026, guest: "Lucia Bautista",  room: "Standard Room",    payment: "GCash",   total: 4500,  status: "Confirmed", nights: 1 },
  { id: 10, month: 3, year: 2026, guest: "Pedro Castillo",  room: "Beachfront Suite", payment: "PayMaya", total: 12000, status: "Completed", nights: 2 },
  { id: 11, month: 3, year: 2026, guest: "Gloria Navarro",  room: "Deluxe Room",      payment: "Cash",    total: 7200,  status: "Completed", nights: 2 },
  { id: 12, month: 3, year: 2026, guest: "Felix Domingo",   room: "Standard Room",    payment: "GCash",   total: 4500,  status: "Cancelled", nights: 1 },
  { id: 13, month: 3, year: 2026, guest: "Nora Villanueva", room: "Family Cottage",   payment: "PayMaya", total: 9800,  status: "Completed", nights: 2 },
  { id: 14, month: 3, year: 2026, guest: "Sergio Ramos",    room: "Standard Room",    payment: "Cash",    total: 4500,  status: "Confirmed", nights: 1 },
  { id: 15, month: 3, year: 2026, guest: "Elena Aquino",    room: "Beachfront Suite", payment: "GCash",   total: 12000, status: "Completed", nights: 2 },
  { id: 16, month: 2, year: 2026, guest: "Mario Reyes",     room: "Deluxe Room",      payment: "GCash",   total: 7200,  status: "Completed", nights: 2 },
  { id: 17, month: 2, year: 2026, guest: "Tina Lopez",      room: "Standard Room",    payment: "Cash",    total: 4500,  status: "Completed", nights: 1 },
  { id: 18, month: 2, year: 2026, guest: "Ben Santos",      room: "Family Cottage",   payment: "PayMaya", total: 9800,  status: "Cancelled", nights: 2 },
  { id: 19, month: 2, year: 2026, guest: "Clara Tan",       room: "Beachfront Suite", payment: "GCash",   total: 12000, status: "Completed", nights: 2 },
  { id: 20, month: 2, year: 2026, guest: "Oscar Vera",      room: "Standard Room",    payment: "Cash",    total: 4500,  status: "Completed", nights: 1 },
  { id: 21, month: 1, year: 2026, guest: "Diana Cruz",      room: "Deluxe Room",      payment: "GCash",   total: 7200,  status: "Completed", nights: 2 },
  { id: 22, month: 1, year: 2026, guest: "Frank Lim",       room: "Beachfront Suite", payment: "PayMaya", total: 12000, status: "Completed", nights: 2 },
  { id: 23, month: 1, year: 2026, guest: "Grace Mendoza",   room: "Standard Room",    payment: "Cash",    total: 4500,  status: "Cancelled", nights: 1 },
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const ROOM_COLORS = ["rgba(59,130,246,0.7)","rgba(16,185,129,0.7)","rgba(251,191,36,0.7)","rgba(139,92,246,0.7)"];
const PIE_COLORS  = ["rgba(59,130,246,0.8)","rgba(16,185,129,0.8)","rgba(251,191,36,0.8)","rgba(139,92,246,0.8)","rgba(236,72,153,0.8)"];

function exportCSV(bookings, period) {
  const headers = ["Guest", "Room Type", "Payment Method", "Amount (PHP)", "Status", "Nights"];
  const lines = [
    `# Report — ${period}`,
    headers.join(","),
    ...bookings.map((b) => [
      `"${b.guest}"`, `"${b.room}"`, b.payment, b.total, b.status, b.nights,
    ].join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `report_${period.replace(/\s/g, "_").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OwnerReports() {
  const [month, setMonth] = useState(3);
  const [year,  setYear]  = useState(2026);
  const printRef = useRef(null);

  const bookings = ALL_BOOKINGS.filter((b) => b.month === month && b.year === year);
  const active   = bookings.filter((b) => b.status !== "Cancelled");
  const revenue  = active.reduce((s, b) => s + b.total, 0);
  const avgVal   = active.length ? revenue / active.length : 0;
  const nights   = active.reduce((s, b) => s + b.nights, 0);
  const period   = `${MONTH_NAMES[month - 1]} ${year}`;

  // Room type breakdown
  const roomTypes = [...new Set(ALL_BOOKINGS.map((b) => b.room))];
  const roomRevenue  = roomTypes.map((r) => active.filter((b) => b.room === r).reduce((s, b) => s + b.total, 0));
  const roomBookings = roomTypes.map((r) => active.filter((b) => b.room === r).length);

  const roomBarData = {
    labels: roomTypes,
    datasets: [{
      label: "Revenue (₱)",
      data: roomRevenue,
      backgroundColor: ROOM_COLORS,
      borderRadius: 6,
    }],
  };

  // Payment breakdown
  const paymentTypes = [...new Set(bookings.map((b) => b.payment))];
  const paymentCounts = paymentTypes.map((p) => bookings.filter((b) => b.payment === p).length);
  const paymentPieData = {
    labels: paymentTypes,
    datasets: [{ data: paymentCounts, backgroundColor: PIE_COLORS }],
  };

  // Status breakdown
  const statusTypes = [...new Set(bookings.map((b) => b.status))];
  const statusCounts = statusTypes.map((s) => bookings.filter((b) => b.status === s).length);
  const statusPieData = {
    labels: statusTypes,
    datasets: [{ data: statusCounts, backgroundColor: PIE_COLORS }],
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { ticks: { callback: (v) => `₱${(v / 1000).toFixed(0)}k` } } },
  };
  const pieOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };

  return (
    <div className="p-6 space-y-6">

      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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
            {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV(bookings, period)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1e3a8a] border border-[#1e3a8a] rounded-lg hover:bg-blue-50 transition"
          >
            <i className="fas fa-download text-xs"></i>
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1e3a8a] rounded-lg hover:bg-[#152c6e] transition"
          >
            <i className="fas fa-print text-xs"></i>
            Print Report
          </button>
        </div>
      </div>

      {/* Printable area */}
      <div ref={printRef} className="space-y-6">

        {/* Report title */}
        <div className="bg-[#1e3a8a] text-white rounded-xl px-6 py-5">
          <p className="text-blue-200 text-sm uppercase tracking-wide">Monthly Report</p>
          <h2 className="text-2xl font-bold mt-1">{period}</h2>
          <p className="text-blue-200 text-sm mt-1">AplayAccess Beach Resort</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue",    value: fmt(revenue),            icon: "fa-money-bill-wave", color: "bg-green-100 text-green-600"  },
            { label: "Total Bookings",   value: bookings.length,          icon: "fa-calendar-check",  color: "bg-blue-100 text-blue-600"    },
            { label: "Avg. Stay Value",  value: fmt(Math.round(avgVal)),  icon: "fa-calculator",      color: "bg-purple-100 text-purple-600" },
            { label: "Total Nights",     value: nights,                   icon: "fa-moon",             color: "bg-yellow-100 text-yellow-600" },
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
          {active.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No data for this period.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="h-52">
                <Bar data={roomBarData} options={barOptions} />
              </div>
              <div className="divide-y divide-slate-100">
                {roomTypes.map((r, i) => (
                  roomBookings[i] > 0 && (
                    <div key={r} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: ["#3b82f6","#10b981","#fbbf24","#8b5cf6"][i] }} />
                        <span className="text-sm text-gray-700">{r}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{fmt(roomRevenue[i])}</p>
                        <p className="text-xs text-gray-400">{roomBookings[i]} booking{roomBookings[i] !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status + Payment charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Booking Status</h3>
            <div className="h-52">
              {bookings.length > 0
                ? <Pie data={statusPieData} options={pieOptions} />
                : <p className="text-gray-400 text-sm text-center pt-16">No data for this period.</p>
              }
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Payment Methods</h3>
            <div className="h-52">
              {bookings.length > 0
                ? <Pie data={paymentPieData} options={pieOptions} />
                : <p className="text-gray-400 text-sm text-center pt-16">No data for this period.</p>
              }
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
                {bookings.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">No bookings for this period.</td></tr>
                ) : bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{b.guest}</td>
                    <td className="px-6 py-3 text-slate-500">{b.room}</td>
                    <td className="px-6 py-3 text-slate-500">{b.payment}</td>
                    <td className="px-6 py-3">{b.nights}</td>
                    <td className="px-6 py-3 font-medium">{b.status === "Cancelled" ? <span className="line-through text-slate-400">{fmt(b.total)}</span> : fmt(b.total)}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${{
                        Confirmed: "bg-emerald-100 text-emerald-800",
                        Completed: "bg-blue-100 text-blue-800",
                        Pending:   "bg-yellow-100 text-yellow-800",
                        Cancelled: "bg-red-100 text-red-800",
                      }[b.status]}`}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {bookings.length > 0 && (
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
