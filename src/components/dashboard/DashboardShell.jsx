// src/components/dashboard/DashboardShell.jsx
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../lib/notificationApi.js";
import { getMessages } from "../../lib/messageApi.js";
import { Helmet } from "react-helmet-async";
import UnverifiedEmailBanner from "../UnverifiedEmailBanner.jsx";
import PendingEmailChangeBanner from "../PendingEmailChangeBanner.jsx";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function NavItem({ to, badge, children }) {
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
      <span className="flex-1 flex items-center gap-3">{children}</span>
      {badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </NavLink>
  );
}

// ─── Notification bell + dropdown ─────────────────────────────────────────────
const NOTIF_LINK = {
  booking_confirmed:  "/dashboard/bookings",
  booking_cancelled:  "/dashboard/bookings",
  booking_checked_in: "/dashboard/bookings",
  booking_completed:  "/dashboard/bookings",
  payment_collected:  "/dashboard/bookings",
  message_received:   "/dashboard/messages",
};

function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]               = useState(0);
  const [open, setOpen]                   = useState(false);
  const ref                               = useRef(null);
  const navigate                          = useNavigate();

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
    const id = setInterval(load, 20_000);
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
        className="relative p-2 text-gray-600 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-brand/50"
        aria-label="Notifications"
      >
        <i className="fas fa-bell-concierge text-lg"></i>
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
                  onClick={() => {
                    if (!n.is_read) handleMarkOne(n.id);
                    const dest = NOTIF_LINK[n.type];
                    if (dest) { setOpen(false); navigate(dest); }
                  }}
                >
                  <span className="mt-0.5">
                    <i className={`fas ${
                      n.type === "booking_confirmed" ? "fa-calendar-check text-green-500" :
                      n.type === "booking_cancelled" ? "fa-calendar-xmark text-red-500" :
                      n.type === "message_received"  ? "fa-envelope text-blue-500" :
                      "fa-bell text-gray-400"
                    }`}></i>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
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
  const { user } = useAuth();
  const [msgUnread, setMsgUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Poll message unread count every 15s for sidebar badge
  useEffect(() => {
    function loadMsgs() {
      getMessages()
        .then((threads) => {
          const count = threads.reduce((sum, t) => sum + (t.unread || 0), 0);
          setMsgUnread(count);
        })
        .catch(() => {});
    }
    loadMsgs();
    const id = setInterval(loadMsgs, 20_000);
    return () => clearInterval(id);
  }, []);

  const initials = (user?.name || "G").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="pt-16">
      <Helmet><title>Dashboard — Aplaya Beach Resort</title></Helmet>
      {/* Sticky nudge for unverified guests — hidden once email is
          verified. Click opens the 6-digit OTP modal without forcing
          the user onto the standalone /verify-email page. */}
      <UnverifiedEmailBanner />
      {/* Sticky nudge for guests with a pending email change — hidden
          as soon as pending_email clears (swap verified or cancelled).
          Stacks under UnverifiedEmailBanner when both apply. */}
      <PendingEmailChangeBanner />
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
        {/* Sidebar */}
        <aside
          className={`bg-white shadow-md rounded-xl p-4 h-fit transition-all duration-200 ${
            sidebarOpen
              ? "fixed inset-y-0 left-0 z-40 w-64 rounded-none pt-20 shadow-2xl"
              : "hidden md:block"
          }`}
        >
          {/* Close button (mobile only) */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 md:hidden text-gray-400 hover:text-gray-600"
              aria-label="Close sidebar"
            >
              <i className="fas fa-times text-lg"></i>
            </button>
          )}

          {/* User info */}
          <div className="px-4 pb-4 mb-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user?.name || "Profile"}
                  className="h-9 w-9 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">
                  {initials}
                </div>
              )}
              <NotificationBell />
            </div>
            <p className="text-sm font-semibold text-gray-900 break-words">{user?.name || "Guest"}</p>
            <p className="text-xs text-gray-400 break-all">{user?.email || ""}</p>
          </div>

          <nav aria-label="Dashboard navigation">
            <ul className="space-y-1" onClick={() => setSidebarOpen(false)}>
              <li><NavItem to="/dashboard"><i className="fas fa-home w-5 text-center"></i> Dashboard</NavItem></li>
              <li><NavItem to="/dashboard/bookings"><i className="fas fa-calendar-alt w-5 text-center"></i> My Bookings</NavItem></li>
              <li><NavItem to="/dashboard/profile"><i className="fas fa-user-edit w-5 text-center"></i> Edit Profile</NavItem></li>
              <li><NavItem to="/dashboard/messages" badge={msgUnread}><i className="fas fa-envelope w-5 text-center"></i> Messages</NavItem></li>
            </ul>
          </nav>
        </aside>

        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((s) => !s)}
          className="md:hidden fixed bottom-4 left-4 z-20 h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition"
          aria-label="Toggle sidebar"
        >
          <i className={`fas ${sidebarOpen ? "fa-times" : "fa-bars"}`}></i>
        </button>

        {/* Main content */}
        <main className="min-h-[60vh]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
