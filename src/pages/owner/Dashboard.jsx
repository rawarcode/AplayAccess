import { useEffect, useState, useCallback, useMemo } from "react";
import { Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { getAdminBookings } from "../../lib/adminApi.js";
import { api } from "../../lib/api";
import { localDateStr } from "../../lib/format";
import Toast, { useToast } from "../../components/ui/Toast";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

// Entrance fee fallback — live values come from /api/pricing on mount.
// '24hr-pm' is kept for legacy bookings created before the flexible 24hr
// start-hour; new bookings only use '24hr'. Priced the same as '24hr'.
const FALLBACK_RATES = { day: 50, night: 80, '24hr': 100, '24hr-pm': 100 };
function calcEntrance(b, entranceRates = FALLBACK_RATES) {
  if (b.entranceFee != null && Number(b.entranceFee) > 0) return Number(b.entranceFee);
  const rate = entranceRates[b.bookingType ?? 'day'] ?? 50;
  return (b.guests ?? 1) * rate;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { ticks: { callback: (v) => `₱${(v / 1000).toFixed(0)}k` } } },
};

// ── Component ────────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const [toast, showToast, clearToast, toastType] = useToast();
  const [bookings,   setBookings]   = useState([]);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  // Live entrance-fee rates from /api/pricing. Falls back to FALLBACK_RATES
  // until the fetch resolves so cards still render during the first paint.
  const [entranceRates, setEntranceRates] = useState(FALLBACK_RATES);
  useEffect(() => {
    api.get('/api/pricing')
      .then(r => {
        const d = r.data?.data;
        if (d) setEntranceRates({
          day:       Number(d.entrance_fee_day   ?? 50),
          night:     Number(d.entrance_fee_night ?? 80),
          '24hr':    Number(d.entrance_fee_24hr  ?? 100),
          '24hr-pm': Number(d.entrance_fee_24hr  ?? 100),
        });
      })
      .catch(() => {});
  }, []);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    getAdminBookings()
      .then(bkRes => {
        const data = bkRes.data?.data ?? bkRes.data ?? bkRes;
        setBookings(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), 20_000);
    return () => clearInterval(id);
  }, [load]);

  // ── Derived analytics — all computed from bookings array for consistency ──
  // Helper: money actually collected for a booking. paidAmount is the backend's
  // single source of truth (maintained by payment webhook, collectPayment,
  // walk-in creation, and guest-count updates), so every revenue figure on
  // this dashboard falls out of it.
  const bookingRevenue = (b) => Number(b.paidAmount ?? 0);
  // Source is emitted by the backend ('online' | 'walk-in') — use it directly
  // instead of reverse-engineering from special_requests or reservation_fee,
  // which misclassifies zero-fee online bookings and imported rows.
  const isWalkIn = (b) => b.source === 'walk-in';

  const derivedKpis = useMemo(() => {
    const now = new Date();
    const monthStart     = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const nextMonthStart = localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    const lastMonthStart = localDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const lastMonthEnd   = localDateStr(new Date(now.getFullYear(), now.getMonth(), 0));
    const today          = localDateStr(now);
    const days30ago      = localDateStr(new Date(now.getTime() - 30 * 86400000));

    // Active = not Cancelled/Pending
    const activeBookings = bookings.filter(b => !['Cancelled', 'Pending'].includes(b.status));

    // This month bookings (by check-in date). Upper bound matters — without
    // it, a booking whose check-in is in a future month (e.g. June visits
    // booked in April) gets counted as "this month" and inflates the KPI.
    const thisMonthAll    = bookings.filter(b => {
      const d = b.checkIn?.slice(0, 10) ?? '';
      return d >= monthStart && d < nextMonthStart;
    });
    const thisMonthActive = thisMonthAll.filter(b => !['Cancelled', 'Pending'].includes(b.status));
    const lastMonthAll    = bookings.filter(b => { const d = b.checkIn?.slice(0, 10) ?? ''; return d >= lastMonthStart && d <= lastMonthEnd; });
    const lastMonthActive = lastMonthAll.filter(b => !['Cancelled', 'Pending'].includes(b.status));

    const revThisMonth = thisMonthActive.reduce((s, b) => s + bookingRevenue(b), 0);
    const revLastMonth = lastMonthActive.reduce((s, b) => s + bookingRevenue(b), 0);
    const revMoM = revLastMonth > 0 ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100) : 0;
    const txThisMonth = thisMonthAll.length;
    const txLastMonth = lastMonthAll.length;
    const txMoM = txThisMonth - txLastMonth;

    const avgBookingValue = thisMonthActive.length > 0
      ? Math.round(thisMonthActive.reduce((s, b) => s + bookingRevenue(b), 0) / thisMonthActive.length)
      : 0;

    const cancelledThisMonth = thisMonthAll.filter(b => b.status === 'Cancelled').length;
    const cancelRate = txThisMonth > 0 ? Math.round((cancelledThisMonth / txThisMonth) * 100) : 0;

    const totalGuests = activeBookings.reduce((s, b) => s + Number(b.guests ?? 0), 0);

    const walkinBookings  = bookings.filter(b => isWalkIn(b)).length;
    const onlineBookings  = bookings.length - walkinBookings;
    const onlinePct       = bookings.length > 0 ? Math.round((onlineBookings / bookings.length) * 100) : 0;

    // Peak day of week (from last 30 days bookings)
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Only past-through-today bookings count toward "peak day" — upcoming
    // reservations would skew this into a forecast, not a historical trend.
    bookings.forEach(b => {
      const d = b.checkIn?.slice(0, 10) ?? '';
      if (d < days30ago || d > today) return;
      const dayIdx = new Date(d + 'T00:00:00').getDay();
      dayOfWeekCounts[dayIdx] += 1;
    });
    const peakDayIdx = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
    const peakDay    = dayLabels[peakDayIdx];

    return {
      activeBookings, revThisMonth, revMoM, txThisMonth, txMoM,
      avgBookingValue, cancelledThisMonth, cancelRate, totalGuests,
      walkinBookings, onlineBookings, onlinePct, peakDay, peakDayIdx,
      dayOfWeekCounts, days30ago, today,
    };
  }, [bookings, entranceRates]);

  const {
    activeBookings, revThisMonth, revMoM, txThisMonth, txMoM,
    avgBookingValue, cancelledThisMonth, cancelRate, totalGuests,
    walkinBookings, onlineBookings, onlinePct, peakDay, peakDayIdx,
    dayOfWeekCounts, days30ago, today,
  } = derivedKpis;

  // Revenue breakdown — decomposes COLLECTED revenue into room/entrance/addons.
  // Only bookings whose grand total is fully paid contribute; partially-paid
  // bookings are excluded so the segments sum to paidAmount of those rows
  // (matching the Revenue Collected KPI, not gross booking value).
  const revBreakdown = useMemo(() => {
    let room = 0, entrance = 0, addons = 0, promos = 0;
    activeBookings.forEach(b => {
      const grand = Number(b.total ?? 0) + Number(b.entranceFee ?? 0);
      const paid  = Number(b.paidAmount ?? 0);
      if (paid <= 0 || paid + 0.01 < grand) return; // skip unpaid + partial
      const amenityTotal = Array.isArray(b.amenities)
        ? b.amenities.reduce((s, a) => s + Number(a.total ?? (Number(a.unitPrice ?? 0) * Number(a.qty ?? 0))), 0)
        : 0;
      const disc = Number(b.discount ?? 0);
      const tot  = Number(b.total ?? 0);
      room     += tot + disc - amenityTotal;
      entrance += Number(b.entranceFee ?? 0);
      addons   += amenityTotal;
      promos   += disc;
    });
    return { room: Math.max(room, 0), entrance, addons, promos };
  }, [activeBookings]);

  const revGrand = revBreakdown.room + revBreakdown.entrance + revBreakdown.addons;
  const revSlices = useMemo(() => [
    { label: 'Room Rates',    value: revBreakdown.room,     color: '#3b82f6', icon: 'fa-bed' },
    { label: 'Entrance Fees', value: revBreakdown.entrance, color: '#10b981', icon: 'fa-ticket' },
    { label: 'Add-ons',       value: revBreakdown.addons,   color: '#f59e0b', icon: 'fa-concierge-bell' },
  ].filter(s => s.value > 0), [revBreakdown]);

  const doughnutData = useMemo(() => ({
    labels: revSlices.map(s => s.label),
    datasets: [{
      data: revSlices.map(s => s.value),
      backgroundColor: revSlices.map(s => s.color),
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 6,
    }],
  }), [revSlices]);

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)}` } },
    },
  };

  // Top performing rooms (computed from active bookings, last 30 days).
  // Upper bound at today so upcoming reservations don't appear in a
  // historical "top performer" ranking.
  const topRooms = useMemo(() => {
    const map = {};
    activeBookings.forEach(b => {
      const d = b.checkIn?.slice(0, 10) ?? '';
      if (d < days30ago || d > today) return;
      const key = b.roomType ?? 'Unknown';
      if (!map[key]) map[key] = { label: key, bookings: 0, revenue: 0 };
      map[key].bookings += 1;
      map[key].revenue  += bookingRevenue(b);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [activeBookings, days30ago, today, entranceRates]);

  // Daily revenue chart (computed from bookings, last 30 days)
  const chartData = useMemo(() => {
    const now = new Date();
    const dayMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = localDateStr(new Date(now.getTime() - i * 86400000));
      dayMap[d] = 0;
    }
    activeBookings.forEach(b => {
      const d = b.checkIn?.slice(0, 10) ?? '';
      if (d in dayMap) dayMap[d] += bookingRevenue(b);
    });
    const entries = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0]));
    return {
      labels: entries.map(([d]) => d.slice(5)),
      datasets: [{
        label: "Revenue (₱)",
        data: entries.map(([, v]) => v),
        borderColor: "rgba(59, 130, 246, 0.8)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.3,
        fill: true,
        pointRadius: 2,
      }],
    };
  }, [activeBookings, entranceRates]);

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl shadow p-5 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-slate-200"></div>
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-slate-200 rounded w-24"></div>
                <div className="h-7 bg-slate-200 rounded w-12"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl shadow p-5 animate-pulse">
            <div className="space-y-2">
              <div className="h-3 bg-slate-200 rounded w-20"></div>
              <div className="h-7 bg-slate-200 rounded w-24"></div>
              <div className="h-2 bg-slate-100 rounded w-32"></div>
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

  return (
    <div className="p-6 space-y-6">

      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-slate-400 hover:text-slate-600 transition disabled:opacity-50 p-2"
          title="Refresh"
        >
          <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
        </button>
      </div>

      {/* KPI Cards — Row 1: Revenue & Bookings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Monthly Revenue</p>
              <h3 className="text-2xl font-bold mt-1">{fmt(revThisMonth)}</h3>
              <p className={`text-xs mt-1 ${revMoM >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                <i className={`fas fa-arrow-${revMoM >= 0 ? "up" : "down"} mr-1`}></i>
                {revMoM >= 0 ? "+" : ""}{revMoM}% from last month
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600"><i className="fas fa-chart-line text-xl"></i></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Monthly Bookings</p>
              <h3 className="text-2xl font-bold mt-1">{txThisMonth}</h3>
              <p className={`text-xs mt-1 ${txMoM >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                <i className={`fas fa-arrow-${txMoM >= 0 ? "up" : "down"} mr-1`}></i>
                {txMoM >= 0 ? "+" : ""}{txMoM} from last month
              </p>
            </div>
            <div className="p-3 rounded-xl bg-sky-100 text-sky-600"><i className="fas fa-calendar-check text-xl"></i></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Avg Booking Value</p>
              <h3 className="text-2xl font-bold mt-1">{fmt(avgBookingValue)}</h3>
              <p className="text-xs text-slate-400 mt-1">per completed booking</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-100 text-violet-600"><i className="fas fa-peso-sign text-xl"></i></div>
          </div>
        </div>
      </div>

      {/* KPI Cards — Row 2: Operations & Growth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Cancellation Rate</p>
              <h3 className="text-2xl font-bold mt-1">{cancelRate}%</h3>
              <p className="text-xs text-slate-400 mt-1">{cancelledThisMonth} cancelled this month</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-100 text-rose-600"><i className="fas fa-ban text-xl"></i></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Online vs Walk-in</p>
              <h3 className="text-2xl font-bold mt-1">{onlinePct}% online</h3>
              <p className="text-xs text-slate-400 mt-1">{onlineBookings} online · {walkinBookings} walk-in</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600"><i className="fas fa-globe text-xl"></i></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Registered Guests</p>
              <h3 className="text-2xl font-bold mt-1">{totalGuests}</h3>
              <p className="text-xs text-slate-400 mt-1">total accounts</p>
            </div>
            <div className="p-3 rounded-xl bg-teal-100 text-teal-600"><i className="fas fa-users text-xl"></i></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Peak Day</p>
              <h3 className="text-2xl font-bold mt-1">{peakDay}</h3>
              <p className="text-xs text-slate-400 mt-1">{dayOfWeekCounts[peakDayIdx]} bookings (30d)</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100 text-amber-600"><i className="fas fa-fire text-xl"></i></div>
          </div>
        </div>
      </div>


      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Revenue — Last 30 Days</h2>
        <div className="h-64">
          {chartData.datasets[0].data.some(v => v > 0) ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-400">No revenue data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Revenue Breakdown */}
      {revGrand > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            <i className="fas fa-chart-pie text-sky-500 mr-2"></i>Revenue Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Donut */}
            <div className="relative mx-auto w-52 h-52">
              <Doughnut data={doughnutData} options={doughnutOpts} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-400">Total</span>
                <span className="text-lg font-bold text-slate-800">{fmt(revGrand)}</span>
              </div>
            </div>
            {/* Line items */}
            <div className="space-y-3">
              {revSlices.map(s => {
                const pct = revGrand > 0 ? ((s.value / revGrand) * 100).toFixed(1) : 0;
                return (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: s.color + '1a' }}>
                      <i className={`fas ${s.icon}`} style={{ color: s.color }}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{s.label}</span>
                        <span className="font-semibold text-slate-800">{fmt(s.value)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 w-12 text-right">{pct}%</span>
                  </div>
                );
              })}
              {revBreakdown.promos > 0 && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-rose-50">
                    <i className="fas fa-tag text-rose-500"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Promo Discounts</span>
                      <span className="font-semibold text-rose-600">−{fmt(revBreakdown.promos)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Performing Rooms */}
      {topRooms.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            <i className="fas fa-trophy text-amber-500 mr-2"></i>Top Rooms — Last 30 Days
          </h2>
          <div className="space-y-3">
            {topRooms.map((r, i) => {
              const maxRev = topRooms[0]?.revenue ?? 1;
              const pct = maxRev > 0 ? Math.round((r.revenue / maxRev) * 100) : 0;
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="text-lg w-8 text-center">{medals[i] ?? `#${i + 1}`}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700 truncate">{r.label}</span>
                      <span className="text-slate-500 shrink-0 ml-2">{r.bookings} bookings · {fmt(r.revenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-sky-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
