import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const ADMIN_PROFILE_KEY = "admin_profile_v1";

const PAGE_TITLES = {
  "/admin":              "Dashboard",
  "/admin/users":        "Manage Users",
  "/admin/rooms":        "Manage Rooms",
  "/admin/guests":       "Guests",
  "/admin/transactions": "Transactions",
  "/admin/history":      "History",
  "/admin/reviews":      "Reviews",
  "/admin/foods":        "Manage Foods",
  "/admin/services":     "Other Services",
  "/admin/inventory":    "Inventory",
  "/admin/content":      "Manage Website",
};

const MENU = {
  main: [
    { path: "/admin",              icon: "fa-tachometer-alt",  label: "Dashboard"      },
    { path: "/admin/users",        icon: "fa-users",           label: "Manage Users"   },
    { path: "/admin/rooms",        icon: "fa-bed",             label: "Manage Rooms"   },
    { path: "/admin/guests",       icon: "fa-user-check",      label: "Guests"         },
    { path: "/admin/transactions", icon: "fa-money-bill-wave", label: "Transactions"   },
    { path: "/admin/history",      icon: "fa-history",         label: "History"        },
    { path: "/admin/reviews",      icon: "fa-star",            label: "Reviews"        },
  ],
  manage: [
    { path: "/admin/foods",     icon: "fa-utensils",       label: "Foods"          },
    { path: "/admin/services",  icon: "fa-concierge-bell", label: "Other Services" },
    { path: "/admin/inventory", icon: "fa-boxes",          label: "Inventory"      },
    { path: "/admin/content",   icon: "fa-globe",          label: "Manage Website" },
  ],
};

