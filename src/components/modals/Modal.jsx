import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, maxWidth = "max-w-lg", children }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Keep a ref to the latest onClose so the focus/keyboard effect below can
  // read it without listing onClose in its dep array. Without this, parents
  // that pass a fresh function literal (e.g. `onClose={() => setOpen(false)}`
  // or an unmemoized handler that closes over form state) would cause the
  // effect to re-run on every keystroke, which re-runs the autofocus logic
  // and yanks focus to the first focusable element — typically the X close
  // button — making text inputs un-typeable.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Focus trap + keyboard handling — only re-runs when `open` flips.
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
      if (e.key === "Escape") { onCloseRef.current?.(); return; }
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
  }, [open]);

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
