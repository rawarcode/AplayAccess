import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import PortalTransition from '../../../components/PortalTransition.jsx';
import { useStaffNotifications } from '../../../hooks/useStaffNotifications.js';
import NotificationContext from '../../../context/NotificationContext.jsx';

export default function Sidebar({ children }) {
  const [collapsed,  setCollapsed]  = useState(false);
  const [switching,  setSwitching]  = useState(null);
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  const userName  = user?.name  || 'Staff Member';
  const userEmail = user?.email || 'staff@aplayaccess.com';

  const { counts, items: notifItems, total: notifTotal, refresh: notifRefresh } = useStaffNotifications();

  const menuItems = {
    frontDesk: [
      { path: '/frontdesk',             icon: 'fa-tachometer-alt',   label: 'Dashboard'     },
      { path: '/frontdesk/reservation', icon: 'fa-calendar-check',   label: 'Reservations',  badgeKey: 'pendingBookings' },
      { path: '/frontdesk/billing',     icon: 'fa-receipt',          label: 'Billing'       },
      { path: '/frontdesk/walkin',      icon: 'fa-person-walking',   label: 'Walk-ins'      },
      { path: '/frontdesk/records',     icon: 'fa-address-book',     label: 'Guest Records' },
      { path: '/frontdesk/rooms',       icon: 'fa-door-open',        label: 'Rooms',         badgeKey: 'dirtyRooms'      },
      { path: '/frontdesk/messages',    icon: 'fa-envelope',         label: 'Messages',      badgeKey: 'unreadMessages'  },
    ],
    management: [
      { path: '/frontdesk/reports', icon: 'fa-chart-bar', label: 'Reports' },
    ],
  };

  const isActive = (path) =>
    path === '/frontdesk'
      ? location.pathname === '/frontdesk'
      : location.pathname.startsWith(path);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
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
      <div className={`bg-[#1e3a8a] text-white ${collapsed ? 'w-20' : 'w-64'} flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-[#2e4a9a]">
          <div className="flex items-center min-w-0">
            <i className="fas fa-umbrella-beach text-2xl mr-3 text-white shrink-0"></i>
            {!collapsed && <span className="text-xl font-bold text-white truncate">AplayAccess</span>}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white hover:bg-[#2e4a9a] p-2 rounded focus:outline-none shrink-0"
          >
            <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {/* Front Desk */}
          <div className="mb-6">
            {!collapsed && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3 px-2">Front Desk</h3>}
            <ul>
              {menuItems.frontDesk.map((item) => {
                const badge = item.badgeKey ? counts[item.badgeKey] : 0;
                return (
                  <li key={item.path} className="mb-2 relative">
                    <Link
                      to={item.path}
                      className={`flex items-center p-2 rounded transition ${
                        isActive(item.path)
                          ? 'bg-[#2e4a9a] text-white'
                          : 'text-blue-100 hover:bg-[#2e4a9a] hover:text-white'
                      }`}
                    >
                      <i className={`fas ${item.icon} mr-3 w-5 text-center shrink-0`}></i>
                      {!collapsed && (
                        <>
                          <span className="text-sm flex-1">{item.label}</span>
                          {badge > 0 && (
                            <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white
                              text-[10px] font-bold flex items-center justify-center px-1 leading-none shrink-0">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && badge > 0 && (
                        <span className="absolute right-1 top-0.5 w-2.5 h-2.5 rounded-full bg-red-500 pointer-events-none"></span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Management */}
          <div className="mb-6">
            {!collapsed && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3 px-2">Management</h3>}
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
                    {!collapsed && <span className="text-sm">{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Inline alerts strip */}
        {!collapsed && notifItems.length > 0 && (
          <div className="mx-3 mb-3 rounded-lg bg-[#152c6e] border border-blue-400/20 p-3">
            <p className="text-[10px] text-blue-200 uppercase font-semibold mb-2 tracking-wide">
              <i className="fas fa-bell mr-1.5"></i>Active Alerts
            </p>
            <div className="space-y-2">
              {notifItems.map(n => (
                <Link
                  key={n.id}
                  to={n.path}
                  className="flex items-center gap-2 text-xs text-blue-100 hover:text-white transition-colors"
                >
                  <i className={`fas ${n.icon} w-3.5 text-center shrink-0`}></i>
                  <span className="truncate">{n.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Portal switcher — admin/owner only */}
        {(user?.role === 'admin' || user?.role === 'owner') && (
          <div className="px-4 pb-2 border-t border-[#2e4a9a] pt-3">
            {!collapsed && <p className="uppercase text-xs font-semibold text-blue-200 mb-2 px-2">Switch Portal</p>}
            <button
              onClick={() => switchPortal('/admin', 'Switching to Admin Panel...')}
              className="flex items-center w-full p-2 text-blue-100 hover:bg-[#2e4a9a] rounded transition mb-1"
              title="Switch to Admin Panel"
            >
              <i className="fas fa-shield-halved mr-3 w-5 text-center"></i>
              {!collapsed && <span className="text-sm">Admin Panel</span>}
            </button>
            {user?.role === 'owner' && (
              <button
                onClick={() => switchPortal('/owner', 'Switching to Owner Panel...')}
                className="flex items-center w-full p-2 text-blue-100 hover:bg-[#2e4a9a] rounded transition"
                title="Switch to Owner Panel"
              >
                <i className="fas fa-crown mr-3 w-5 text-center"></i>
                {!collapsed && <span className="text-sm">Owner Panel</span>}
              </button>
            )}
          </div>
        )}

        {/* User info + logout */}
        <div className="p-4 border-t border-[#2e4a9a]">
          {!collapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-blue-200 truncate">{userEmail}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center w-full p-2 text-blue-100 hover:bg-[#2e4a9a] rounded transition"
          >
            <i className="fas fa-sign-out-alt mr-3 w-5 text-center"></i>
            {!collapsed && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
    </NotificationContext.Provider>
  );
}
