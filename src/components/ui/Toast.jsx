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
  const [toast, setToast] = useState({ message: "", type: "error" });
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = "error") => {
    setToast({ message, type });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast({ message: "", type: "error" }), duration);
  }, [duration]);

  const clearToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message: "", type: "error" });
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return [toast.message, showToast, clearToast, toast.type];
}

const TOAST_STYLES = {
  success: { bg: "bg-emerald-600", icon: "fa-circle-check"        },
  error:   { bg: "bg-red-600",     icon: "fa-circle-exclamation"  },
  warning: { bg: "bg-amber-600",   icon: "fa-triangle-exclamation"},
  info:    { bg: "bg-blue-600",    icon: "fa-circle-info"         },
};

export default function Toast({ message, type = "error", onClose }) {
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
    <div
      className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 ${s.bg} text-white px-5 py-3.5 rounded-xl shadow-2xl max-w-sm transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
      role="alert"
    >
      <i className={`fas ${s.icon} text-lg shrink-0`}></i>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 shrink-0 ml-1" aria-label="Dismiss">
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
}
