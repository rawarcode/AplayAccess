import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === "/admin"}
      className={({ isActive }) =>
        `flex items-center p-3 rounded-lg transition ${
          isActive
            ? "bg-blue-600 text-white font-medium"
            : "text-white hover:bg-blue-700"
        }`
      }
    >
      <i className={`fas ${icon} w-6`}></i>
      <span className="ml-3">{label}</span>
    </NavLink>
  );
}

export default function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function handleLogout() {
    logout?.();
    // after logout send user to main site; auto-login will bring admin back if desired
    navigate("/");
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-blue-800 text-white h-screen fixed top-0 left-0 shadow-lg transition-all duration-300 ${
          sidebarCollapsed ? "w-20" : "w-64"
        } overflow-y-auto`}
      >
        {/* Logo & Toggle */}
        <div className="p-4 flex items-center justify-between border-b border-blue-700">
          <div className="flex items-center">
            <i className="fas fa-umbrella-beach text-2xl"></i>
            {!sidebarCollapsed && <span className="ml-3 font-bold text-xl">AplayAccess</span>}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-white hover:text-blue-200"
          >
            <i className="fas fa-bars"></i>
          </button>
        </div>

        {/* Admin Profile */}
        <div className="p-4">
          <div className="flex items-center mb-8">
            <img
              alt="Admin"
              className="w-10 h-10 rounded-full mr-3"
              src="https://randomuser.me/api/portraits/women/44.jpg"
            />
            {!sidebarCollapsed && (
              <div>
                <div className="font-semibold">Sarah Johnson</div>
                <div className="text-xs text-blue-200">Resort Owner</div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            <NavItem to="/admin" icon="fa-tachometer-alt" label="Dashboard" />
            <NavItem to="/admin/users" icon="fa-users" label="Manage Users" />
            <NavItem to="/admin/rooms" icon="fa-bed" label="Manage Rooms" />
            <NavItem to="/admin/foods" icon="fa-utensils" label="Manage Foods" />
            <NavItem to="/admin/services" icon="fa-concierge-bell" label="Other Services" />
            <NavItem to="/admin/inventory" icon="fa-boxes" label="Inventory" />
            <NavItem to="/admin/transactions" icon="fa-money-bill-wave" label="Transactions" />
            <NavItem to="/admin/history" icon="fa-history" label="History" />
            <NavItem to="/admin/content" icon="fa-globe" label="Manage Website" />
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="absolute bottom-0 w-full p-4 border-t border-blue-700 space-y-2">
          <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-700 transition text-left">
            <i className="fas fa-user-cog w-6"></i>
            {!sidebarCollapsed && <span className="ml-3">Profile Settings</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center p-3 rounded-lg hover:bg-blue-700 transition text-left"
          >
            <i className="fas fa-sign-out-alt w-6"></i>
            {!sidebarCollapsed && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-20" : "ml-64"}`}>
        {/* Top Header */}
        <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-20">
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-gray-600 hover:text-gray-800">
              <i className="fas fa-bell"></i>
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500"></span>
            </button>
            <div className="flex items-center space-x-2">
              <img
                alt="Admin"
                className="w-10 h-10 rounded-full"
                src="https://randomuser.me/api/portraits/women/44.jpg"
              />
              <span className="hidden md:inline text-gray-700">{user?.name || "Admin"}</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
