import React, { useState } from 'react';
import { notifications } from '../../data/dashboardData';

const Header = ({ pageTitle, onAccountSettings }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">{pageTitle}</h1>

        <div className="header-actions">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search..."
              className="search-input"
            />
            <i className="fas fa-search search-icon"></i>
          </div>

          <div className="notification-container">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="notification-btn"
            >
              <i className="fas fa-bell notification-icon"></i>
              <span className="notification-badge">
                {notifications.length}
              </span>
            </button>

            {showNotifications && (
              <div className="notification-dropdown active">
                <div className="notification-dropdown-header">
                  <h3 className="notification-dropdown-title">Notifications</h3>
                </div>
                <ul className="notification-list">
                  {notifications.map((notif) => (
                    <li key={notif.id} className="notification-item">
                      <div className="notification-item-content">
                        <div className="notification-dot"></div>
                        <div>
                          <p>{notif.message}</p>
                          <p className="notification-time">{notif.time}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="notification-dropdown-footer">
                  <a href="#" className="notification-view-all">View all notifications</a>
                </div>
              </div>
            )}
          </div>

          <div className="user-menu-container">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="user-menu-btn"
            >
              <img
                src="https://randomuser.me/api/portraits/women/44.jpg"
                alt="User"
                className="user-menu-avatar"
              />
              <span className="user-menu-name">Sarah Johnson</span>
              <i className="fas fa-chevron-down user-menu-chevron"></i>
            </button>

            {showUserMenu && (
              <div className="user-menu-dropdown">
                <div className="user-menu-header">
                  <p className="user-menu-header-label">Signed in as</p>
                  <p className="user-menu-header-email">sarah@aplaya-resort.com</p>
                </div>
                <button
                  onClick={onAccountSettings}
                  className="user-menu-item"
                >
                  <i className="fas fa-user-cog"></i> Account Settings
                </button>
                <div className="user-menu-divider"></div>
                <a href="#" className="user-menu-item logout">
                  <i className="fas fa-sign-out-alt"></i> Log Out
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
