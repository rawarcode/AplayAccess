import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import {
  getAdminBookings,
  getAnalyticsOverview,
  getAnalyticsBookings,
  getAnalyticsOccupancy,
} from "../../lib/adminApi.js";
import { updateBookingStatus } from "../../lib/frontdeskApi.js";
import Toast, { useToast } from "../../components/ui/Toast";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

function fmtTime(str) {
  if (!str) return "";
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return str;
  return d.toLocaleString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDate(str) {
  if (!str) return "";
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return str;
  return d.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

const STATUS_COLORS = {
  Pending:      "bg-amber-100 text-amber-800",
  Confirmed:    "bg-blue-100 text-blue-800",
  "Checked In": "bg-green-100 text-green-800",
  Completed:    "bg-gray-100 text-gray-700",
  Cancelled:    "bg-rose-100 text-rose-800",
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

// ── Component ────────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const [toast, showToast, clearToast, toastType] = useToast();
  const navigate = useNavigate();

  // Operations data
  const [bookings,   setBookings]   = useState([]);
  const [acting,     setActing]     = useState(null);

  // Analytics data
  const [overview,   setOverview]   = useState(null);
  const [dailyData,  setDailyData]  = useState([]);
  const [occupancy,  setOccupancy]  = useState(null);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    Promise.all([
      getAdminBookings(),
      getAnalyticsOverview(),
      getAnalyticsBookings(30),
      getAnalyticsOccupancy(),
    ])
      .then(([bkRes, ovRes, dailyRes, occRes]) => {
        const data = bkRes.data?.data ?? bkRes.data ?? bkRes;
        setBookings(Array.isArray(data) ? data : []);
        setOverview(ovRes.data.data);
        setDailyData(dailyRes.data.data ?? []);
        setOccupancy(occRes.data.data);
        setError(null);
      })
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  // ── Derived operations data ─────────────────────────────────────────────
  const today = todayStr();
  const pending = bookings.filter(b => b.status === "Pending");
  const todayCheckIns = bookings.filter(b => b.status === "Confirmed" && b.checkIn?.slice(0, 10) === today);
  const todayCheckOuts = bookings.filter(b => b.status === "Checked In" && b.checkOut?.slice(0, 10) === today);

  // ── Derived analytics data ──────────────────────────────────────────────
  const revThisMonth = overview?.revenue_this_month ?? 0;
  const revLastMonth = overview?.revenue_last_month ?? 0;
  const revMoM = revLastMonth > 0 ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100) : 0;
  const txThisMonth = overview?.bookings_this_month ?? 0;
  const txLastMonth = overview?.bookings_last_month ?? 0;
  const txMoM = txThisMonth - txLastMonth;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dailyAvg = revThisMonth > 0 ? Math.round(revThisMonth / daysInMonth) : 0;

  const chartData = {
    labels: dailyData.map(d => (d.date ?? "").slice(5)),
    datasets: [{
      label: "Revenue (₱)",
      data: dailyData.map(d => Number(d.revenue ?? 0)),
      borderColor: "rgba(59, 130, 246, 0.8)",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      tension: 0.3,
      fill: true,
      pointRadius: 2,
    }],
  };

  // ── Actions ─────────────────────────────────────────────────────────────
  async function handleAction(bookingId, status) {
    setActing(bookingId);
    try {
      await updateBookingStatus(bookingId, status);
      showToast(`Booking ${status.toLowerCase()} successfully.`, "success");
      load(true);
    } catch (err) {
      showToast(err.response?.data?.message || `Failed to ${status.toLowerCase()} booking.`, "error");
    } finally {
      setActing(null);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl shadow p-5 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gray-200"></div>
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-gray-200 rounded w-24"></div>
                <div className="h-7 bg-gray-200 rounded w-12"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl shadow p-5 animate-pulse">
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-20"></div>
              <div className="h-7 bg-gray-200 rounded w-24"></div>
              <div className="h-2 bg-gray-100 rounded w-32"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) return (
    <div className="p-6">
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-6 text-center">
        <i className="fas fa-exclamation-triangle text-3xl mb-3 block"></i>
        <p className="font-medium mb-3">{error}</p>
        <button onClick={() => load()} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 transition">
          <i className="fas fa-redo mr-2"></i>Retry
        </button>
      </div>
    </div>
  );

  // ── Action cards ────────────────────────────────────────────────────────
  const actionCards = [
    { label: "Pending Approval", count: pending.length, icon: "fa-clock", color: "bg-amber-50 text-amber-600 border-amber-200", iconBg: "bg-amber-100", empty: "All caught up!", target: "#pending" },
    { label: "Today's Check-ins", count: todayCheckIns.length, icon: "fa-arrow-right-to-bracket", color: "bg-green-50 text-green-600 border-green-200", iconBg: "bg-green-100", empty: "No arrivals today", target: "#checkins" },
    { label: "Today's Check-outs", count: todayCheckOuts.length, icon: "fa-arrow-right-from-bracket", color: "bg-blue-50 text-blue-600 border-blue-200", iconBg: "bg-blue-100", empty: "No departures today", target: "#checkouts" },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* ════════════════════════════════════════════════════════════════════
          OPERATIONS — Command Center
          ════════════════════════════════════════════════════════════════════ */}

      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50 p-2"
          title="Refresh"
        >
          <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
        </button>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actionCards.map(c => (
          <a key={c.label} href={c.target} className={`rounded-xl border p-5 flex items-center gap-4 transition hover:shadow-md ${c.color}`}>
            <div className={`h-12 w-12 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0`}>
              <i className={`fas ${c.icon} text-lg`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{c.label}</p>
              {c.count > 0
                ? <p className="text-2xl font-bold">{c.count}</p>
                : <p className="text-sm font-medium opacity-60">{c.empty}</p>}
            </div>
          </a>
        ))}
      </div>

      {/* Pending Approval Queue */}
      {pending.length > 0 && (
        <section id="pending" className="bg-white rounded-xl shadow">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">
              <i className="fas fa-clock text-amber-500 mr-2"></i>Pending Approval
              <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
            </h2>
            <button onClick={() => navigate("/owner/transactions")} className="text-xs text-blue-600 hover:underline font-medium">
              View All <i className="fas fa-arrow-right ml-0.5 text-[10px]"></i>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">Guest</th>
                  <th className="px-6 py-3 text-left">Room</th>
                  <th className="px-6 py-3 text-left">Check-in</th>
                  <th className="px-6 py-3 text-left">Total</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.slice(0, 5).map(b => (
                  <tr key={b.id || b.bookingId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-medium">{b.guest}</p>
                      <p className="text-xs text-gray-400">{b.id}</p>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{b.room}</td>
                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{fmtDate(b.checkIn)}</td>
                    <td className="px-6 py-3 font-medium">₱{Number(b.total || 0).toLocaleString()}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(b.bookingId || b.id, "Confirmed")}
                          disabled={acting === (b.bookingId || b.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {acting === (b.bookingId || b.id) ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-check mr-1"></i>Confirm</>}
                        </button>
                        <button
                          onClick={() => handleAction(b.bookingId || b.id, "Cancelled")}
                          disabled={acting === (b.bookingId || b.id)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition"
                        >
                          <i className="fas fa-ban mr-1"></i>Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Today's Schedule — Check-ins & Check-outs */}
      {(todayCheckIns.length > 0 || todayCheckOuts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Arriving */}
          <section id="checkins" className="bg-white rounded-xl shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-800">
                <i className="fas fa-arrow-right-to-bracket text-green-500 mr-2"></i>Arriving Today
                {todayCheckIns.length > 0 && <span className="ml-2 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">{todayCheckIns.length}</span>}
              </h2>
            </div>
            {todayCheckIns.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <i className="fas fa-couch text-gray-200 text-3xl mb-2 block"></i>
                <p className="text-gray-400 text-sm">No arrivals today</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {todayCheckIns.map(b => (
                  <div key={b.id || b.bookingId} className="px-6 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.guest}</p>
                      <p className="text-xs text-gray-500">{b.room} · {fmtTime(b.checkIn)}</p>
                    </div>
                    <button
                      onClick={() => handleAction(b.bookingId || b.id, "Checked In")}
                      disabled={acting === (b.bookingId || b.id)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition shrink-0"
                    >
                      {acting === (b.bookingId || b.id) ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-door-open mr-1"></i>Check In</>}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Departing */}
          <section id="checkouts" className="bg-white rounded-xl shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-800">
                <i className="fas fa-arrow-right-from-bracket text-blue-500 mr-2"></i>Departing Today
                {todayCheckOuts.length > 0 && <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{todayCheckOuts.length}</span>}
              </h2>
            </div>
            {todayCheckOuts.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <i className="fas fa-door-closed text-gray-200 text-3xl mb-2 block"></i>
                <p className="text-gray-400 text-sm">No departures today</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {todayCheckOuts.map(b => (
                  <div key={b.id || b.bookingId} className="px-6 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.guest}</p>
                      <p className="text-xs text-gray-500">{b.room} · out by {fmtTime(b.checkOut)}</p>
                    </div>
                    <button
                      onClick={() => handleAction(b.bookingId || b.id, "Completed")}
                      disabled={acting === (b.bookingId || b.id)}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition shrink-0"
                    >
                      {acting === (b.bookingId || b.id) ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-flag-checkered mr-1"></i>Check Out</>}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ANALYTICS — KPI + Charts
          ════════════════════════════════════════════════════════════════════ */}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Confirmed Bookings</p>
              <h3 className="text-2xl font-bold mt-1">{overview?.confirmed_bookings ?? 0}</h3>
              <p className="text-xs text-gray-400 mt-1">{overview?.pending_bookings ?? 0} pending</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100 text-blue-600"><i className="fas fa-calendar-check text-xl"></i></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Monthly Revenue</p>
              <h3 className="text-2xl font-bold mt-1">{fmt(revThisMonth)}</h3>
              <p className={`text-xs mt-1 ${revMoM >= 0 ? "text-green-500" : "text-red-500"}`}>
                <i className={`fas fa-arrow-${revMoM >= 0 ? "up" : "down"} mr-1`}></i>
                {revMoM >= 0 ? "+" : ""}{revMoM}% from last month
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-100 text-green-600"><i className="fas fa-chart-line text-xl"></i></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Daily Revenue (Avg)</p>
              <h3 className="text-2xl font-bold mt-1">{fmt(dailyAvg)}</h3>
              <p className="text-xs text-gray-400 mt-1">avg this month</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600"><i className="fas fa-money-bill-wave text-xl"></i></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Monthly Transactions</p>
              <h3 className="text-2xl font-bold mt-1">{txThisMonth}</h3>
              <p className={`text-xs mt-1 ${txMoM >= 0 ? "text-green-500" : "text-red-500"}`}>
                <i className={`fas fa-arrow-${txMoM >= 0 ? "up" : "down"} mr-1`}></i>
                {txMoM >= 0 ? "+" : ""}{txMoM} from last month
              </p>
            </div>
            <div className="p-3 rounded-full bg-purple-100 text-purple-600"><i className="fas fa-receipt text-xl"></i></div>
          </div>
        </div>
      </div>

      {/* Occupancy Rate */}
      {occupancy && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Occupancy Rate</h2>
            <span className="text-3xl font-bold text-[#1e3a8a]">{occupancy.pct}%</span>
          </div>
          <OccupancyBar pct={occupancy.pct} />
          <p className="text-xs text-gray-400 mt-1 mb-5">
            {occupancy.occupied} of {occupancy.total} rooms occupied right now
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {occupancy.rooms.map(r => (
              <div key={r.type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 truncate">{r.type}</span>
                  <span className="font-semibold text-gray-800 ml-2">{r.pct}%</span>
                </div>
                <OccupancyBar
                  pct={r.pct}
                  color={r.pct === 100 ? "bg-emerald-500" : r.pct >= 75 ? "bg-blue-500" : r.pct >= 50 ? "bg-yellow-500" : "bg-red-400"}
                />
                <p className="text-xs text-gray-400 mt-1">{r.occupied}/{r.total} rooms</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Revenue — Last 30 Days</h2>
        <div className="h-64">
          {dailyData.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">No revenue data available</p>
            </div>
          )}
        </div>
      </div>

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
