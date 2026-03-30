import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import PortalTransition from "../PortalTransition.jsx";
import { useStaffNotifications } from "../../hooks/useStaffNotifications.js";
import NotificationContext from "../../context/NotificationContext.jsx";
import NotificationBell from "../ui/NotificationBell.jsx";

const OWNER_PROFILE_KEY = "owner_profile_v1";

const PAGE_TITLES = {
  "/owner":              "Overview",
  "/owner/financials":   "Financial Reports",
  "/owner/transactions": "Transaction Records",
  "/owner/reports":      "Reports",
  "/owner/promo-codes":  "Promo Codes",
};

const MENU = [
  { path: "/owner",              icon: "fa-tachometer-alt",       label: "Overview"            },
  { path: "/owner/financials",   icon: "fa-chart-line",           label: "Financials"          },
  { path: "/owner/transactions", icon: "fa-file-invoice-dollar",  label: "Transaction Records" },
  { path: "/owner/reports",      icon: "fa-file-alt",             label: "Reports"             },
  { path: "/owner/promo-codes",  icon: "fa-tag",                  label: "Promo Codes"         },
];

function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

export default function OwnerShell() {
  const [collapsed,    setCollapsed]    = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);
  const [switching,    setSwitching]    = useState(null);
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuth();
  const profileRef = useRef(null);

  const { counts, items: notifItems, total: notifTotal, refresh: notifRefresh } = useStaffNotifications({
    pendingBookings: '/owner/transactions',
    messages:        '/admin/messages',
    arrivals:        '/frontdesk/reservation',
    rooms:           '/frontdesk/rooms',
  });

  const userName  = user?.name  || "Owner";
  const userEmail = user?.email || "owner@aplayaccess.com";
  const initials  = userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const pageTitle = PAGE_TITLES[location.pathname] ?? "Owner";

  const [profile, setProfile] = useState(() =>
    readLocalJson(OWNER_PROFILE_KEY, { name: userName, email: userEmail, phone: "", role: "Owner" })
  );
  const [editProfile,  setEditProfile]  = useState({ ...profile });
  const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" });

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path) =>
    path === "/owner" ? location.pathname === "/owner" : location.pathname.startsWith(path);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate("/admin/login");
  };

  const openSettings = () => {
    setEditProfile({ ...profile });
    setPasswordData({ current: "", new: "", confirm: "" });
    setIsEditing(false);
    setProfileOpen(false);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    if (passwordData.new && passwordData.new !== passwordData.confirm) {
      alert("New passwords do not match.");
      return;
    }
    setProfile(editProfile);
    localStorage.setItem(OWNER_PROFILE_KEY, JSON.stringify(editProfile));
    setIsEditing(false);
    alert("Profile updated successfully.");
  };

  const switchPortal = (path, label) => {
    setSwitching(label);
    setTimeout(() => navigate(path), 1800);
  };

  if (switching) return <PortalTransition label={switching} />;

  const notifCtx = { counts, items: notifItems, total: notifTotal, refresh: notifRefresh };

  return (
    <NotificationContext.Provider value={notifCtx}>
    <div className="flex h-screen overflow-hidden">

      {/* Sidebar */}
      <div className={`bg-[#1e3a8a] text-white ${collapsed ? "w-20" : "w-64"} flex flex-col transition-all duration-300 flex-shrink-0`}>

        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-[#2e4a9a]">
          <div className="flex items-center">
            <i className="fas fa-umbrella-beach text-2xl mr-3 text-white"></i>
            {!collapsed && <span className="text-xl font-bold text-white">AplayAccess</span>}
          </div>
          <button onClick={() => setCollapsed(!collapsed)}
            className="text-white hover:bg-[#2e4a9a] p-2 rounded focus:outline-none">
            <i className={`fas ${collapsed ? "fa-chevron-right" : "fa-chevron-left"}`}></i>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            {!collapsed && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3 px-2">Owner</h3>}
            <ul>
              {MENU.map(item => (
                <li key={item.path} className="mb-2">
                  <Link to={item.path}
                    className={`flex items-center p-2 rounded transition ${
                      isActive(item.path)
                        ? "bg-[#2e4a9a] text-white"
                        : "text-blue-100 hover:bg-[#2e4a9a] hover:text-white"
                    }`}>
                    <i className={`fas ${item.icon} mr-3 w-5 text-center`}></i>
                    {!collapsed && <span className="text-sm">{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Portal switcher */}
        <div className="px-4 pb-2 border-t border-[#2e4a9a] pt-3">
          {!collapsed && <p className="uppercase text-xs font-semibold text-blue-200 mb-2 px-2">Switch Portal</p>}
          <button onClick={() => switchPortal("/admin", "Switching to Admin Panel...")}
            className="flex items-center w-full p-2 text-blue-100 hover:bg-[#2e4a9a] rounded transition mb-1"
            title="Switch to Admin Panel">
            <i className="fas fa-shield-halved mr-3 w-5 text-center"></i>
            {!collapsed && <span className="text-sm">Admin Panel</span>}
          </button>
          <button onClick={() => switchPortal("/frontdesk", "Switching to Front Desk...")}
            className="flex items-center w-full p-2 text-blue-100 hover:bg-[#2e4a9a] rounded transition"
            title="Switch to Front Desk">
            <i className="fas fa-bell-concierge mr-3 w-5 text-center"></i>
            {!collapsed && <span className="text-sm">Front Desk</span>}
          </button>
        </div>

        {/* User info + logout */}
        <div className="p-4 border-t border-[#2e4a9a]">
          {!collapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-blue-200 truncate">Owner · {userEmail}</p>
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center w-full p-2 text-blue-100 hover:bg-[#2e4a9a] rounded transition">
            <i className="fas fa-sign-out-alt mr-3 w-5 text-center"></i>
            {!collapsed && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto flex flex-col">

        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-20">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-2xl font-bold text-gray-800">{pageTitle}</h1>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <div className="relative" ref={profileRef}>
                <button onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 focus:outline-none">
                  <div className="h-8 w-8 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-sm font-semibold">
                    {initials}
                  </div>
                  <span className="hidden md:inline text-sm font-medium">{userName}</span>
                  <i className="fas fa-chevron-down text-xs text-gray-400"></i>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-12 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-3 flex items-center border-b border-gray-100">
                      <div className="h-10 w-10 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-sm font-semibold mr-3">
                        {initials}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{userName}</p>
                        <p className="text-xs text-gray-500">Owner</p>
                      </div>
                    </div>
                    <button onClick={openSettings}
                      className="p-3 flex items-center w-full text-left hover:bg-gray-50 border-b border-gray-100">
                      <i className="fas fa-user-cog mr-3 text-gray-500"></i>
                      <span className="text-sm text-gray-700">Account Settings</span>
                    </button>
                    <button onClick={handleLogout}
                      className="p-3 flex items-center w-full text-left hover:bg-gray-50 text-red-500">
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
        <div className="flex-1">
          <Outlet />
        </div>
      </div>

      {/* Account Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Account Settings</h3>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="h-14 w-14 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-lg font-semibold mr-4">
                  {initials}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{profile.name}</p>
                  <p className="text-sm text-gray-500">Owner</p>
                  <p className="text-xs text-gray-400">{profile.email}</p>
                </div>
                {!isEditing && (
                  <button onClick={() => { setEditProfile({ ...profile }); setIsEditing(true); }}
                    className="px-4 py-2 bg-[#1e3a8a] text-white rounded text-sm hover:bg-[#152c6e]">
                    <i className="fas fa-edit mr-2"></i>Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input type="text" value={editProfile.name}
                      onChange={e => setEditProfile(p => ({ ...p, name: e.target.value }))}
                      className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={editProfile.email}
                      onChange={e => setEditProfile(p => ({ ...p, email: e.target.value }))}
                      className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" value={editProfile.phone}
                      onChange={e => setEditProfile(p => ({ ...p, phone: e.target.value }))}
                      className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]" />
                  </div>
                  <div className="pt-2">
                    <h4 className="font-medium mb-3 text-gray-700">Change Password</h4>
                    {["current", "new", "confirm"].map(f => (
                      <div key={f} className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{f === "confirm" ? "Confirm New Password" : `${f.charAt(0).toUpperCase() + f.slice(1)} Password`}</label>
                        <input type="password" value={passwordData[f]}
                          onChange={e => setPasswordData(p => ({ ...p, [f]: e.target.value }))}
                          className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded text-sm">
                  <div className="col-span-2"><p className="text-xs text-gray-500">Full Name</p><p className="font-medium">{profile.name}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Email</p><p className="font-medium">{profile.email}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Phone</p><p className="font-medium">{profile.phone || "—"}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Role</p><p className="font-medium">Owner</p></div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-5">
                {isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                    <button onClick={saveSettings}
                      className="px-4 py-2 rounded text-sm font-medium text-white bg-[#1e3a8a] hover:bg-[#152c6e]">Save Changes</button>
                  </>
                ) : (
                  <button onClick={() => setSettingsOpen(false)}
                    className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Close</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </NotificationContext.Provider>
  );
}
