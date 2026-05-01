// src/components/dashboard/DashboardShell.jsx
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../lib/notificationApi.js";
import { getMessages } from "../../lib/messageApi.js";
import { Helmet } from "react-helmet-async";
import UnverifiedEmailBanner from "../UnverifiedEmailBanner.jsx";
import PendingEmailChangeBanner from "../PendingEmailChangeBanner.jsx";
import Avatar from "../ui/Avatar.jsx";
import useFocusTrap from "../../hooks/useFocusTrap.js";

// Wraps a setInterval poll so it pauses while the tab is hidden and
// fires once on tab-return. Cuts background battery + API noise from
// 3-per-min-per-poll down to zero, and gives the user fresh data the
// moment they tab back. Returns a cleanup that clears both the
// interval and the visibilitychange listener.
function startVisibilityAwarePoll(fn, intervalMs) {
  let id = null;
  function start() {
    if (id != null) return;
    id = setInterval(fn, intervalMs);
  }
  function stop() {
    if (id == null) return;
    clearInterval(id);
    id = null;
  }
  function onVis() {
    if (document.visibilityState === "visible") {
      fn();          // refresh immediately on return
      start();
    } else {
      stop();
    }
  }
  // Initial state: only poll if visible right now.
  if (document.visibilityState === "visible") start();
  document.addEventListener("visibilitychange", onVis);
  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVis);
  };
}

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
          "px-4 py-2.5 min-h-11 rounded-md flex items-center gap-3",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
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
  const [style, setStyle]                 = useState({});
  const btnRef                            = useRef(null);
  const dropRef                           = useRef(null);
  const navigate                          = useNavigate();

  // Close-on-Escape + initial-focus on open. Treats the dropdown
  // as a popover, not a WAI-ARIA menu — we don't implement
  // arrow-key navigation between items, so role="menu" would
  // mislead screen readers about the interaction model.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    // Defer focus to next tick so the dropdown has rendered.
    const t = setTimeout(() => {
      const first = dropRef.current?.querySelector("button, [href]");
      first?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  // Load on mount, refresh every 20s while the tab is visible. Hidden
  // tabs pause; tab-return fires an immediate refresh so the user
  // sees up-to-date counts without waiting for the next interval.
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
    return startVisibilityAwarePoll(load, 20_000);
  }, []);

  // Close dropdown when clicking outside (button + dropdown both checked
  // since dropdown is rendered fixed-position outside the button's parent).
  useEffect(() => {
    function handler(e) {
      if (
        btnRef.current  && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Position dropdown via fixed coords so it can't be clipped by overflow:
  // hidden parents in the navbar, and clamp width to viewport so it never
  // extends off-screen left on narrow phones. Same pattern as the staff
  // NotificationBell at src/components/ui/NotificationBell.jsx.
  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const vw     = window.innerWidth;
      const width  = Math.min(320, vw - 16);
      // Default: align dropdown right edge with bell right edge.
      let right    = Math.max(8, vw - rect.right);
      // But if that would push the left edge off-screen, shift the
      // dropdown rightward so the left edge sits at 8px gutter.
      if (vw - right - width < 8) right = vw - width - 8;
      setStyle({
        position: 'fixed',
        top:   rect.bottom + 6,
        right,
        width,
      });
    }
    setOpen(true);
  }

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
    <>
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="relative w-11 h-11 inline-flex items-center justify-center rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        type="button"
      >
        <i className="fas fa-bell-concierge text-lg" aria-hidden="true"></i>
        {unread > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropRef}
          style={style}
          className="z-[9999] bg-white rounded-xl shadow-xl border overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h4 className="font-semibold text-gray-900 text-sm">Notifications</h4>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                type="button"
                className="text-xs text-blue-700 hover:underline px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                // Render as a real button so screen readers announce
                // it as a control and keyboard users can Enter/Space
                // to activate. Was a click-only div previously, which
                // bell-keyboard users couldn't reach. We don't use
                // role="menuitem" because we don't implement menu
                // arrow-key navigation — this is a popover with a
                // list of buttons, plain Tab traversal.
                <button
                  key={n.id}
                  type="button"
                  className={[
                    "w-full text-left px-4 py-3 flex gap-3 transition",
                    "hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500",
                    !n.is_read ? "bg-blue-50" : "bg-white",
                  ].join(" ")}
                  onClick={() => {
                    if (!n.is_read) handleMarkOne(n.id);
                    const dest = NOTIF_LINK[n.type];
                    if (dest) { setOpen(false); navigate(dest); }
                  }}
                >
                  <span className="mt-0.5 shrink-0">
                    <i className={`fas ${
                      n.type === "booking_confirmed" ? "fa-calendar-check text-green-600" :
                      n.type === "booking_cancelled" ? "fa-calendar-xmark text-red-600" :
                      n.type === "message_received"  ? "fa-envelope text-blue-600" :
                      "fa-bell text-gray-500"
                    }`} aria-hidden="true"></i>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-600 truncate">{n.body}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" aria-label="Unread" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Shell layout ─────────────────────────────────────────────────────────────
export default function DashboardShell() {
  const { user } = useAuth();
  const [msgUnread, setMsgUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Poll message unread count for the sidebar badge. Same
  // visibility-aware policy as the notification bell — paused while
  // the tab is hidden, refires immediately on tab-return.
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
    return startVisibilityAwarePoll(loadMsgs, 20_000);
  }, []);

  // Escape-to-close + focus trap for the mobile sidebar drawer. The
  // useFocusTrap hook moves initial focus into the panel and restores
  // it to the trigger on close; the keydown handler adds the Escape
  // dismiss that overlay-click already provides.
  const sidebarTrapRef = useFocusTrap(sidebarOpen);
  useEffect(() => {
    if (!sidebarOpen) return;
    function onKey(e) { if (e.key === "Escape") setSidebarOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

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
          ref={sidebarTrapRef}
          id="dashboard-sidebar"
          role={sidebarOpen ? "dialog" : undefined}
          aria-modal={sidebarOpen ? "true" : undefined}
          aria-label={sidebarOpen ? "Dashboard navigation" : undefined}
          className={`bg-white shadow-md rounded-xl p-4 h-fit transition-all duration-200 ${
            sidebarOpen
              ? "fixed inset-y-0 left-0 z-40 w-64 rounded-none pt-20 shadow-2xl focus:outline-none"
              : "hidden md:block"
          }`}
        >
          {/* Close button (mobile only) — 44×44 hit target so it
              meets touch standards. */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 md:hidden w-11 h-11 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="Close sidebar"
              type="button"
            >
              <i className="fas fa-times text-lg" aria-hidden="true"></i>
            </button>
          )}

          {/* User info */}
          <div className="px-4 pb-4 mb-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Avatar
                src={user?.avatar}
                name={user?.name}
                className="h-9 w-9 shrink-0"
                fallbackClassName="bg-blue-100 text-blue-600 text-xs font-bold"
              />
              <NotificationBell />
            </div>
            <p className="text-sm font-semibold text-gray-900 break-words">{user?.name || "Guest"}</p>
            <p className="text-xs text-gray-600 break-all">{user?.email || ""}</p>
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

        {/* Mobile sidebar toggle — top-left, just below the global
            Navbar (which sits fixed at top-0 with h-16). Matches the
            convention used by frontdesk Sidebar (top-left white square)
            and Admin/Owner shells (hamburger inside the top header).
            Was previously bottom-left blue FAB — non-standard for menu
            actions and the only outlier in the app. Top-20 = 80px,
            which is the navbar's 64px + 16px breathing room so the
            button never visually collides with the navbar contents. */}
        <button
          onClick={() => setSidebarOpen((s) => !s)}
          className="md:hidden fixed top-20 left-4 z-30 flex items-center justify-center w-11 h-11 rounded-md bg-white shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
          type="button"
        >
          <i className={`fas ${sidebarOpen ? "fa-times" : "fa-bars"}`} aria-hidden="true"></i>
        </button>

        {/* Main content */}
        <main className="min-h-[60vh]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
