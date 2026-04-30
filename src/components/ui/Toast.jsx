import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Floating toast notification — auto-dismisses after duration.
 * Supports: success, error, warning, info
 *
 * Usage:
 *   const [toast, showToast, clearToast, toastType] = useToast();
 *   showToast("Profile updated!", "success");
 *   <Toast message={toast} type={toastType} onClose={clearToast} />
 */
export function useToast(duration = 4000) {
  const [toast, setToast] = useState({ message: "", type: "error", action: null });
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = "error", action = null) => {
    setToast({ message, type, action });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast({ message: "", type: "error", action: null }), duration);
  }, [duration]);

  const clearToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message: "", type: "error", action: null });
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return [toast.message, showToast, clearToast, toast.type, toast.action];
}

const TOAST_STYLES = {
  success: { bg: "bg-emerald-600", icon: "fa-circle-check"        },
  error:   { bg: "bg-red-600",     icon: "fa-circle-exclamation"  },
  warning: { bg: "bg-amber-600",   icon: "fa-triangle-exclamation"},
  info:    { bg: "bg-blue-600",    icon: "fa-circle-info"         },
};

export default function Toast({ message, type = "error", onClose, action }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [message]);

  if (!message) return null;

  const s = TOAST_STYLES[type] || TOAST_STYLES.error;

  return (
    // z-[10001] sits ABOVE every modal in the app — Modal.jsx and the
    // BookingModal hover/lightbox portals all use z-[9999]/[10000], so
    // with the toast at the same level (the previous z-[9999]) the
    // later-rendered modal dim ended up covering the toast and the
    // staff member never saw error messages thrown from inside a
    // modal action (cross-day check-in, etc).
    //
    // Mobile width: top-4 + horizontal mx-4 + max-w-sm makes the toast
    // hug the screen edges on small viewports while still centering
    // around the right side on desktop via right-4 + left-auto.
    <div
      className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[10001] flex items-center gap-3 ${s.bg} text-white px-5 py-3.5 rounded-xl shadow-2xl sm:max-w-sm sm:ml-auto transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : "sm:translate-x-full opacity-0"
      }`}
      role="alert"
    >
      <i className={`fas ${s.icon} text-lg shrink-0`}></i>
      <span className="text-sm font-medium flex-1">{message}</span>
      {action && (
        <button onClick={() => { action.onClick(); onClose(); }}
          className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold uppercase tracking-wide shrink-0 transition">
          {action.label}
        </button>
      )}
      <button onClick={onClose} className="opacity-70 hover:opacity-100 shrink-0 ml-1" aria-label="Dismiss">
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
}
