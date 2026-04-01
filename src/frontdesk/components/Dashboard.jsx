import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import Sidebar from './Layout/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { getFdBookings } from '../../lib/frontdeskApi';
import NotificationBell from '../../components/ui/NotificationBell';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ─── helpers ─────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtTime(dt) {
  if (!dt) return '—';
  return new Date(dt.replace(' ', 'T')).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function buildWeekChart(bookings) {
  const labels = [], counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }));
    counts.push(bookings.filter(b => b.checkIn?.slice(0, 10) === key).length);
  }
  return { labels, counts };
}

// ─── component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user: session, logout } = useAuth();

  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  const [profileOpen, setProfileOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const profileRef = useRef(null);

  const userName  = session?.name  || 'Front Desk';
  const userEmail = session?.email || '';
  const initials  = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // ── load bookings ───────────────────────────────────────────────────────────
  useEffect(() => {
    getFdBookings()
      .then(data => { setBookings(data); setError(''); })
      .catch(() => setError('Failed to load bookings.'))
      .finally(() => setLoading(false));
  }, []);

  // ── click-outside ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── derived metrics ─────────────────────────────────────────────────────────
  const today          = todayStr();
  const todayBookings  = bookings.filter(b => b.checkIn?.slice(0, 10) === today);
  const arriving       = todayBookings.filter(b => b.status === 'Confirmed');
  const completed      = todayBookings.filter(b => b.status === 'Completed');
  const allPending     = bookings.filter(b => b.status === 'Pending');

  const { labels, counts } = buildWeekChart(bookings);
  const chartData = {
    labels,
    datasets: [{ label: 'Bookings', data: counts, backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 }],
  };

  // ── handlers ────────────────────────────────────────────────────────────────
  const handleLogout = async () => { await logout(); navigate('/staff-login'); };

  // ─── render ──────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      {/* ── Account Settings Modal ── */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Account Settings</h3>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <div className="h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold mb-2">
                {initials}
              </div>
              <p className="font-bold text-lg">{userName}</p>
              <p className="text-sm text-gray-500">{userEmail}</p>
              <p className="text-xs text-gray-400 mt-1 capitalize">{session?.role?.replace('_', ' ') || 'Staff'}</p>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              To change your name, email, or password, contact your system administrator.
            </p>
            <div className="flex justify-end">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 border rounded text-sm text-gray-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <div className="flex items-center space-x-4">

            {/* Notifications */}
            <NotificationBell />

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
                <span className="hidden md:inline text-sm">{userName}</span>
                <i className="fas fa-chevron-down text-xs text-gray-400"></i>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-lg border z-50">
                  <div className="p-3 flex items-center border-b">
                    <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold mr-3">
                      {initials}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{userName}</p>
                      <p className="text-xs text-gray-500 capitalize">{session?.role?.replace('_', ' ') || 'Staff'}</p>
                    </div>
                  </div>
                  <button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}
                    className="w-full text-left p-3 flex items-center hover:bg-gray-50 border-b">
                    <i className="fas fa-user-cog mr-3 text-gray-500"></i>
                    <span className="text-sm">Account Settings</span>
                  </button>
                  <button onClick={handleLogout}
                    className="w-full text-left p-3 flex items-center hover:bg-gray-50 text-red-500">
                    <i className="fas fa-sign-out-alt mr-3"></i>
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded border border-red-200 text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {[
            { label: "Today's Bookings",  value: todayBookings.length, color: 'blue',   icon: 'fa-calendar-day'  },
            { label: 'Arriving Today',    value: arriving.length,      color: 'green',  icon: 'fa-door-open',  sub: 'Confirmed' },
            { label: 'Completed Today',   value: completed.length,     color: 'purple', icon: 'fa-check-circle' },
            { label: 'Pending (All)',      value: allPending.length,    color: 'yellow', icon: 'fa-clock'        },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-lg shadow p-6 flex items-center">
              <div className={`p-3 rounded-full bg-${card.color}-100 text-${card.color}-600 mr-4`}>
                <i className={`fas ${card.icon} text-xl`}></i>
              </div>
              <div>
                <p className="text-gray-500 text-sm">{card.label}</p>
                <h3 className="text-2xl font-bold">{loading ? '—' : card.value}</h3>
                {card.sub && <p className="text-xs text-gray-400">{card.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Chart + Upcoming Arrivals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Bookings — Last 7 Days</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
            ) : (
              <div className="h-64">
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                  }}
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Arriving Today</h2>
            {loading ? (
              <p className="text-gray-400 text-sm">Loading...</p>
            ) : arriving.length === 0 ? (
              <div className="py-6 text-center text-gray-400">
                <i className="fas fa-calendar-check text-3xl mb-2 block"></i>
                <p className="text-sm">No confirmed arrivals for today.</p>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-64">
                {[...arriving]
                  .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
                  .map(b => (
                    <div key={b.booking_id} className="flex items-start border-b pb-3">
                      <div className="bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                        <i className="fas fa-user text-sm"></i>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{b.guest}</p>
                        <p className="text-xs text-gray-600">{b.roomType}</p>
                        <p className="text-xs text-blue-600">
                          {fmtTime(b.checkIn)} – {fmtTime(b.checkOut)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </Sidebar>
  );
}
