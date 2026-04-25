import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useStaffNotifications } from "../../hooks/useStaffNotifications.js";
import NotificationContext from "../../context/NotificationContext.jsx";
import StaffChatWidget from "../StaffChatWidget.jsx";
import NotificationBell from "../ui/NotificationBell.jsx";
import Avatar from "../ui/Avatar.jsx";
import Toast, { useToast } from "../ui/Toast.jsx";
import { updateProfile, changePassword } from "../../lib/profileApi.js";
import useLockBodyScroll from "../../hooks/useLockBodyScroll.js";
import Modal from "../modals/Modal.jsx";
import { Helmet } from "react-helmet-async";

const PAGE_TITLES = {
  "/admin":                "Dashboard",
  "/admin/bookings":       "Bookings",
  "/admin/walk-in":        "Walk-In",
  "/admin/billing":        "Billing",
  "/admin/guest-records":  "Guest Records",
  "/admin/rooms":          "Rooms",
  "/admin/messages":       "Messages",
  "/admin/content":        "Manage Website",
  "/admin/reviews":        "Reviews",
  "/admin/promo-codes":    "Promo Codes",
  "/admin/newsletter":     "Newsletter",
  "/admin/catalog":        "Catalog",
  "/admin/users":          "Staff",
  "/admin/activity-log":   "Activity Log",
};

// Admin menu — the "deputy manager" role, covering front-desk duties
// (when FD is absent) plus owner-side management work (when owner is
// away). Wire frontdesk pages under /admin/* via the `embedded` prop
// on FD components so AdminShell provides the sidebar instead of each
// FD page rendering its own. Owner-only routes (Rooms CRUD, Users,
// Analytics, Settings, Activity Log, Stats) stay off this menu.
const MENU = {
  main: [
    { path: "/admin",                icon: "fa-tachometer-alt", label: "Dashboard" },
  ],
  operations: [
    { path: "/admin/bookings",       icon: "fa-calendar-check", label: "Bookings" },
    // Walk-In intentionally not here — Bookings already surfaces
    // walk-in creation inline, and having a separate sidebar item
    // duplicated the entry point.
    { path: "/admin/billing",        icon: "fa-file-invoice-dollar", label: "Billing" },
    { path: "/admin/guest-records",  icon: "fa-id-card",        label: "Guest Records" },
    { path: "/admin/rooms",          icon: "fa-bed",            label: "Rooms" },
  ],
  manage: [
    { path: "/admin/messages",       icon: "fa-envelope",       label: "Messages", badgeKey: "unreadMessages" },
    { path: "/admin/content",        icon: "fa-globe",          label: "Manage Website" },
    // Reviews dropped from the sidebar — same list is a tab inside
    // Manage Website. /admin/reviews still resolves (redirects to the
    // Content page's Reviews tab in App.jsx) for legacy deep-links.
    { path: "/admin/promo-codes",    icon: "fa-tag",            label: "Promo Codes" },
    { path: "/admin/newsletter",     icon: "fa-paper-plane",    label: "Newsletter" },
  ],
  // Catalog group — admin can only enable/disable rooms and add-ons.
  // Strategic CRUD (rates, names, create/delete) lives in the
  // owner portal.
  catalog: [
    { path: "/admin/catalog",        icon: "fa-tags",           label: "Catalog" },
  ],
  // Oversight group — admin can read the activity log and toggle
  // a front_desk staff member's active flag (no full user CRUD).
  oversight: [
    { path: "/admin/users",          icon: "fa-users",          label: "Staff" },
    { path: "/admin/activity-log",   icon: "fa-clock-rotate-left", label: "Activity Log" },
  ],
};

const ROLE_LABELS = {
  admin: "Admin",
  owner: "Owner",
};

