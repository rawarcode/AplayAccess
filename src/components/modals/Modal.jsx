import { createPortal } from "react-dom";

export default function Modal({ open, onClose, maxWidth = "max-w-lg", children }) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto"
      onMouseDown={(e) => {
        // close only when clicking the dark backdrop (not inside the dialog)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-black/60" />
        <div className={`relative w-full ${maxWidth} bg-white rounded-xl shadow-2xl`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}