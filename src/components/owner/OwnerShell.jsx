import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import PortalTransition from "../PortalTransition.jsx";
import { useStaffNotifications } from "../../hooks/useStaffNotifications.js";
import NotificationContext from "../../context/NotificationContext.jsx";
import NotificationBell from "../ui/NotificationBell.jsx";
import Toast, { useToast } from "../ui/Toast.jsx";
import { updateProfile, changePassword } from "../../lib/profileApi.js";
import useLockBodyScroll from "../../hooks/useLockBodyScroll.js";
import Modal from "../modals/Modal.jsx";
import { Helmet } from "react-helmet-async";

const PAGE_TITLES = {
  "/owner":               "Dashboard",
  "/owner/rooms":         "Rooms",
  "/owner/guests":        "Guests",
  "/owner/reviews":       "Reviews",
  "/owner/content":       "Manage Website",
  "/owner/announcements": "Announcements",
  "/owner/addons":        "Add-ons",
  "/owner/promo-codes":   "Promo Codes",
  "/owner/newsletter":    "Newsletter",
  "/owner/transactions":  "Transactions",
  "/owner/reports":       "Reports & Analytics",
  "/owner/activity-log":  "Activity Log",
  "/owner/users":         "User Management",
  "/owner/messages":      "Messages",
  "/owner/settings":      "Pricing & Settings",
};

const MENU = {
  overview: [
    { path: "/owner", icon: "fa-tachometer-alt", label: "Dashboard" },
  ],
  management: [
    { path: "/owner/rooms",    icon: "fa-bed",        label: "Rooms" },
    { path: "/owner/guests",   icon: "fa-user-check", label: "Guests" },
    { path: "/owner/reviews",  icon: "fa-star",       label: "Reviews", badgeKey: "pendingReviews" },
  ],
  website: [
    { path: "/owner/content",       icon: "fa-globe",          label: "Manage Website" },
    { path: "/owner/announcements", icon: "fa-bullhorn",       label: "Announcements" },
    { path: "/owner/addons",        icon: "fa-concierge-bell", label: "Add-ons" },
  ],
  marketing: [
    { path: "/owner/promo-codes", icon: "fa-tag",               label: "Promo Codes" },
    { path: "/owner/newsletter",  icon: "fa-envelope-open-text", label: "Newsletter" },
  ],
  analytics: [
    { path: "/owner/transactions", icon: "fa-file-invoice-dollar", label: "Transactions" },
    { path: "/owner/reports",      icon: "fa-chart-line",          label: "Reports" },
    { path: "/owner/activity-log", icon: "fa-history",             label: "Activity Log" },
  ],
  system: [
    { path: "/owner/users",    icon: "fa-users-cog", label: "Users" },
    { path: "/owner/messages", icon: "fa-envelope",   label: "Messages", badgeKey: "unreadMessages" },
    { path: "/owner/settings", icon: "fa-sliders-h",  label: "Settings" },
  ],
};

const SECTION_LABELS = {
  overview:    "Overview",
  management:  "Management",
  website:     "Website",
  marketing:   "Marketing",
  analytics:   "Analytics",
  system:      "System",
};

