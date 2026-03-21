// src/components/dashboard/DashboardShell.jsx
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../lib/notificationApi.js";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === "/dashboard"}
      className={({ isActive }) =>
        [
          "block px-4 py-2 rounded-md flex items-center gap-3",
          isActive ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

// ─── Notification bell + dropdown ─────────────────────────────────────────────
function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]               = useState(0);
  const [open, setOpen]                   = useState(false);
  const ref                               = useRef(null);

  // Load on mount, refresh every 60s
  useEffect(() => {
    function load() {
      getNotifications()
        .then(({ data, unread: u }) => {
          setNotifications(data);
          setUnread(u);
        })
        .catch(() => {});
    }
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleMarkAll() {
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  }

  async function handleMarkOne(id) {
    await markNotificationRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnread((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-gray-600 hover:text-blue-600 focus:outline-none"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h4 className="font-semibold text-gray-900 text-sm">Notifications</h4>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-blue-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={[
                    "px-4 py-3 flex gap-3 cursor-pointer hover:bg-gray-50 transition",
                    !n.is_read ? "bg-blue-50" : "",
                  ].join(" ")}
                  onClick={() => !n.is_read && handleMarkOne(n.id)}
                >
                  <span className="mt-0.5 text-lg">
                    {n.type === "booking_confirmed" ? "📋" :
                     n.type === "booking_cancelled" ? "❌" :
                     n.type === "message_received"  ? "✉️" : "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{n.created_at}</p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shell layout ─────────────────────────────────────────────────────────────
export default function DashboardShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout?.();
    navigate("/resort");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center">
            <span className="text-xl font-bold text-blue-600">Aplaya Beach Resort</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-gray-700">
              Welcome, <span className="font-semibold">{user?.name || user?.email || "Guest"}</span>!
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="bg-white shadow-md rounded-xl p-4 h-fit">
          <nav>
            <ul className="space-y-2">
              <li><NavItem to="/dashboard">🏠 Dashboard</NavItem></li>
              <li><NavItem to="/dashboard/bookings">📋 My Bookings</NavItem></li>
              <li><NavItem to="/dashboard/profile">👤 Edit Profile</NavItem></li>
              <li><NavItem to="/dashboard/messages">✉️ Messages</NavItem></li>
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-h-[60vh]">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-4 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          © 2025 Aplaya Beach Resort. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
