import { useState } from "react";
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

// Seeded LCG
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}

function genDailyData(days, seed) {
  const rng = makeRng(seed);
  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(2026, 2, 28 - i);
    const bookings = Math.floor(rng() * 4);
    const revenue  = bookings * Math.round(4000 + rng() * 6000);
    rows.push({
      date:     `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      bookings,
      revenue,
    });
  }
  return rows;
}

// Pre-generate stable data for each period (this year + last year)
const DATA = {
  7:   { current: genDailyData(7,   42),  prev: genDailyData(7,   99)  },
  30:  { current: genDailyData(30,  42),  prev: genDailyData(30,  99)  },
  90:  { current: genDailyData(90,  42),  prev: genDailyData(90,  99)  },
  365: { current: genDailyData(365, 42),  prev: genDailyData(365, 99)  },
};

const OVERVIEW = {
  revenue_this_month: 186500,
  revenue_last_month: 166200,
  bookings_this_month: 31,
  bookings_last_month: 26,
  confirmed_bookings: 24,
  pending_bookings: 3,
  total_guests: 89,
  total_bookings: 142,
};

const ROOM_TYPE_DATA = {
  labels: ["Beachfront Suite", "Deluxe Room", "Family Cottage", "Standard Room"],
  revenue:   [72000, 54000, 39200, 27000],
  bookings:  [6, 9, 4, 12],
};

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

const revenuePct  = Math.round(((OVERVIEW.revenue_this_month - OVERVIEW.revenue_last_month) / OVERVIEW.revenue_last_month) * 100);
const bookingsDiff = OVERVIEW.bookings_this_month - OVERVIEW.bookings_last_month;

function exportCSV(rows) {
  const headers = ["Date", "Bookings", "Revenue (PHP)"];
  const lines = [
    headers.join(","),
    ...rows.map((r) => [r.date, r.bookings, r.revenue].join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "financials_daily_breakdown.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function OwnerFinancials() {
  const [chartDays, setChartDays] = useState(30);
  const [showYoY,   setShowYoY]   = useState(false);

  const { current: chartData, prev: prevData } = DATA[chartDays];

  const shortLabel = (date) => date.slice(5); // MM-DD

  const revenueLineData = {
    labels: chartData.map((d) => shortLabel(d.date)),
    datasets: [
      {
        label: "This Period",
        data: chartData.map((d) => d.revenue),
        borderColor: "rgba(59, 130, 246, 0.8)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.3,
        fill: true,
      },
      ...(showYoY ? [{
        label: "Last Year",
        data: prevData.map((d) => d.revenue),
        borderColor: "rgba(156, 163, 175, 0.8)",
        backgroundColor: "rgba(156, 163, 175, 0.05)",
        tension: 0.3,
        fill: false,
        borderDash: [4, 4],
      }] : []),
    ],
  };

  const bookingsLineData = {
    labels: chartData.map((d) => shortLabel(d.date)),
    datasets: [
      {
        label: "This Period",
        data: chartData.map((d) => d.bookings),
        borderColor: "rgba(16, 185, 129, 0.8)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        tension: 0.3,
        fill: true,
      },
      ...(showYoY ? [{
        label: "Last Year",
        data: prevData.map((d) => d.bookings),
        borderColor: "rgba(156, 163, 175, 0.8)",
        backgroundColor: "rgba(156, 163, 175, 0.05)",
        tension: 0.3,
        fill: false,
        borderDash: [4, 4],
      }] : []),
    ],
  };

  const roomBarData = {
    labels: ROOM_TYPE_DATA.labels,
    datasets: [{
      label: "Revenue (₱)",
      data: ROOM_TYPE_DATA.revenue,
      backgroundColor: [
        "rgba(59, 130, 246, 0.7)",
        "rgba(16, 185, 129, 0.7)",
        "rgba(251, 191, 36, 0.7)",
        "rgba(139, 92, 246, 0.7)",
      ],
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
            <div className="flex justify-between"><span className="text-gray-600">This Month</span><span className="font-medium">{fmt(OVERVIEW.revenue_this_month)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Last Month</span><span className="font-medium">{fmt(OVERVIEW.revenue_last_month)}</span></div>
            <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
              <span className="font-medium text-gray-700">Change</span>
              <span className={`font-bold ${revenuePct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {revenuePct >= 0 ? "+" : ""}{revenuePct}%
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
            <div className="flex justify-between"><span className="text-gray-600">This Month</span><span className="font-medium">{OVERVIEW.bookings_this_month}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Last Month</span><span className="font-medium">{OVERVIEW.bookings_last_month}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Confirmed</span><span className="font-medium">{OVERVIEW.confirmed_bookings}</span></div>
            <div className="flex justify-between border-t border-green-200 pt-2 mt-2">
              <span className="font-medium text-gray-700">Change</span>
              <span className={`font-bold ${bookingsDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                {bookingsDiff >= 0 ? "+" : ""}{bookingsDiff}
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
            <div className="flex justify-between"><span className="text-gray-600">Total Guests</span><span className="font-medium">{OVERVIEW.total_guests}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Pending Bookings</span><span className="font-medium">{OVERVIEW.pending_bookings}</span></div>
            <div className="flex justify-between border-t border-purple-200 pt-2 mt-2">
              <span className="font-medium text-gray-700">Total Bookings</span>
              <span className="font-bold text-purple-700">{OVERVIEW.total_bookings}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showYoY}
            onChange={(e) => setShowYoY(e.target.checked)}
            className="rounded"
          />
          Compare with last year
        </label>
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
            <Line data={revenueLineData} options={lineOptions} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Bookings</h2>
          <div className="h-64">
            <Line data={bookingsLineData} options={lineOptions} />
          </div>
        </div>
      </div>

      {/* Revenue by Room Type */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Revenue by Room Type</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="h-56">
            <Bar data={roomBarData} options={barOptions} />
          </div>
          <div className="divide-y divide-slate-100">
            {ROOM_TYPE_DATA.labels.map((label, i) => (
              <div key={label} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{
                    background: ["#3b82f6","#10b981","#fbbf24","#8b5cf6"][i]
                  }} />
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{fmt(ROOM_TYPE_DATA.revenue[i])}</p>
                  <p className="text-xs text-gray-400">{ROOM_TYPE_DATA.bookings[i]} bookings</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Daily Breakdown</h3>
          <button
            onClick={() => exportCSV([...chartData].reverse())}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#1e3a8a] border border-[#1e3a8a] rounded-lg hover:bg-blue-50 transition"
          >
            <i className="fas fa-download text-xs"></i>
            Export CSV
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
              {[...chartData].reverse().map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-500">{row.date}</td>
                  <td className="px-6 py-3">{row.bookings}</td>
                  <td className="px-6 py-3 font-medium text-slate-900">{fmt(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 text-sm font-semibold">
              <tr>
                <td className="px-6 py-3 text-slate-700">Total</td>
                <td className="px-6 py-3 text-slate-900">{chartData.reduce((s, r) => s + r.bookings, 0)}</td>
                <td className="px-6 py-3 text-slate-900">{fmt(chartData.reduce((s, r) => s + r.revenue, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}
