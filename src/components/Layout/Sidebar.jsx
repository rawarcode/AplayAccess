import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from '../../utils/appData';

const Sidebar = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const session = getSession();
  const userName = session?.name || 'Staff Member';
  const userEmail = session?.email || 'staff@aplayaccess.com';

  const menuItems = {
    frontDesk: [
      { path: '/dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
      { path: '/reservation', icon: 'fa-calendar-check', label: 'Reservations' },
      { path: '/billing', icon: 'fa-receipt', label: 'Billing' },
      { path: '/walkin', icon: 'fa-person-walking', label: 'Walk-ins' },
      { path: '/records', icon: 'fa-address-book', label: 'Guest Records' },
    ],
    management: [
      { path: '/reports', icon: 'fa-chart-bar', label: 'Reports' },
    ],
    switchInterface: [
      { path: '/admin', icon: 'fa-user-shield', label: 'Admin Interface' },
      { path: '/owner', icon: 'fa-desktop', label: 'Owner Interface' },
    ]
  };

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className={`bg-[#1e3a8a] text-white ${collapsed ? 'w-20' : 'w-64'} flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-[#2e4a9a]">
          <div className="flex items-center">
            <i className="fas fa-umbrella-beach text-2xl mr-3 text-white"></i>
            {!collapsed && <span className="logo-text text-xl font-bold text-white">AplayAccess</span>}
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="text-white focus:outline-none hover:bg-[#2e4a9a] p-2 rounded">
            <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* Front Desk */}
            <div className="mb-6">
              {!collapsed && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3">Front Desk</h3>}
              <ul>
                {menuItems.frontDesk.map((item) => (
                  <li key={item.path} className="mb-2">
                    <Link 
                      to={item.path} 
                      className={`flex items-center p-2 rounded transition ${
                        isActive(item.path) 
                          ? 'bg-[#2e4a9a] text-white' 
                          : 'text-blue-100 hover:bg-[#2e4a9a] hover:text-white'
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
                {menuItems.management.map((item) => (
                  <li key={item.path} className="mb-2">
                    <Link 
                      to={item.path} 
                      className={`flex items-center p-2 rounded transition ${
                        isActive(item.path) 
                          ? 'bg-[#2e4a9a] text-white' 
                          : 'text-blue-100 hover:bg-[#2e4a9a] hover:text-white'
                      }`}
                    >
                      <i className={`fas ${item.icon} mr-3 w-5 text-center`}></i>
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Switch Interface */}
            <div className="mb-6">
              {!collapsed && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3">Switch Interface</h3>}
              <ul>
                {menuItems.switchInterface.map((item) => (
                  <li key={item.path} className="mb-2">
                    <Link 
                      to={item.path} 
                      className={`flex items-center p-2 rounded transition ${
                        isActive(item.path) 
                          ? 'bg-[#2e4a9a] text-white' 
                          : 'text-blue-100 hover:bg-[#2e4a9a] hover:text-white'
                      }`}
                    >
                      <i className={`fas ${item.icon} mr-3 w-5 text-center`}></i>
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-[#2e4a9a]">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-blue-300 flex items-center justify-center text-[#1e3a8a] font-bold mr-3">
              {userName.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1">
                <p className="font-medium text-white truncate">{userName}</p>
                <p className="text-xs text-blue-200 truncate">{userEmail}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button 
              onClick={handleLogout}
              className="mt-3 w-full p-2 text-sm text-blue-200 hover:text-white hover:bg-[#2e4a9a] rounded transition flex items-center justify-center gap-2"
            >
              <i className="fas fa-sign-out-alt"></i>
              Sign Out
            </button>
          )}
          {collapsed && (
            <button 
              onClick={handleLogout}
              className="mt-3 w-full p-2 text-blue-200 hover:text-white hover:bg-[#2e4a9a] rounded transition flex items-center justify-center"
              title="Sign Out"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {children}
      </div>
    </div>
  );
};

export default Sidebar;