import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, maxWidth = "max-w-lg", children }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus trap + keyboard handling
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;

    // Focus first focusable element inside the dialog
    requestAnimationFrame(() => {
      const el = dialogRef.current;
      if (!el) return;
      const first = el.querySelector(FOCUSABLE);
      if (first) first.focus();
      else el.focus();
    });

    function handleKey(e) {
      if (e.key === "Escape") { onClose?.(); return; }
      if (e.key !== "Tab") return;
      const el = dialogRef.current;
      if (!el) return;
      const focusable = [...el.querySelectorAll(FOCUSABLE)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className={`relative w-full ${maxWidth} bg-white rounded-xl shadow-2xl animate-hero-fade-in opacity-0`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
