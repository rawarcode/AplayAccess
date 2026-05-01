import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import PortalTransition from '../../../components/PortalTransition.jsx';
import { useStaffNotifications } from '../../../hooks/useStaffNotifications.js';
import NotificationContext from '../../../context/NotificationContext.jsx';
import NotificationBell from '../../../components/ui/NotificationBell.jsx';
import Avatar from '../../../components/ui/Avatar.jsx';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';
import useFocusTrap from '../../../hooks/useFocusTrap.js';
import StaffChatWidget from '../../../components/StaffChatWidget.jsx';

const PAGE_TITLES = {
  '/frontdesk':             'Dashboard',
  '/frontdesk/bookings':    'Bookings',
  '/frontdesk/reservation': 'Bookings', // legacy alias
  '/frontdesk/billing':     'Billing',
  '/frontdesk/walkin':      'New Walk-in',
  '/frontdesk/records':     'Guest Records',
  '/frontdesk/rooms':       'Rooms',
  '/frontdesk/messages':    'Messages',
  '/frontdesk/reports':     'Reports',
};

export default function Sidebar({ children, showTopBar = true }) {
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [switching,    setSwitching]    = useState(null);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const profileRef = useRef(null);
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  const userName  = user?.name  || 'Staff Member';
  const userEmail = user?.email || 'staff@aplayaccess.com';
  const initials  = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  useLockBodyScroll(mobileOpen);

  // Focus trap for the mobile drawer — Tab cycles inside while open,
  // restores focus to the trigger on close. Without this, keyboard
  // users could leak Tab back to the page underneath the open drawer.
  const mobileDrawerRef = useFocusTrap(mobileOpen);

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Escape key closes mobile sidebar OR profile dropdown.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (profileOpen) { setProfileOpen(false); return; }
      if (mobileOpen)  { setMobileOpen(false); return; }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, profileOpen]);

  const { counts, items: notifItems, total: notifTotal, refresh: notifRefresh } = useStaffNotifications({
    messages:           '/frontdesk/messages',
    arrivals:           '/frontdesk/bookings?status=Confirmed',
    soonCheckouts:      '/frontdesk/bookings?status=Checked+In',
    overdueCheckouts:   '/frontdesk/bookings?status=Checked+In',
  });

  const menuItems = {
    frontDesk: [
      { path: '/frontdesk',             icon: 'fa-tachometer-alt',   label: 'Dashboard'     },
      { path: '/frontdesk/bookings',    icon: 'fa-calendar-check',   label: 'Bookings'      },
      { path: '/frontdesk/billing',     icon: 'fa-receipt',          label: 'Billing'       },
      { path: '/frontdesk/rooms',       icon: 'fa-door-open',        label: 'Rooms'          },
      { path: '/frontdesk/records',     icon: 'fa-address-book',     label: 'Guest Records' },
      { path: '/frontdesk/messages',    icon: 'fa-envelope',         label: 'Messages',      badgeKey: 'unreadMessages'  },
      { path: '/frontdesk/reports',     icon: 'fa-chart-bar',        label: 'Reports'       },
    ],
  };

  const isActive = (path) =>
    path === '/frontdesk'
      ? location.pathname === '/frontdesk'
      : location.pathname.startsWith(path);

  const handleLogout = async () => {
    await logout();
    navigate('/staff-login');
  };

  const switchPortal = (path, label) => {
    setSwitching(label);
    setTimeout(() => navigate(path), 1800);
  };

  if (switching) return <PortalTransition label={switching} />;

  const notifCtx = { counts, items: notifItems, total: notifTotal, refresh: notifRefresh };

  /* ── Sidebar content (shared between desktop & mobile) ───────────── */
  const sidebarContent = (mobile = false) => (
    <>
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-brand-hover">
        <div className="flex items-center min-w-0">
          <i className="fas fa-umbrella-beach text-2xl mr-3 text-white shrink-0"></i>
          {(!collapsed || mobile) && <span className="text-xl font-bold text-white truncate">AplayAccess</span>}
        </div>
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            type="button"
            className="text-white hover:bg-brand-hover w-11 h-11 inline-flex items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 shrink-0"
          >
            <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`} aria-hidden="true"></i>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4" aria-label="Frontdesk navigation">
        {/* Front Desk */}
        <div className="mb-6">
          {(!collapsed || mobile) && <h3 className="uppercase text-xs font-semibold text-blue-200 mb-3 px-2">Front Desk</h3>}
          <ul>
            {menuItems.frontDesk.map((item) => {
              const badge = item.badgeKey ? counts[item.badgeKey] : 0;
              return (
                <li key={item.path} className="mb-2 relative">
                  <Link
                    to={item.path}
                    onClick={mobile ? () => setMobileOpen(false) : undefined}
                    aria-current={isActive(item.path) ? 'page' : undefined}
                    className={`flex items-center p-2 min-h-11 rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                      isActive(item.path)
                        ? 'bg-brand-hover text-white'
                        : 'text-blue-100 hover:bg-brand-hover hover:text-white'
                    }`}
                  >
                    <i className={`fas ${item.icon} mr-3 w-5 text-center shrink-0`}></i>
                    {(!collapsed || mobile) && (
                      <>
                        <span className="text-sm flex-1">{item.label}</span>
                        {badge > 0 && (
                          <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white
                            text-[10px] font-bold flex items-center justify-center px-1 leading-none shrink-0">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </>
                    )}
                    {!mobile && collapsed && badge > 0 && (
                      <span className="absolute right-1 top-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none"></span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

      </nav>

      {/* Inline alerts strip */}
      {(!collapsed || mobile) && notifItems.length > 0 && (
        <div className="mx-3 mb-3 rounded-lg bg-brand-dark border border-blue-400/20 p-3">
          <p className="text-[10px] text-blue-200 uppercase font-semibold mb-2 tracking-wide">
            <i className="fas fa-bell mr-1.5"></i>Active Alerts
          </p>
          <div className="space-y-2">
            {notifItems.map(n => (
              <Link
                key={n.id}
                to={n.path}
                onClick={mobile ? () => setMobileOpen(false) : undefined}
                className="flex items-center gap-2 py-1.5 -my-0.5 px-1 -mx-1 rounded text-xs text-blue-100 hover:text-white hover:bg-brand-hover/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <i className={`fas ${n.icon} w-3.5 text-center shrink-0`}></i>
                <span className="truncate">{n.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Portal switcher — owner only */}
      {user?.role === 'owner' && (
        <div className="px-4 pb-2 border-t border-brand-hover pt-3">
          {(!collapsed || mobile) && <p className="uppercase text-xs font-semibold text-blue-200 mb-2 px-2">Switch Portal</p>}
          <button
            onClick={() => switchPortal('/owner', 'Switching to Owner Portal...')}
            type="button"
            className="flex items-center w-full p-2 min-h-11 text-blue-100 hover:bg-brand-hover rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            title="Switch to Owner Portal"
          >
            <i className="fas fa-crown mr-3 w-5 text-center"></i>
            {(!collapsed || mobile) && <span className="text-sm">Owner Portal</span>}
          </button>
        </div>
      )}

      {/* User info + logout */}
      <div className="p-4 border-t border-brand-hover">
        {(!collapsed || mobile) && (
          <div className="mb-3">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-blue-200 truncate">{userEmail}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          type="button"
          className="flex items-center w-full p-2 min-h-11 text-blue-100 hover:bg-brand-hover rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <i className="fas fa-sign-out-alt mr-3 w-5 text-center" aria-hidden="true"></i>
          {(!collapsed || mobile) && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <NotificationContext.Provider value={notifCtx}>
    <div className="flex h-screen overflow-hidden">

      {/* ── Desktop Sidebar ───────────────────────────────────────── */}
      <div className={`hidden md:flex bg-brand text-white ${collapsed ? 'w-20' : 'w-64'} flex-col transition-[width] duration-300 flex-shrink-0`}>
        {sidebarContent(false)}
      </div>

      {/* ── Mobile Sidebar Overlay ────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Frontdesk navigation"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-72 bg-brand text-white flex flex-col shadow-xl focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              type="button"
              className="absolute top-3 right-3 w-11 h-11 inline-flex items-center justify-center text-blue-200 hover:text-white hover:bg-white/10 rounded-md z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Close sidebar"
            >
              <i className="fas fa-times text-lg" aria-hidden="true"></i>
            </button>
            {sidebarContent(true)}
          </div>
        </div>
      )}

      {/* Floating mobile hamburger — only when the page suppresses
          the standard top bar (e.g. Dashboard renders its own
          header). Without this, mobile users on those pages have
          no way to open the sidebar overlay. md:hidden so it
          disappears as soon as the desktop sidebar is visible. */}
      {!showTopBar && !mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          type="button"
          className="md:hidden fixed top-3 left-3 z-30 flex items-center justify-center w-11 h-11 rounded-md bg-white shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <i className="fas fa-bars" aria-hidden="true"></i>
        </button>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showTopBar && (
          <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(true)}
                type="button"
                className="md:hidden w-11 h-11 inline-flex items-center justify-center rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
              >
                <i className="fas fa-bars text-xl" aria-hidden="true"></i>
              </button>
              <h1 className="text-xl font-bold text-gray-800">
                {PAGE_TITLES[location.pathname] ?? 'Front Desk'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  aria-label={`Profile menu — ${userName}`}
                  className="flex items-center gap-2 px-2 py-1.5 min-h-11 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Avatar
                    src={user?.avatar}
                    name={userName}
                    className="h-8 w-8"
                    fallbackClassName="bg-brand text-white text-sm font-semibold"
                  />
                  <span className="hidden md:inline text-sm font-medium">{userName}</span>
                  <i className="fas fa-chevron-down text-xs text-gray-400"></i>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-3 border-b border-gray-100">
                      <p className="font-medium text-gray-900 text-sm">{userName}</p>
                      <p className="text-xs text-gray-600">{userEmail}</p>
                    </div>
                    <button
                      onClick={() => { setProfileOpen(false); handleLogout(); }}
                      type="button"
                      className="p-3 min-h-11 flex items-center w-full text-left hover:bg-gray-50 text-red-700 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
                    >
                      <i className="fas fa-sign-out-alt mr-3" aria-hidden="true"></i>Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}
        <main className="flex-1 overflow-auto bg-sky-50">
          {children}
        </main>
      </div>

      {/* Staff quick-reply widget — floating bubble that lets front
          desk reply to recent guest messages without leaving the
          current page. Mounted inside Sidebar since every frontdesk
          page composes the Sidebar wrapper, so this shows up
          app-wide without further wiring. */}
      <StaffChatWidget />
    </div>
    </NotificationContext.Provider>
  );
}
