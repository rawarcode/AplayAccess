// components/Layout/Sidebar.jsx
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const menuItems = {
    frontDesk: [
      { path: '/dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
      { path: '/reservation', icon: 'fa-search', label: 'Reservations' },
      { path: '/billing', icon: 'fa-receipt', label: 'Billing' },
      { path: '/walkin', icon: 'fa-walking', label: 'Walk-ins' },
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className={`sidebar bg-blue-900 text-white ${collapsed ? 'w-70' : 'w-64'} flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-blue-800">
          <div className="flex items-center">
            <i className="fas fa-umbrella-beach text-2xl mr-3"></i>
            {!collapsed && <span className="logo-text text-xl font-bold">AplayAccess</span>}
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="text-white focus:outline-none">
            <i className="fas fa-bars"></i>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* Front Desk */}
            <div className="mb-6">
              {!collapsed && <h3 className="sidebar-text uppercase text-xs font-semibold text-blue-300 mb-3">Front Desk</h3>}
              <ul>
                {menuItems.frontDesk.map((item) => (
                  <li key={item.path} className={`mb-2 ${isActive(item.path) ? 'bg-blue-800' : ''}`}>
                    <Link to={item.path} className="flex items-center p-2 rounded hover:bg-blue-800 transition">
                      <i className={`fas ${item.icon} mr-3`}></i>
                      {!collapsed && <span className="sidebar-text">{item.label}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Management */}
            <div className="mb-6">
              {!collapsed && <h3 className="sidebar-text uppercase text-xs font-semibold text-blue-300 mb-3">Management</h3>}
              <ul>
                {menuItems.management.map((item) => (
                  <li key={item.path} className={`mb-2 ${isActive(item.path) ? 'bg-blue-800' : ''}`}>
                    <Link to={item.path} className="flex items-center p-2 rounded hover:bg-blue-800 transition">
                      <i className={`fas ${item.icon} mr-3`}></i>
                      {!collapsed && <span className="sidebar-text">{item.label}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Switch Interface */}
            <div className="mb-6">
              {!collapsed && <h3 className="sidebar-text uppercase text-xs font-semibold text-blue-300 mb-3">SWITCH INTERFACE</h3>}
              <ul>
                {menuItems.switchInterface.map((item) => (
                  <li key={item.path} className="mb-2">
                    <a href={item.path} className="flex items-center p-2 rounded hover:bg-blue-800 transition">
                      <i className={`fas ${item.icon} mr-3`}></i>
                      {!collapsed && <span className="sidebar-text">{item.label}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-blue-800">
          <div className="flex items-center">
            <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="User" className="h-8 w-8 rounded-full mr-3" />
            {!collapsed && (
              <div className="sidebar-text">
                <p className="font-medium">Sarah Johnson</p>
                <p className="text-xs text-blue-300">Resort Owner</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`main-content flex-1 overflow-auto transition-all duration-300 ${collapsed ? 'ml-70' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default Sidebar;