export default function AdminShell() {
  const [collapsed,    setCollapsed]    = useState(() => {
    try { return JSON.parse(localStorage.getItem("admin_sidebar_collapsed") || "false"); } catch { return false; }
  });
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);
  const [saving,       setSaving]       = useState(false);

  const [showCurrent,  setShowCurrent]  = useState(false);
  const [showNew,      setShowNew]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  const [toast, showToast, clearToast, toastType] = useToast();

  const location   = useLocation();
  const navigate   = useNavigate();
  const { user, logout, setUser } = useAuth();
  const profileRef = useRef(null);

  const userName  = user?.name  || "Admin";
  const userEmail = user?.email || "admin@aplayaccess.com";
  const userRole  = ROLE_LABELS[user?.role] || "Admin";
  const initials  = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const pageTitle = PAGE_TITLES[location.pathname] ?? "Admin";

  const [editProfile,   setEditProfile]   = useState({ name: userName, email: userEmail, phone: user?.phone || "" });
  const [passwordData,  setPasswordData]  = useState({ current: "", new: "", confirm: "" });

  // Notification polling — paths must point INSIDE /admin/* so the bell
  // and the chat widget keep admin in their own portal. Pointing at
  // /owner/* or /frontdesk/* bounced admin out via RequireOwner /
  // RequireFrontdesk guards.
  const { counts, items: notifItems, total: notifTotal, refresh: notifRefresh } = useStaffNotifications({
    messages:           '/admin/messages',
    arrivals:           '/admin/bookings?status=Confirmed',
    soonCheckouts:      '/admin/bookings?status=Checked+In',
    overdueCheckouts:   '/admin/bookings?status=Checked+In',
    reviews:            '/admin/content?tab=reviews',
  });

  // Persist collapsed preference
  useEffect(() => { localStorage.setItem("admin_sidebar_collapsed", JSON.stringify(collapsed)); }, [collapsed]);

  // Lock body scroll when mobile sidebar or settings modal open
  useLockBodyScroll(mobileOpen || settingsOpen);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escape key closes settings modal & mobile sidebar
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (settingsOpen) closeSettings();
        if (mobileOpen) setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [settingsOpen, mobileOpen]);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const openSettings = () => {
    setEditProfile({ name: userName, email: userEmail, phone: user?.phone || "" });
    setPasswordData({ current: "", new: "", confirm: "" });
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    setIsEditing(false);
    setProfileOpen(false);
    setSettingsOpen(true);
  };

  function closeSettings() {
    if (isEditing) {
      const dirty = editProfile.name !== userName || editProfile.email !== userEmail
        || editProfile.phone !== (user?.phone || "") || passwordData.current || passwordData.new || passwordData.confirm;
      if (dirty && !confirm("Discard unsaved changes?")) return;
    }
    setSettingsOpen(false);
    setIsEditing(false);
  }

  const saveSettings = async () => {
    if (passwordData.new && passwordData.new !== passwordData.confirm) {
      showToast("New passwords do not match.", "error");
      return;
    }
    setSaving(true);
    try {
      // Update profile via API
      const { user: updated } = await updateProfile({
        name:  editProfile.name,
        email: editProfile.email,
        phone: editProfile.phone,
      });
      if (setUser) setUser(updated);

      // Change password if provided
      if (passwordData.current && passwordData.new) {
        await changePassword(passwordData.current, passwordData.new);
      }

      setIsEditing(false);
      setSettingsOpen(false);
      showToast("Profile updated successfully.", "success");
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Failed to save changes.";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const isActive = (path) =>
    path === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(path);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate("/staff-login");
  };

  const notifCtx = { counts, items: notifItems, total: notifTotal, refresh: notifRefresh };

  const pwStrength = passwordData.new.length >= 8 ? "strong" : passwordData.new.length > 0 ? "weak" : null;
  const pwMismatch = passwordData.confirm && passwordData.new !== passwordData.confirm;

  /* ── Sidebar content (shared between desktop & mobile) ───────────── */
  const sidebarContent = (mobile = false) => (
    <>
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-brand-hover">
        <div className="flex items-center">
          <i className="fas fa-umbrella-beach text-2xl mr-3 text-white"></i>
          {(!collapsed || mobile) && <span className="text-xl font-bold text-white">AplayAccess</span>}
        </div>
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white hover:bg-brand-hover p-2 rounded focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <i className={`fas ${collapsed ? "fa-chevron-right" : "fa-chevron-left"}`}></i>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4" aria-label="Admin navigation">
        <div className="mb-6">
          {(!collapsed || mobile) && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3 px-2">Admin</h3>}
          <ul>
            {MENU.main
              .filter(item => !item.ownerOnly || user?.role === "owner")
              .map((item) => {
                const badge = item.badgeKey ? counts[item.badgeKey] : 0;
                return (
                  <li key={item.path} className="mb-2 relative">
                    <Link
                      to={item.path}
                      onClick={mobile ? () => setMobileOpen(false) : undefined}
                      className={`flex items-center p-2 rounded transition ${
                        isActive(item.path)
                          ? "bg-brand-hover text-white"
                          : "text-blue-100 hover:bg-brand-hover hover:text-white"
                      }`}
                    >
                      <i className={`fas ${item.icon} mr-3 w-5 text-center shrink-0`}></i>
                      {(!collapsed || mobile) && (
                        <>
                          <span className="text-sm flex-1">{item.label}</span>
                          {badge > 0 && (
                            <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white
                              text-[10px] font-bold flex items-center justify-center px-1 leading-none shrink-0">
                              {badge > 99 ? "99+" : badge}
                            </span>
                          )}
                        </>
                      )}
                      {!mobile && collapsed && badge > 0 && (
                        <span className="absolute right-1 top-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none"></span>
                      )}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>

        <div className="mb-6">
          {(!collapsed || mobile) && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3 px-2">Operations</h3>}
          <ul>
            {MENU.operations.map((item) => {
              const badge = item.badgeKey ? counts[item.badgeKey] : 0;
              return (
                <li key={item.path} className="mb-2 relative">
                  <Link
                    to={item.path}
                    onClick={mobile ? () => setMobileOpen(false) : undefined}
                    className={`flex items-center p-2 rounded transition ${
                      isActive(item.path)
                        ? "bg-brand-hover text-white"
                        : "text-blue-100 hover:bg-brand-hover hover:text-white"
                    }`}
                  >
                    <i className={`fas ${item.icon} mr-3 w-5 text-center shrink-0`}></i>
                    {(!collapsed || mobile) && (
                      <>
                        <span className="text-sm flex-1">{item.label}</span>
                        {badge > 0 && (
                          <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white
                            text-[10px] font-bold flex items-center justify-center px-1 leading-none shrink-0">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </>
                    )}
                    {!mobile && collapsed && badge > 0 && (
                      <span className="absolute right-1 top-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none"></span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mb-6">
          {(!collapsed || mobile) && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3 px-2">Management</h3>}
          <ul>
            {MENU.manage.map((item) => {
              const badge = item.badgeKey ? counts[item.badgeKey] : 0;
              return (
                <li key={item.path} className="mb-2 relative">
                  <Link
                    to={item.path}
                    onClick={mobile ? () => setMobileOpen(false) : undefined}
                    className={`flex items-center p-2 rounded transition ${
                      isActive(item.path)
                        ? "bg-brand-hover text-white"
                        : "text-blue-100 hover:bg-brand-hover hover:text-white"
                    }`}
                  >
                    <i className={`fas ${item.icon} mr-3 w-5 text-center shrink-0`}></i>
                    {(!collapsed || mobile) && (
                      <>
                        <span className="text-sm flex-1">{item.label}</span>
                        {badge > 0 && (
                          <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white
                            text-[10px] font-bold flex items-center justify-center px-1 leading-none shrink-0">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </>
                    )}
                    {!mobile && collapsed && badge > 0 && (
                      <span className="absolute right-1 top-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none"></span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mb-6">
          {(!collapsed || mobile) && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3 px-2">Catalog</h3>}
          <ul>
            {MENU.catalog.map((item) => (
              <li key={item.path} className="mb-2 relative">
                <Link
                  to={item.path}
                  onClick={mobile ? () => setMobileOpen(false) : undefined}
                  className={`flex items-center p-2 rounded transition ${
                    isActive(item.path)
                      ? "bg-brand-hover text-white"
                      : "text-blue-100 hover:bg-brand-hover hover:text-white"
                  }`}
                >
                  <i className={`fas ${item.icon} mr-3 w-5 text-center shrink-0`}></i>
                  {(!collapsed || mobile) && <span className="text-sm flex-1">{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          {(!collapsed || mobile) && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3 px-2">Oversight</h3>}
          <ul>
            {MENU.oversight.map((item) => (
              <li key={item.path} className="mb-2 relative">
                <Link
                  to={item.path}
                  onClick={mobile ? () => setMobileOpen(false) : undefined}
                  className={`flex items-center p-2 rounded transition ${
                    isActive(item.path)
                      ? "bg-brand-hover text-white"
                      : "text-blue-100 hover:bg-brand-hover hover:text-white"
                  }`}
                >
                  <i className={`fas ${item.icon} mr-3 w-5 text-center shrink-0`}></i>
                  {(!collapsed || mobile) && <span className="text-sm flex-1">{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Portal switcher intentionally not rendered here. Admin has
          operations + management in one portal — no switching needed.
          Owner has their own switcher inside OwnerShell when they want
          to jump to /frontdesk; they don't come here. Front desk is
          gated to their own portal. */}

      {/* User info + logout */}
      <div className="p-4 border-t border-brand-hover">
        {(!collapsed || mobile) && (
          <div className="mb-3">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-blue-200 truncate">{userRole} · {userEmail}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center w-full p-2 text-blue-100 hover:bg-brand-hover rounded transition"
        >
          <i className="fas fa-sign-out-alt mr-3 w-5 text-center"></i>
          {(!collapsed || mobile) && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <NotificationContext.Provider value={notifCtx}>
    <Helmet><title>{pageTitle} — AplayAccess Admin</title></Helmet>
    <div className="flex h-screen overflow-hidden">

      {/* ── Desktop Sidebar ───────────────────────────────────────── */}
      <div className={`hidden md:flex bg-brand text-white ${collapsed ? "w-20" : "w-64"} flex-col transition-[width] duration-300 flex-shrink-0`}>
        {sidebarContent(false)}
      </div>

      {/* ── Mobile Sidebar Overlay ────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute inset-y-0 left-0 w-72 bg-brand text-white flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 text-blue-200 hover:text-white z-10"
              aria-label="Close sidebar"
            >
              <i className="fas fa-times text-lg"></i>
            </button>
            {sidebarContent(true)}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto flex flex-col bg-slate-100">

        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-20">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand/50"
                aria-label="Open menu"
              >
                <i className="fas fa-bars text-xl"></i>
              </button>
              <h1 className="text-2xl font-bold text-gray-800">{pageTitle}</h1>
            </div>
            <div className="flex items-center space-x-4">

              <NotificationBell />

              {/* Profile dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand/50"
                >
                  <Avatar
                    src={user?.avatar}
                    name={userName}
                    className="h-8 w-8"
                    fallbackClassName="bg-brand text-white text-sm font-semibold"
                  />
                  <span className="hidden md:inline text-sm font-medium">{userName}</span>
                  <i className="fas fa-chevron-down text-xs text-gray-400"></i>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-12 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-3 flex items-center border-b border-gray-100">
                      <Avatar
                        src={user?.avatar}
                        name={userName}
                        className="h-10 w-10 mr-3"
                        fallbackClassName="bg-brand text-white text-sm font-semibold"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{userName}</p>
                        <p className="text-xs text-gray-500">{userRole}</p>
                      </div>
                    </div>
                    <button
                      onClick={openSettings}
                      className="p-3 flex items-center w-full text-left hover:bg-gray-50 border-b border-gray-100"
                    >
                      <i className="fas fa-user-cog mr-3 text-gray-500"></i>
                      <span className="text-sm text-gray-700">Account Settings</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="p-3 flex items-center w-full text-left hover:bg-gray-50 text-red-500"
                    >
                      <i className="fas fa-sign-out-alt mr-3"></i>
                      <span className="text-sm">Logout</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {/* ── Account Settings Modal ────────────────────────────────── */}
      {settingsOpen && (
        <Modal open onClose={closeSettings} title="Account Settings" maxWidth="max-w-lg">
          <div className="max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                <i className="fas fa-user-cog mr-2 text-brand"></i>Account Settings
              </h3>
              <button
                onClick={closeSettings}
                className="text-gray-400 hover:text-gray-600 transition"
                aria-label="Close"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className="p-6">
              {/* Profile Header */}
              <div className="flex items-center mb-6 p-4 bg-gray-50 rounded-lg">
                <Avatar
                  src={user?.avatar}
                  name={userName}
                  className="h-14 w-14 mr-4"
                  fallbackClassName="bg-brand text-white text-lg font-semibold"
                />
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{userName}</p>
                  <p className="text-sm text-gray-500">{userRole}</p>
                  <p className="text-xs text-gray-400">{userEmail}</p>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => { setEditProfile({ name: userName, email: userEmail, phone: user?.phone || "" }); setIsEditing(true); }}
                    className="px-4 py-2 bg-brand text-white rounded text-sm hover:bg-brand-dark transition"
                  >
                    <i className="fas fa-edit mr-2"></i>Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <>
                  {/* Profile fields */}
                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">Profile Information</h4>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <div className="relative">
                        <i className="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input
                          type="text"
                          value={editProfile.name}
                          onChange={(e) => setEditProfile({ ...editProfile, name: e.target.value })}
                          autoComplete="name"
                          className="border rounded px-3 py-2 pl-9 w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <div className="relative">
                        <i className="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input
                          type="email"
                          value={editProfile.email}
                          onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
                          autoComplete="email"
                          className="border rounded px-3 py-2 pl-9 w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <div className="relative">
                        <i className="fas fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input
                          type="tel"
                          value={editProfile.phone}
                          onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
                          autoComplete="tel"
                          className="border rounded px-3 py-2 pl-9 w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <div className="relative">
                        <i className="fas fa-shield-alt absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input
                          type="text"
                          value={userRole}
                          readOnly
                          className="border rounded px-3 py-2 pl-9 w-full bg-gray-100 text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Change Password */}
                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">Change Password</h4>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                      <div className="relative">
                        <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input
                          type={showCurrent ? "text" : "password"}
                          value={passwordData.current}
                          onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                          autoComplete="current-password"
                          className="border rounded px-3 py-2 pl-9 pr-10 w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          <i className={`fas ${showCurrent ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                        </button>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                      <div className="relative">
                        <i className="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input
                          type={showNew ? "text" : "password"}
                          value={passwordData.new}
                          onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                          autoComplete="new-password"
                          className="border rounded px-3 py-2 pl-9 pr-10 w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          <i className={`fas ${showNew ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                        </button>
                      </div>
                      {pwStrength && (
                        <p className={`text-xs mt-1 ${pwStrength === "strong" ? "text-emerald-600" : "text-amber-600"}`}>
                          <i className={`fas ${pwStrength === "strong" ? "fa-check-circle" : "fa-info-circle"} mr-1`}></i>
                          {pwStrength === "strong" ? "Strong password" : "At least 8 characters recommended"}
                        </p>
                      )}
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                      <div className="relative">
                        <i className="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input
                          type={showConfirm ? "text" : "password"}
                          value={passwordData.confirm}
                          onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                          autoComplete="new-password"
                          className={`border rounded px-3 py-2 pl-9 pr-10 w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand ${
                            pwMismatch ? "border-red-400" : ""
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          <i className={`fas ${showConfirm ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                        </button>
                      </div>
                      {pwMismatch && (
                        <p className="text-xs text-red-500 mt-1">
                          <i className="fas fa-exclamation-circle mr-1"></i>Passwords do not match
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-gray-700">Profile Information</h4>
                  <div className="grid grid-cols-1 gap-4 p-4 bg-gray-50 rounded">
                    <div className="flex items-start gap-3">
                      <i className="fas fa-user text-gray-400 mt-0.5 w-4 text-center"></i>
                      <div>
                        <p className="text-xs text-gray-500">Full Name</p>
                        <p className="font-medium">{userName}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <i className="fas fa-envelope text-gray-400 mt-0.5 w-4 text-center"></i>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="font-medium">{userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <i className="fas fa-phone text-gray-400 mt-0.5 w-4 text-center"></i>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="font-medium">{user?.phone || "\u2014"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <i className="fas fa-shield-alt text-gray-400 mt-0.5 w-4 text-center"></i>
                      <div>
                        <p className="text-xs text-gray-500">Role</p>
                        <p className="font-medium">{userRole}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end space-x-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSettings}
                      disabled={saving}
                      className="px-4 py-2 rounded text-sm font-medium text-white bg-brand hover:bg-brand-dark transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={closeSettings}
                    className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Shared Toast */}
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Floating quick-reply widget — same pattern as OwnerShell.
          Lets admin answer a recent guest message without leaving
          whatever page they're on. Shell-level so it's present
          across all /admin/* routes. */}
      <StaffChatWidget />
    </div>
    </NotificationContext.Provider>
  );
}
