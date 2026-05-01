import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, maxWidth = "max-w-lg", labelledBy, label, title, children }) {
  // `title` is an alias for `label` — both Owner and Admin shells were
  // already passing `title="Account Settings"` from before label/labelledBy
  // existed. Treat it as a fallback so those callers keep working without
  // the dialog being silently nameless to screen readers (WCAG 4.1.2 +
  // ARIA 1.2 dialog naming).
  const accessibleName = labelledBy ? undefined : (label ?? title);
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
    // Backdrop is the outer fixed-position container itself — bg-black/60
    // applied directly here guarantees coverage of the entire viewport
    // regardless of inner-div quirks. Previously the backdrop was a
    // separate <div className="absolute inset-0 ..."> nested inside an
    // unpositioned flex wrapper, which on some browsers (and tall-modal
    // scroll states) left a visible white strip below the modal because
    // the backdrop's containing block wasn't always the viewport.
    // Click-to-close moves up to the outer, so the dialog needs a
    // stopPropagation to keep clicks inside it from bubbling out.
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60"
      onClick={onClose}
    >
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-label={accessibleName}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full ${maxWidth} bg-white rounded-xl shadow-2xl animate-hero-fade-in opacity-0`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