function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export default function AdminShell() {
  const [collapsed,    setCollapsed]    = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);
  const location   = useLocation();
  const navigate   = useNavigate();
  const { user, logout } = useAuth();
  const profileRef = useRef(null);

  const userName  = user?.name  || "Admin";
  const userEmail = user?.email || "admin@aplayaccess.com";
  const userRole  = user?.role  === "owner" ? "Owner" : "Administrator";
  const initials  = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const pageTitle = PAGE_TITLES[location.pathname] ?? "Admin";

  const [profile, setProfile] = useState(() =>
    readLocalJson(ADMIN_PROFILE_KEY, {
      name:  userName,
      email: userEmail,
      phone: "",
      role:  userRole,
    })
  );
  const [editProfile,   setEditProfile]   = useState({ ...profile });
  const [passwordData,  setPasswordData]  = useState({ current: "", new: "", confirm: "" });

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
    const updated = { ...editProfile };
    setProfile(updated);
    localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(updated));
    setIsEditing(false);
    alert("Profile updated successfully.");
  };

  const isActive = (path) =>
    path === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(path);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate("/admin/login");
  };

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Sidebar */}
      <div className={`bg-[#1e3a8a] text-white ${collapsed ? "w-20" : "w-64"} flex flex-col transition-all duration-300 flex-shrink-0`}>

        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-[#2e4a9a]">
          <div className="flex items-center">
            <i className="fas fa-umbrella-beach text-2xl mr-3 text-white"></i>
            {!collapsed && <span className="text-xl font-bold text-white">AplayAccess</span>}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white hover:bg-[#2e4a9a] p-2 rounded focus:outline-none"
          >
            <i className={`fas ${collapsed ? "fa-chevron-right" : "fa-chevron-left"}`}></i>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            {!collapsed && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3">Admin</h3>}
            <ul>
              {MENU.main.map((item) => (
                <li key={item.path} className="mb-2">
                  <Link
                    to={item.path}
                    className={`flex items-center p-2 rounded transition ${
                      isActive(item.path)
                        ? "bg-[#2e4a9a] text-white"
                        : "text-blue-100 hover:bg-[#2e4a9a] hover:text-white"
                    }`}
                  >
                    <i className={`fas ${item.icon} mr-3 w-5 text-center`}></i>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-6">
            {!collapsed && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3">Management</h3>}
            <ul>
              {MENU.manage.map((item) => (
                <li key={item.path} className="mb-2">
                  <Link
                    to={item.path}
                    className={`flex items-center p-2 rounded transition ${
                      isActive(item.path)
                        ? "bg-[#2e4a9a] text-white"
                        : "text-blue-100 hover:bg-[#2e4a9a] hover:text-white"
                    }`}
                  >
                    <i className={`fas ${item.icon} mr-3 w-5 text-center`}></i>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Portal switcher — admin/owner can access frontdesk */}
        <div className="px-4 pb-2 border-t border-[#2e4a9a] pt-3">
          {!collapsed && <p className="uppercase text-xs font-semibold text-blue-200 mb-2">Switch Portal</p>}
          <Link
            to="/frontdesk"
            className="flex items-center w-full p-2 text-blue-100 hover:bg-[#2e4a9a] rounded transition"
            title="Switch to Front Desk"
          >
            <i className="fas fa-bell-concierge mr-3 w-5 text-center"></i>
            {!collapsed && <span>Front Desk</span>}
          </Link>
        </div>

        {/* User info + logout */}
        <div className="p-4 border-t border-[#2e4a9a]">
          {!collapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-blue-200 truncate">{userRole} · {userEmail}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center w-full p-2 text-blue-100 hover:bg-[#2e4a9a] rounded transition"
          >
            <i className="fas fa-sign-out-alt mr-3 w-5 text-center"></i>
            {!collapsed && <span>Logout</span>}
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

              {/* Bell */}
              <button className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none">
                <i className="fas fa-bell text-xl"></i>
              </button>

              {/* Profile dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 focus:outline-none"
                >
                  <div className="h-8 w-8 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-sm font-semibold">
                    {initials}
                  </div>
                  <span className="hidden md:inline text-sm font-medium">{userName}</span>
                  <i className="fas fa-chevron-down text-xs text-gray-400"></i>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-12 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    {/* Profile info */}
                    <div className="p-3 flex items-center border-b border-gray-100">
                      <div className="h-10 w-10 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-sm font-semibold mr-3">
                        {initials}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{userName}</p>
                        <p className="text-xs text-gray-500">{userRole}</p>
                      </div>
                    </div>

                    {/* Account Settings */}
                    <button
                      onClick={openSettings}
                      className="p-3 flex items-center w-full text-left hover:bg-gray-50 border-b border-gray-100"
                    >
                      <i className="fas fa-user-cog mr-3 text-gray-500"></i>
                      <span className="text-sm text-gray-700">Account Settings</span>
                    </button>

                    {/* Logout */}
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
              {/* Profile Header */}
              <div className="flex items-center mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="h-14 w-14 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-lg font-semibold mr-4">
                  {initials}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{profile.name}</p>
                  <p className="text-sm text-gray-500">{profile.role}</p>
                  <p className="text-xs text-gray-400">{profile.email}</p>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => { setEditProfile({ ...profile }); setIsEditing(true); }}
                    className="px-4 py-2 bg-[#1e3a8a] text-white rounded text-sm hover:bg-[#152c6e]"
                  >
                    <i className="fas fa-edit mr-2"></i>Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <>
                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">Profile Information</h4>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editProfile.name}
                        onChange={(e) => setEditProfile({ ...editProfile, name: e.target.value })}
                        className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editProfile.email}
                        onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
                        className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editProfile.phone}
                        onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
                        className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <input
                        type="text"
                        value={editProfile.role}
                        readOnly
                        className="border rounded px-3 py-2 w-full bg-gray-100 text-gray-500"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">Change Password</h4>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                      <input
                        type="password"
                        value={passwordData.current}
                        onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                        className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={passwordData.new}
                        onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                        className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordData.confirm}
                        onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                        className="border rounded px-3 py-2 w-full focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">Profile Information</h4>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Full Name</p>
                        <p className="font-medium">{profile.name}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="font-medium">{profile.email}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="font-medium">{profile.phone || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Role</p>
                        <p className="font-medium">{profile.role}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSettings}
                      className="px-4 py-2 rounded text-sm font-medium text-white bg-[#1e3a8a] hover:bg-[#152c6e]"
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
