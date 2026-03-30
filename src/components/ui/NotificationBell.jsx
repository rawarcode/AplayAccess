import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';

const COLOR_MAP = {
  yellow: 'bg-yellow-100 text-yellow-600',
  blue:   'bg-blue-100 text-blue-600',
  green:  'bg-green-100 text-green-600',
  orange: 'bg-orange-100 text-orange-600',
};

/**
 * Notification bell that reads from NotificationContext.
 * Renders a bell icon with red badge; clicking opens a dropdown list of alert items.
 *
 * variant="light"  → grey bell  (use in light headers, e.g. AdminShell)
 * variant="dark"   → white bell (use in dark sidebars, e.g. frontdesk Sidebar)
 */
export default function NotificationBell({ variant = 'light', className = '' }) {
  const { items, total, refresh } = useNotifications();
  const [open, setOpen]           = useState(false);
  const [style, setStyle]         = useState({});
  const btnRef                    = useRef(null);
  const dropRef                   = useRef(null);
  const navigate                  = useNavigate();

  // Position dropdown using fixed coords so it's never clipped by overflow:hidden parents
  const openDropdown = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setStyle({
        position: 'fixed',
        top:   rect.bottom + 6,
        right: window.innerWidth - rect.right,
        width: 320,
      });
    }
    refresh?.();
    setOpen(true);
  }, [refresh]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isDark      = variant === 'dark';
  const bellClass   = isDark
    ? 'text-blue-100 hover:text-white'
    : 'text-gray-600 hover:text-gray-800';

  return (
    <>
      {/* Bell trigger button */}
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={`relative p-2 focus:outline-none transition-colors ${bellClass} ${className}`}
        title="Notifications"
      >
        <i className="fas fa-bell text-xl"></i>
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full
            bg-red-500 text-white text-[10px] font-bold flex items-center justify-center
            px-1 leading-none pointer-events-none">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {/* Dropdown — portalled via fixed position */}
      {open && (
        <div
          ref={dropRef}
          style={style}
          className="z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <i className="fas fa-bell text-gray-500"></i>
              Notifications
            </h3>
            {total > 0 && (
              <span className="text-[11px] font-semibold text-white bg-red-500 rounded-full px-2 py-0.5">
                {total}
              </span>
            )}
          </div>

          {/* Items */}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <i className="fas fa-check-circle text-3xl text-green-400"></i>
                <p className="text-sm font-medium text-gray-600">All caught up!</p>
                <p className="text-xs text-gray-400">No new alerts right now.</p>
              </div>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => { setOpen(false); navigate(n.path); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50
                    transition-colors text-left group"
                >
                  <div className={`rounded-full p-2 shrink-0 ${COLOR_MAP[n.color] ?? COLOR_MAP.blue}`}>
                    <i className={`fas ${n.icon} text-xs`}></i>
                  </div>
                  <p className="text-sm text-gray-700 flex-1 leading-snug">{n.label}</p>
                  <i className="fas fa-chevron-right text-[10px] text-gray-300 shrink-0
                    group-hover:text-gray-500 transition-colors"></i>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50
            flex items-center justify-between">
            <button
              onClick={() => { refresh?.(); }}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              <i className="fas fa-sync-alt mr-1"></i>Refresh
            </button>
            <span className="text-[11px] text-gray-400">Updates every 10s</span>
          </div>
        </div>
      )}
    </>
  );
}
