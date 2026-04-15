import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ open, onClose, maxWidth = "max-w-lg", children }) {
  // Escape key to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className={`relative w-full ${maxWidth} bg-white rounded-xl shadow-2xl animate-hero-fade-in opacity-0`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