export default function OwnerShell() {
  const [collapsed,    setCollapsed]    = useState(() => {
    try { return JSON.parse(localStorage.getItem("owner_sidebar_collapsed") || "false"); } catch { return false; }
  });
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [switching,    setSwitching]    = useState(null);

  const [showCurrent,  setShowCurrent]  = useState(false);
  const [showNew,      setShowNew]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  const [toast, showToast, clearToast, toastType] = useToast();

  const location   = useLocation();
  const navigate   = useNavigate();
  const { user, logout, setUser } = useAuth();
  const profileRef = useRef(null);

  const userName  = user?.name  || "Owner";
  const userEmail = user?.email || "";
  const initials  = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const pageTitle = PAGE_TITLES[location.pathname] ?? "Owner Portal";

  const [editProfile,   setEditProfile]   = useState({ name: userName, email: userEmail, phone: user?.phone || "" });
  const [passwordData,  setPasswordData]  = useState({ current: "", new: "", confirm: "" });

  // Notification polling — all paths point to /owner/* now
  const { counts, items: notifItems, total: notifTotal, refresh: notifRefresh } = useStaffNotifications({
    pendingBookings:    '/owner/transactions?status=Pending',
    messages:           '/owner/messages',
    arrivals:           '/frontdesk/reservation?status=Confirmed',
    overdueCheckouts:   '/frontdesk',
    reviews:            '/owner/reviews',
  });

  // Persist collapsed preference
  useEffect(() => { localStorage.setItem("owner_sidebar_collapsed", JSON.stringify(collapsed)); }, [collapsed]);

  // Lock body scroll when mobile sidebar or settings modal open
  useLockBodyScroll(mobileOpen || settingsOpen);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
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

  const switchPortal = (path, label) => {
    setSwitching(label);
    setTimeout(() => navigate(path), 1800);
  };

  const saveSettings = async () => {
    if (passwordData.new && passwordData.new !== passwordData.confirm) {
      showToast("New passwords do not match.", "error");
      return;
    }
    setSaving(true);
    try {
      const { user: updated } = await updateProfile({
        name:  editProfile.name,
        email: editProfile.email,
        phone: editProfile.phone,
      });
      if (setUser) setUser(updated);
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
    path === "/owner" ? location.pathname === "/owner" : location.pathname.startsWith(path);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate("/staff-login");
  };

  if (switching) return <PortalTransition label={switching} />;

  const notifCtx = { counts, items: notifItems, total: notifTotal, refresh: notifRefresh };
  const pwStrength = passwordData.new.length >= 8 ? "strong" : passwordData.new.length > 0 ? "weak" : null;
  const pwMismatch = passwordData.confirm && passwordData.new !== passwordData.confirm;

  /* ── Render a menu section ─────────────────────────────────── */
  const renderSection = (key, mobile = false) => (
    <div key={key} className="mb-4">
      {(!collapsed || mobile) && (
        <h3 className="uppercase text-[10px] font-semibold text-blue-300 mb-2 px-2 tracking-wider">
          {SECTION_LABELS[key]}
        </h3>
      )}
      <ul>
        {MENU[key].map((item) => {
          const badge = item.badgeKey ? counts[item.badgeKey] : 0;
          return (
            <li key={item.path} className="mb-0.5 relative">
              <Link
                to={item.path}
                onClick={mobile ? () => setMobileOpen(false) : undefined}
                className={`flex items-center px-2 py-2 rounded transition text-sm ${
                  isActive(item.path)
                    ? "bg-brand-hover text-white"
                    : "text-blue-100 hover:bg-brand-hover hover:text-white"
                }`}
              >
                <i className={`fas ${item.icon} mr-3 w-5 text-center shrink-0 text-sm`}></i>
                {(!collapsed || mobile) && (
                  <>
                    <span className="flex-1">{item.label}</span>
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
  );

  /* ── Sidebar content (shared desktop & mobile) ─────────────── */
  const sidebarContent = (mobile = false) => (
    <>
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-brand-hover">
        <div className="flex items-center">
          <i className="fas fa-umbrella-beach text-2xl mr-3 text-white"></i>
          {(!collapsed || mobile) && <span className="text-lg font-bold text-white">AplayAccess</span>}
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
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Owner navigation">
        {Object.keys(MENU).map(key => renderSection(key, mobile))}
      </nav>

      {/* Portal switcher — Front Desk only */}
      <div className="px-3 pb-2 border-t border-brand-hover pt-3">
        {(!collapsed || mobile) && (
          <p className="uppercase text-[10px] font-semibold text-blue-300 mb-2 px-2 tracking-wider">Switch Portal</p>
        )}
        <button
          onClick={() => switchPortal("/frontdesk", "Switching to Front Desk...")}
          className="flex items-center w-full px-2 py-2 text-blue-100 hover:bg-brand-hover rounded transition"
          title="Switch to Front Desk"
        >
          <i className="fas fa-bell-concierge mr-3 w-5 text-center"></i>
          {(!collapsed || mobile) && <span className="text-sm">Front Desk</span>}
        </button>
      </div>

      {/* User info + logout */}
      <div className="px-3 py-3 border-t border-brand-hover">
        {(!collapsed || mobile) && (
          <div className="mb-2 px-2">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-blue-200 truncate">Owner · {userEmail}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-2 py-2 text-blue-100 hover:bg-brand-hover rounded transition"
        >
          <i className="fas fa-sign-out-alt mr-3 w-5 text-center"></i>
          {(!collapsed || mobile) && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <NotificationContext.Provider value={notifCtx}>
    <Helmet><title>{pageTitle} — AplayAccess</title></Helmet>
    <div className="flex h-screen overflow-hidden">

      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <div className={`hidden md:flex bg-brand text-white ${collapsed ? "w-20" : "w-64"} flex-col transition-[width] duration-300 flex-shrink-0`}>
        {sidebarContent(false)}
      </div>

      {/* ── Mobile Sidebar Overlay ────────────────────────────── */}
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
      <div className="flex-1 overflow-auto flex flex-col bg-slate-50">

        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand/50"
                aria-label="Open menu"
              >
                <i className="fas fa-bars text-xl"></i>
              </button>
              <h1 className="text-xl font-bold text-gray-800">{pageTitle}</h1>
            </div>
            <div className="flex items-center space-x-4">

              <NotificationBell />

              {/* Profile dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand/50"
                >
                  <div className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center text-sm font-semibold">
                    {initials}
                  </div>
                  <span className="hidden md:inline text-sm font-medium">{userName}</span>
                  <i className="fas fa-chevron-down text-xs text-gray-400"></i>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-12 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-3 flex items-center border-b border-gray-100">
                      <div className="h-10 w-10 rounded-full bg-brand text-white flex items-center justify-center text-sm font-semibold mr-3">
                        {initials}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{userName}</p>
                        <p className="text-xs text-gray-500">Owner</p>
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

      {/* ── Account Settings Modal ────────────────────────────── */}
      {settingsOpen && (
        <Modal open onClose={closeSettings} title="Account Settings" maxWidth="max-w-lg">
          <div className="max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                <i className="fas fa-user-cog mr-2 text-brand"></i>Account Settings
              </h3>
              <button onClick={closeSettings} className="text-gray-400 hover:text-gray-600 transition" aria-label="Close">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className="p-6">
              {/* Profile Header */}
              <div className="flex items-center mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="h-14 w-14 rounded-full bg-brand text-white flex items-center justify-center text-lg font-semibold mr-4">
                  {initials}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{userName}</p>
                  <p className="text-sm text-gray-500">Owner</p>
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
                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">Profile Information</h4>
                    {[
                      { label: "Full Name", key: "name", type: "text", icon: "fa-user", auto: "name" },
                      { label: "Email", key: "email", type: "email", icon: "fa-envelope", auto: "email" },
                      { label: "Phone", key: "phone", type: "tel", icon: "fa-phone", auto: "tel" },
                    ].map(f => (
                      <div key={f.key} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                        <div className="relative">
                          <i className={`fas ${f.icon} absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm`}></i>
                          <input
                            type={f.type}
                            value={editProfile[f.key]}
                            onChange={(e) => setEditProfile({ ...editProfile, [f.key]: e.target.value })}
                            autoComplete={f.auto}
                            className="border rounded px-3 py-2 pl-9 w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <div className="relative">
                        <i className="fas fa-shield-alt absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input type="text" value="Owner" readOnly className="border rounded px-3 py-2 pl-9 w-full bg-gray-100 text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/50" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">Change Password</h4>
                    {[
                      { key: "current", label: "Current Password", show: showCurrent, toggle: setShowCurrent, auto: "current-password", icon: "fa-lock" },
                      { key: "new", label: "New Password", show: showNew, toggle: setShowNew, auto: "new-password", icon: "fa-key" },
                      { key: "confirm", label: "Confirm New Password", show: showConfirm, toggle: setShowConfirm, auto: "new-password", icon: "fa-key" },
                    ].map(f => (
                      <div key={f.key} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                        <div className="relative">
                          <i className={`fas ${f.icon} absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm`}></i>
                          <input
                            type={f.show ? "text" : "password"}
                            value={passwordData[f.key]}
                            onChange={(e) => setPasswordData({ ...passwordData, [f.key]: e.target.value })}
                            autoComplete={f.auto}
                            className={`border rounded px-3 py-2 pl-9 pr-10 w-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand ${
                              f.key === "confirm" && pwMismatch ? "border-red-400" : ""
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => f.toggle(!f.show)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            tabIndex={-1}
                          >
                            <i className={`fas ${f.show ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                          </button>
                        </div>
                        {f.key === "new" && pwStrength && (
                          <p className={`text-xs mt-1 ${pwStrength === "strong" ? "text-emerald-600" : "text-amber-600"}`}>
                            <i className={`fas ${pwStrength === "strong" ? "fa-check-circle" : "fa-info-circle"} mr-1`}></i>
                            {pwStrength === "strong" ? "Strong password" : "At least 8 characters recommended"}
                          </p>
                        )}
                        {f.key === "confirm" && pwMismatch && (
                          <p className="text-xs text-red-500 mt-1">
                            <i className="fas fa-exclamation-circle mr-1"></i>Passwords do not match
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-gray-700">Profile Information</h4>
                  <div className="grid grid-cols-1 gap-4 p-4 bg-gray-50 rounded">
                    {[
                      ["fa-user", "Full Name", userName],
                      ["fa-envelope", "Email", userEmail],
                      ["fa-phone", "Phone", user?.phone || "\u2014"],
                      ["fa-shield-alt", "Role", "Owner"],
                    ].map(([icon, label, val]) => (
                      <div key={label} className="flex items-start gap-3">
                        <i className={`fas ${icon} text-gray-400 mt-0.5 w-4 text-center`}></i>
                        <div>
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="font-medium">{val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
    </NotificationContext.Provider>
  );
}
