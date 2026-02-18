// src/components/dashboard/DashboardShell.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

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

export default function DashboardShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout?.(); // if your AuthContext has logout()
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
          <div className="flex items-center gap-4">
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
              <li>
                <NavItem to="/dashboard">Dashboard</NavItem>
              </li>
              <li>
                <NavItem to="/dashboard/bookings">My Bookings</NavItem>
              </li>
              <li>
                <NavItem to="/dashboard/profile">Edit Profile</NavItem>
              </li>
              <li>
                <NavItem to="/dashboard/messages">Messages</NavItem>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main */}
        <main className="min-h-[60vh]">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-4 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          © 2023 Aplaya Beach Resort. All rights reserved.
        </div>
      </footer>
    </div>
  );
}