import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ collapsed, onToggle }) => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <i className="fas fa-umbrella-beach sidebar-logo-icon"></i>
          <span className="logo-text sidebar-logo-text">Aplaya Beach Resort</span>
        </div>
        <button onClick={onToggle} className="sidebar-toggle">
          <i className="fas fa-bars"></i>
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-content">
          <div className="sidebar-section">
            <h3 className="sidebar-text sidebar-section-title">Owner Dashboard</h3>
            <ul className="sidebar-menu">
              <li className="sidebar-menu-item">
                <Link
                  to="/owner"
                  className={`sidebar-link ${isActive('/owner') ? 'active' : ''}`}
                >
                  <i className="fas fa-tachometer-alt sidebar-link-icon"></i>
                  <span className="sidebar-text">Overview</span>
                </Link>
              </li>
              <li className="sidebar-menu-item">
                <Link
                  to="/owner/financials"
                  className={`sidebar-link ${isActive('/owner/financials') ? 'active' : ''}`}
                >
                  <i className="fas fa-chart-pie sidebar-link-icon"></i>
                  <span className="sidebar-text">Financials</span>
                </Link>
              </li>
              <li className="sidebar-menu-item">
                <Link
                  to="/owner/transactions"
                  className={`sidebar-link ${isActive('/owner/transactions') ? 'active' : ''}`}
                >
                  <i className="fas fa-file-invoice-dollar sidebar-link-icon"></i>
                  <span className="sidebar-text">Transaction Records</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-text sidebar-section-title">Switch Interface</h3>
            <ul className="sidebar-menu">
              <li className="sidebar-menu-item">
                <a href="#" className="sidebar-link">
                  <i className="fas fa-user-shield sidebar-link-icon"></i>
                  <span className="sidebar-text">Admin Interface</span>
                </a>
              </li>
              <li className="sidebar-menu-item">
                <a href="#" className="sidebar-link">
                  <i className="fas fa-desktop sidebar-link-icon"></i>
                  <span className="sidebar-text">Front-Desk Interface</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <img
            src="https://randomuser.me/api/portraits/women/44.jpg"
            alt="User"
            className="sidebar-user-avatar"
          />
          <div className="sidebar-text">
            <p className="sidebar-user-name">Sarah Johnson</p>
            <p className="sidebar-user-role">Resort Owner</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
