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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

// Seeded LCG — same output every render
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}

function genRevenueData() {
  const rng = makeRng(42);
  const labels = [];
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(2026, 2, 28 - i);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    data.push(Math.round(3000 + rng() * 9000));
  }
  return { labels, data };
}

const revenueSparkline = genRevenueData();

const SAMPLE_STATS = {
  confirmedBookings: { value: 24, change: "3 pending", trend: "up" },
  monthlyRevenue:    { value: fmt(186500), change: "+12% from last month", trend: "up" },
  dailyRevenue:      { value: fmt(6217),   change: "avg over 30 days", trend: "up" },
  monthlyTxns:       { value: 31,          change: "+5 from last month", trend: "up" },
};

const SAMPLE_BOOKINGS = [
  { id: 1, guest: "Maria Santos",   room: "Beachfront Suite", checkIn: "2026-03-28", status: "Arriving today",    statusColor: "emerald" },
  { id: 2, guest: "John dela Cruz", room: "Standard Room",    checkIn: "2026-03-29", status: "Arriving tomorrow", statusColor: "blue"    },
  { id: 3, guest: "Ana Reyes",      room: "Family Cottage",   checkIn: "2026-03-30", status: "Confirmed",         statusColor: "emerald" },
  { id: 4, guest: "Carlo Lim",      room: "Deluxe Room",      checkIn: "2026-04-01", status: "Confirmed",         statusColor: "emerald" },
  { id: 5, guest: "Rosa Mendoza",   room: "Beachfront Suite", checkIn: "2026-04-03", status: "Pending",           statusColor: "yellow"  },
];

const OCCUPANCY = {
  overall: 76,
  rooms: [
    { type: "Beachfront Suite", total: 4,  occupied: 4,  pct: 100 },
    { type: "Deluxe Room",      total: 6,  occupied: 5,  pct: 83  },
    { type: "Family Cottage",   total: 4,  occupied: 3,  pct: 75  },
    { type: "Standard Room",    total: 10, occupied: 6,  pct: 60  },
  ],
};

const chartData = {
  labels: revenueSparkline.labels,
  datasets: [{
    label: "Revenue (₱)",
    data: revenueSparkline.data,
    borderColor: "rgba(59, 130, 246, 0.8)",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    tension: 0.3,
    fill: true,
    pointRadius: 2,
  }],
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { ticks: { callback: (v) => `₱${(v / 1000).toFixed(0)}k` } } },
};

const STATUS_CLASSES = {
  emerald: "bg-emerald-100 text-emerald-800",
  blue:    "bg-blue-100 text-blue-800",
  yellow:  "bg-yellow-100 text-yellow-800",
  red:     "bg-red-100 text-red-800",
};

function OccupancyBar({ pct, color = "bg-[#1e3a8a]" }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function OwnerDashboard() {
  return (
    <div className="p-6 space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Confirmed Bookings</p>
              <h3 className="text-2xl font-bold mt-1">{SAMPLE_STATS.confirmedBookings.value}</h3>
              <p className="text-xs text-gray-400 mt-1">{SAMPLE_STATS.confirmedBookings.change}</p>
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
              <h3 className="text-2xl font-bold mt-1">{SAMPLE_STATS.monthlyRevenue.value}</h3>
              <p className="text-xs text-green-500 mt-1">
                <i className="fas fa-arrow-up mr-1"></i>{SAMPLE_STATS.monthlyRevenue.change}
              </p>
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
              <h3 className="text-2xl font-bold mt-1">{SAMPLE_STATS.dailyRevenue.value}</h3>
              <p className="text-xs text-gray-400 mt-1">{SAMPLE_STATS.dailyRevenue.change}</p>
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
              <h3 className="text-2xl font-bold mt-1">{SAMPLE_STATS.monthlyTxns.value}</h3>
              <p className="text-xs text-green-500 mt-1">
                <i className="fas fa-arrow-up mr-1"></i>{SAMPLE_STATS.monthlyTxns.change}
              </p>
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
          <span className="text-3xl font-bold text-[#1e3a8a]">{OCCUPANCY.overall}%</span>
        </div>
        <OccupancyBar pct={OCCUPANCY.overall} />
        <p className="text-xs text-gray-400 mt-1 mb-5">
          {OCCUPANCY.rooms.reduce((s, r) => s + r.occupied, 0)} of{" "}
          {OCCUPANCY.rooms.reduce((s, r) => s + r.total, 0)} rooms occupied this month
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OCCUPANCY.rooms.map((r) => (
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

      {/* Chart + Recent Bookings */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Revenue chart */}
        <div className="xl:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Revenue — Last 30 Days</h2>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Recent bookings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Bookings</h2>
          <div className="space-y-3">
            {SAMPLE_BOOKINGS.map((b) => (
              <div key={b.id} className="flex items-start justify-between gap-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{b.guest}</p>
                  <p className="text-xs text-gray-500 truncate">{b.room}</p>
                  <p className="text-xs text-gray-400">{b.checkIn}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[b.statusColor]}`}>
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
