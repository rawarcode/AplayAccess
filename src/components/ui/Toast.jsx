import { useState, useCallback, useEffect } from "react";

/**
 * Floating error toast — red by default, green when type="success".
 * Usage:
 *   const [toast, showToast, clearToast] = useToast();
 *   <Toast message={toast} onClose={clearToast} />
 */
export function useToast(duration = 4000) {
  const [toast, setToast] = useState({ message: "", type: "error" });
  const timerRef = { current: null };

  const showToast = useCallback((message, type = "error") => {
    setToast({ message, type });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast({ message: "", type: "error" }), duration);
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearToast = useCallback(() => setToast({ message: "", type: "error" }), []);

  // Clean up timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [toast.message, showToast, clearToast, toast.type];
}

export default function Toast({ message, type = "error", onClose }) {
  if (!message) return null;

  const isSuccess = type === "success";
  const bg = isSuccess ? "bg-emerald-600" : "bg-red-600";
  const icon = isSuccess ? "fa-check-circle" : "fa-exclamation-circle";

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 ${bg} text-white px-4 py-3 rounded-lg shadow-xl max-w-sm`}
      role="alert"
    >
      <i className={`fas ${icon} shrink-0`}></i>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 shrink-0 ml-1">
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
}
