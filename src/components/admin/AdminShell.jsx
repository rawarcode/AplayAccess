import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

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
    { path: "/admin",              icon: "fa-tachometer-alt",   label: "Dashboard"       },
    { path: "/admin/users",        icon: "fa-users",            label: "Manage Users"    },
    { path: "/admin/rooms",        icon: "fa-bed",              label: "Manage Rooms"    },
    { path: "/admin/guests",       icon: "fa-user-check",       label: "Guests"          },
    { path: "/admin/transactions", icon: "fa-money-bill-wave",  label: "Transactions"    },
    { path: "/admin/history",      icon: "fa-history",          label: "History"         },
    { path: "/admin/reviews",      icon: "fa-star",             label: "Reviews"         },
  ],
  manage: [
    { path: "/admin/foods",        icon: "fa-utensils",         label: "Foods"           },
    { path: "/admin/services",     icon: "fa-concierge-bell",   label: "Other Services"  },
    { path: "/admin/inventory",    icon: "fa-boxes",            label: "Inventory"       },
    { path: "/admin/content",      icon: "fa-globe",            label: "Manage Website"  },
  ],
};

export default function AdminShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  const userName   = user?.name  || "Admin";
  const userEmail  = user?.email || "admin@aplayaccess.com";
  const userRole   = user?.role  === "owner" ? "Owner" : "Administrator";
  const initials   = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const pageTitle  = PAGE_TITLES[location.pathname] ?? "Admin";

  const isActive = (path) =>
    path === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(path);

  const handleLogout = async () => {
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
          {/* Main */}
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

          {/* Management */}
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

              {/* Avatar + name */}
              <div className="flex items-center gap-2 text-gray-700">
                <div className="h-8 w-8 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
                <span className="hidden md:inline text-sm font-medium">{userName}</span>
                <i className="fas fa-chevron-down text-xs text-gray-400"></i>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
