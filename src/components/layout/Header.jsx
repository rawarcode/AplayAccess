import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notifications } from '../../data/dashboardData';

const Header = ({ pageTitle, onAccountSettings }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const displayName = user?.name || 'User';
  const displayEmail = user?.email || '';
  const avatarUrl = user?.avatar || null;

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
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="user-menu-avatar"
                />
              ) : (
                <div
                  className="user-menu-avatar"
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem',
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="user-menu-name">{displayName}</span>
              <i className="fas fa-chevron-down user-menu-chevron"></i>
            </button>

            {showUserMenu && (
              <div className="user-menu-dropdown">
                <div className="user-menu-header">
                  <p className="user-menu-header-label">Signed in as</p>
                  <p className="user-menu-header-email">{displayEmail}</p>
                </div>
                <button
                  onClick={onAccountSettings}
                  className="user-menu-item"
                >
                  <i className="fas fa-user-cog"></i> Account Settings
                </button>
                <div className="user-menu-divider"></div>
                <button onClick={handleLogout} className="user-menu-item logout">
                  <i className="fas fa-sign-out-alt"></i> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
