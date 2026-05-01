import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import useFocusTrap from '../../hooks/useFocusTrap.js';

/**
 * Reusable confirmation dialog.
 *
 * Props:
 *   open         – boolean
 *   title        – string
 *   message      – string or JSX
 *   confirmLabel – string (default "Confirm")
 *   cancelLabel  – string (default "Cancel")
 *   variant      – "danger" | "warning" | "info" (default "danger")
 *   onConfirm    – () => void
 *   onCancel     – () => void
 */
const ICON = {
  danger:  { icon: 'fa-triangle-exclamation', bg: 'bg-red-100',    text: 'text-red-600'    },
  warning: { icon: 'fa-triangle-exclamation', bg: 'bg-amber-100',  text: 'text-amber-600'  },
  info:    { icon: 'fa-circle-info',          bg: 'bg-blue-100',   text: 'text-blue-600'   },
};

const CONFIRM_BTN = {
  danger:  'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  info:    'bg-blue-600 hover:bg-blue-700 text-white',
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',
  onConfirm,
  onCancel,
}) {
  // Focus trap moves initial focus to the Cancel button (the safer
  // default for destructive dialogs — users have to deliberately
  // tab/click to Confirm) and restores focus to the trigger on close.
  const dialogRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) { if (e.key === 'Escape') onCancel?.(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const { icon, bg, text } = ICON[variant] ?? ICON.danger;
  const ringByVariant = {
    danger:  'focus-visible:ring-red-500',
    warning: 'focus-visible:ring-amber-500',
    info:    'focus-visible:ring-blue-500',
  };
  const confirmRing = ringByVariant[variant] ?? ringByVariant.danger;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4" aria-hidden={false}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? "confirm-dialog-message" : undefined}
        tabIndex={-1}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-hero-fade-in opacity-0 focus:outline-none"
      >
        <div className="p-6">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`h-10 w-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>
              <i className={`fas ${icon} ${text}`} aria-hidden="true"></i>
            </div>
            <div className="pt-1">
              <h3 id="confirm-dialog-title" className="text-base font-semibold text-gray-900">{title}</h3>
              {message && (
                <p id="confirm-dialog-message" className="mt-1 text-sm text-gray-700 leading-relaxed">{message}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end mt-6">
            <button
              onClick={onCancel}
              type="button"
              className="px-4 py-2.5 min-h-11 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              type="button"
              className={`px-4 py-2.5 min-h-11 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${confirmRing} ${CONFIRM_BTN[variant] ?? CONFIRM_BTN.danger}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
