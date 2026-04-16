import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import Sidebar from './Layout/Sidebar';
import Modal from '../../components/modals/Modal';
import { useAuth } from '../../context/AuthContext';
import { getFdBookings } from '../../lib/frontdeskApi';
import NotificationBell from '../../components/ui/NotificationBell';
import Toast, { useToast } from '../../components/ui/Toast';

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

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, showToast, clearToast, toastType] = useToast();

  const [profileOpen, setProfileOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const profileRef = useRef(null);

  const userName  = session?.name  || 'Front Desk';
  const userEmail = session?.email || '';
  const initials  = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // ── load bookings ───────────────────────────────────────────────────────────
  useEffect(() => {
    function load() {
      getFdBookings()
        .then(data => { setBookings(data); })
        .catch(() => showToast('Failed to load bookings.', 'error'))
        .finally(() => setLoading(false));
    }
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
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
    datasets: [{ label: 'Bookings', data: counts, backgroundColor: 'rgba(14,165,233,0.7)', borderRadius: 4 }],
  };

  // ── handlers ────────────────────────────────────────────────────────────────
  const handleLogout = async () => { await logout(); navigate('/staff-login'); };

  // ─── render ──────────────────────────────────────────────────────────────────
  return (
    <Sidebar showTopBar={false}>
      <Helmet><title>Dashboard — Frontdesk</title></Helmet>

      {/* ── Account Settings Modal ── */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Account Settings" maxWidth="max-w-md">
        <div className="p-4 bg-slate-50 rounded-lg mb-4">
          <div className="h-14 w-14 rounded-full bg-sky-600 text-white flex items-center justify-center text-lg font-bold mb-2">
            {initials}
          </div>
          <p className="font-bold text-lg">{userName}</p>
          <p className="text-sm text-slate-500">{userEmail}</p>
          <p className="text-xs text-slate-400 mt-1 capitalize">{session?.role?.replace('_', ' ') || 'Staff'}</p>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          To change your name, email, or password, contact your system administrator.
        </p>
        <div className="flex justify-end">
          <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 border rounded text-sm text-slate-700">
            Close
          </button>
        </div>
      </Modal>

      {/* ── Header ── */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <div className="flex items-center space-x-4">

            {/* Notifications */}
            <NotificationBell />

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
                <div className="h-8 w-8 rounded-full bg-sky-600 text-white flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
                <span className="hidden md:inline text-sm">{userName}</span>
                <i className="fas fa-chevron-down text-xs text-slate-400"></i>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-lg border z-50">
                  <div className="p-3 flex items-center border-b">
                    <div className="h-10 w-10 rounded-full bg-sky-600 text-white flex items-center justify-center font-semibold mr-3">
                      {initials}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{userName}</p>
                      <p className="text-xs text-slate-500 capitalize">{session?.role?.replace('_', ' ') || 'Staff'}</p>
                    </div>
                  </div>
                  <button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}
                    className="w-full text-left p-3 flex items-center hover:bg-slate-50 border-b">
                    <i className="fas fa-user-cog mr-3 text-slate-500"></i>
                    <span className="text-sm">Account Settings</span>
                  </button>
                  <button onClick={handleLogout}
                    className="w-full text-left p-3 flex items-center hover:bg-slate-50 text-rose-500">
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
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 flex items-center animate-pulse">
                <div className="h-12 w-12 rounded-full bg-slate-200 mr-4"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-slate-200 rounded"></div>
                  <div className="h-6 w-12 bg-slate-200 rounded"></div>
                </div>
              </div>
            ))
          ) : (
            [
              { label: "Today's Bookings",  value: todayBookings.length, bg: 'bg-sky-100',     text: 'text-sky-600',     icon: 'fa-calendar-day'  },
              { label: 'Arriving Today',    value: arriving.length,      bg: 'bg-emerald-100', text: 'text-emerald-600', icon: 'fa-door-open',  sub: 'Confirmed' },
              { label: 'Completed Today',   value: completed.length,     bg: 'bg-violet-100',  text: 'text-violet-600',  icon: 'fa-check-circle' },
              { label: 'Pending (All)',      value: allPending.length,    bg: 'bg-amber-100',   text: 'text-amber-600',   icon: 'fa-clock'        },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-lg shadow p-6 flex items-center">
                <div className={`p-3 rounded-full ${card.bg} ${card.text} mr-4`}>
                  <i className={`fas ${card.icon} text-xl`}></i>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">{card.label}</p>
                  <h3 className="text-2xl font-bold">{card.value}</h3>
                  {card.sub && <p className="text-xs text-slate-400">{card.sub}</p>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chart + Upcoming Arrivals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Bookings — Last 7 Days</h2>
            {loading ? (
              <div className="h-64 animate-pulse flex items-end gap-3 px-4 pb-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex-1 bg-slate-200 rounded-t" style={{ height: `${30 + Math.random() * 50}%` }}></div>
                ))}
              </div>
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
              <div className="space-y-4 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start border-b pb-3">
                    <div className="h-8 w-8 rounded-full bg-slate-200 mr-3 mt-1 shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-28 bg-slate-200 rounded"></div>
                      <div className="h-3 w-20 bg-slate-200 rounded"></div>
                      <div className="h-3 w-32 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : arriving.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                <i className="fas fa-calendar-check text-3xl mb-2 block"></i>
                <p className="text-sm">No confirmed arrivals for today.</p>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-64">
                {[...arriving]
                  .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
                  .map(b => (
                    <div key={b.bookingId} className="flex items-start border-b pb-3">
                      <div className="bg-sky-100 text-sky-800 rounded-full h-8 w-8 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                        <i className="fas fa-user text-sm"></i>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{b.guest}</p>
                        <p className="text-xs text-slate-600">{b.roomType}</p>
                        <p className="text-xs text-sky-600">
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
      <Toast message={toast} type={toastType} onClose={clearToast} />
    </Sidebar>
  );
}
