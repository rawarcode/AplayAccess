import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import ConfirmDialog from './ConfirmDialog';
import {
  isMessageSoundMuted,
  setMessageSoundMuted,
  onMessageSoundMuteChange,
} from '../../lib/notificationSound';

const COLOR_MAP = {
  yellow: 'bg-yellow-100 text-yellow-600',
  blue:   'bg-blue-100 text-blue-600',
  green:  'bg-green-100 text-green-600',
  orange: 'bg-orange-100 text-orange-600',
  red:    'bg-rose-100 text-rose-600',
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
  const [clearedIds, setClearedIds]   = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const visibleItems = items.filter(n => !clearedIds.has(n.id));
  const visibleTotal = visibleItems.length;
  const btnRef                    = useRef(null);
  const dropRef                   = useRef(null);

  // Chime mute state. Shared across tabs + the guest-side Messages
  // toggle via the notificationSound utility's custom-event bus.
  const [soundMuted, setSoundMutedLocal] = useState(isMessageSoundMuted);
  useEffect(() => onMessageSoundMuteChange(setSoundMutedLocal), []);

  // Position dropdown using fixed coords so it's never clipped by
  // overflow:hidden parents. Width clamps to viewport on narrow screens.
  //
  // Two clamps on the right offset:
  //  1. Default: align dropdown right edge with bell right edge —
  //     visually anchors the dropdown under the bell on desktop.
  //  2. BUT the bell isn't always pinned to the viewport's right edge.
  //     In every staff shell the profile dropdown sits TO THE RIGHT of
  //     the bell, so bell.right is ~100px from viewport right on phone
  //     widths. Without the second clamp, "right: vw - bell.right" sets
  //     a huge right offset, pushing the dropdown's left edge to
  //     negative coords — i.e. off-screen left, exactly the cut-off bug.
  //     The second clamp shifts the dropdown right when needed so its
  //     left edge sits at the 8px gutter.
  const openDropdown = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const vw     = window.innerWidth;
      const width  = Math.min(320, vw - 16);
      let right    = Math.max(8, vw - rect.right);
      if (vw - right - width < 8) right = vw - width - 8;
      setStyle({
        position: 'fixed',
        top:   rect.bottom + 6,
        right,
        width,
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
        className={`relative p-2 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors ${bellClass} ${className}`}
        title="Notifications"
      >
        <i className="fas fa-bell-concierge text-xl"></i>
        {visibleTotal > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full
            bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center
            px-1 leading-none pointer-events-none">
            {visibleTotal > 99 ? '99+' : visibleTotal}
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
              <i className="fas fa-bell-concierge text-gray-500"></i>
              Notifications
            </h3>
            {visibleTotal > 0 && (
              <span className="text-[11px] font-semibold text-white bg-amber-500 rounded-full px-2 py-0.5">
                {visibleTotal}
              </span>
            )}
          </div>

          {/* Items */}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <i className="fas fa-check-circle text-3xl text-green-400"></i>
                <p className="text-sm font-medium text-gray-600">All caught up!</p>
                <p className="text-xs text-gray-400">No new alerts right now.</p>
              </div>
            ) : (
              visibleItems.map(n => (
                <Link
                  key={n.id}
                  to={n.path}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50
                    transition-colors text-left group no-underline"
                >
                  <div className={`rounded-full p-2 shrink-0 ${COLOR_MAP[n.color] ?? COLOR_MAP.blue}`}>
                    <i className={`fas ${n.icon} text-xs`}></i>
                  </div>
                  <p className="text-sm text-gray-700 flex-1 leading-snug">{n.label}</p>
                  <i className="fas fa-chevron-right text-[10px] text-gray-300 shrink-0
                    group-hover:text-gray-500 transition-colors"></i>
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50
            flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { refresh?.(); }}
                aria-label="Refresh notifications"
                className="inline-flex items-center min-h-11 px-3 py-2 rounded text-xs text-blue-700 hover:bg-blue-50 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <i className="fas fa-sync-alt mr-1" aria-hidden="true"></i>Refresh
              </button>
              {visibleItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  aria-label="Clear all notifications"
                  className="inline-flex items-center min-h-11 px-3 py-2 rounded text-xs text-red-700 hover:bg-red-50 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                >
                  <i className="fas fa-times mr-1" aria-hidden="true"></i>Clear
                </button>
              )}
              {/* Chime mute toggle — scopes to new-message sound only,
                  not to the red badge. Synced with the guest Messages
                  toggle via localStorage + a window event. */}
              <button
                type="button"
                onClick={() => setMessageSoundMuted(!soundMuted)}
                aria-pressed={soundMuted}
                aria-label={soundMuted ? "Unmute new-message sound" : "Mute new-message sound"}
                title={soundMuted ? "Unmute new-message sound" : "Mute new-message sound"}
                className="inline-flex items-center min-h-11 px-3 py-2 rounded text-xs text-slate-700 hover:bg-slate-100 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                <i className={`fas ${soundMuted ? "fa-volume-xmark" : "fa-volume-high"} mr-1`} aria-hidden="true"></i>
                {soundMuted ? "Muted" : "Sound"}
              </button>
            </div>
            <span className="text-[11px] text-gray-400">Updates every 20s</span>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        variant="warning"
        title="Clear all notifications?"
        message="Notifications will reappear on the next refresh if the underlying conditions still apply."
        confirmLabel="Yes, clear"
        cancelLabel="Cancel"
        onConfirm={() => { setClearedIds(new Set(items.map(n => n.id))); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
