import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  getAdminStats,
  getAnalyticsOverview,
  getAnalyticsBookings,
  getAnalyticsOccupancy,
} from "../../lib/adminApi.js";
import Toast, { useToast } from "../../components/ui/Toast";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

const STATUS_CLASSES = {
  emerald: "bg-emerald-100 text-emerald-800",
  blue:    "bg-blue-100 text-blue-800",
  yellow:  "bg-yellow-100 text-yellow-800",
  red:     "bg-red-100 text-red-800",
};

const STATUS_COLOR_MAP = {
  "Confirmed":  "emerald",
  "Checked In": "emerald",
  "Pending":    "yellow",
  "Completed":  "blue",
  "Cancelled":  "red",
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { ticks: { callback: (v) => `₱${(v / 1000).toFixed(0)}k` } } },
};

function OccupancyBar({ pct, color = "bg-[#1e3a8a]" }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function OwnerDashboard() {
  const [toast, showToast, clearToast, toastType] = useToast();

  const [overview,       setOverview]       = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [dailyData,      setDailyData]      = useState([]);
  const [occupancy,      setOccupancy]      = useState(null);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    Promise.all([
      getAnalyticsOverview(),
      getAdminStats(),
      getAnalyticsBookings(30),
      getAnalyticsOccupancy(),
    ])
      .then(([ovRes, statsRes, dailyRes, occRes]) => {
        setOverview(ovRes.data.data);
        setRecentBookings(statsRes.data.data.recent_bookings ?? []);
        setDailyData(dailyRes.data.data ?? []);
        setOccupancy(occRes.data.data);
      })
      .catch(() => showToast("Failed to load dashboard data.", "error"))
      .finally(() => setLoading(false));
  }, []);

  const revThisMonth = overview?.revenue_this_month ?? 0;
  const revLastMonth = overview?.revenue_last_month ?? 0;
  const revMoM = revLastMonth > 0
    ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100)
    : 0;

  const txThisMonth = overview?.bookings_this_month ?? 0;
  const txLastMonth = overview?.bookings_last_month ?? 0;
  const txMoM = txThisMonth - txLastMonth;

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dailyAvg = revThisMonth > 0 ? Math.round(revThisMonth / daysInMonth) : 0;

  const chartData = {
    labels: dailyData.map((d) => (d.date ?? "").slice(5)),
    datasets: [{
      label: "Revenue (₱)",
      data:  dailyData.map((d) => Number(d.revenue ?? 0)),
      borderColor:     "rgba(59, 130, 246, 0.8)",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      tension: 0.3,
      fill: true,
      pointRadius: 2,
    }],
  };

  return (
    <div className="p-6 space-y-6">

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Confirmed Bookings</p>
              <h3 className="text-2xl font-bold mt-1">
                {loading ? "—" : (overview?.confirmed_bookings ?? 0)}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {!loading && `${overview?.pending_bookings ?? 0} pending`}
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <i className="fas fa-calendar-check text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Monthly Revenue</p>
              <h3 className="text-2xl font-bold mt-1">
                {loading ? "—" : fmt(revThisMonth)}
              </h3>
              {!loading && (
                <p className={`text-xs mt-1 ${revMoM >= 0 ? "text-green-500" : "text-red-500"}`}>
                  <i className={`fas fa-arrow-${revMoM >= 0 ? "up" : "down"} mr-1`}></i>
                  {revMoM >= 0 ? "+" : ""}{revMoM}% from last month
                </p>
              )}
            </div>
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <i className="fas fa-chart-line text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Daily Revenue (Avg)</p>
              <h3 className="text-2xl font-bold mt-1">
                {loading ? "—" : fmt(dailyAvg)}
              </h3>
              <p className="text-xs text-gray-400 mt-1">{!loading && "avg this month"}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <i className="fas fa-money-bill-wave text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Monthly Transactions</p>
              <h3 className="text-2xl font-bold mt-1">
                {loading ? "—" : txThisMonth}
              </h3>
              {!loading && (
                <p className={`text-xs mt-1 ${txMoM >= 0 ? "text-green-500" : "text-red-500"}`}>
                  <i className={`fas fa-arrow-${txMoM >= 0 ? "up" : "down"} mr-1`}></i>
                  {txMoM >= 0 ? "+" : ""}{txMoM} from last month
                </p>
              )}
            </div>
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <i className="fas fa-receipt text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Occupancy Rate */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Occupancy Rate</h2>
          <span className="text-3xl font-bold text-[#1e3a8a]">
            {loading || !occupancy ? "—" : `${occupancy.pct}%`}
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : occupancy ? (
          <>
            <OccupancyBar pct={occupancy.pct} />
            <p className="text-xs text-gray-400 mt-1 mb-5">
              {occupancy.occupied} of {occupancy.total} rooms occupied right now
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {occupancy.rooms.map((r) => (
                <div key={r.type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 truncate">{r.type}</span>
                    <span className="font-semibold text-gray-800 ml-2">{r.pct}%</span>
                  </div>
                  <OccupancyBar
                    pct={r.pct}
                    color={r.pct === 100 ? "bg-emerald-500" : r.pct >= 75 ? "bg-blue-500" : r.pct >= 50 ? "bg-yellow-500" : "bg-red-400"}
                  />
                  <p className="text-xs text-gray-400 mt-1">{r.occupied}/{r.total} room</p>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Chart + Recent Bookings */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Revenue chart */}
        <div className="xl:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Revenue — Last 30 Days</h2>
          <div className="h-64">
            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : dailyData.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <p className="text-sm text-gray-400">No data available</p>
            )}
          </div>
        </div>

        {/* Recent bookings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Bookings</h2>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : recentBookings.length === 0 ? (
              <p className="text-sm text-gray-500">No recent bookings.</p>
            ) : (
              recentBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-start justify-between gap-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.guest}</p>
                    <p className="text-xs text-gray-500 truncate">{b.room}</p>
                    <p className="text-xs text-gray-400">{b.check_in} – {b.check_out}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[STATUS_COLOR_MAP[b.status] ?? "blue"]}`}>
                    {b.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
