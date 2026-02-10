export default function Modal({ open, onClose, maxWidth = "max-w-lg", children }) {
    if (!open) return null;
  
    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="min-h-screen flex items-center justify-center px-4 py-10">
          <div className="absolute inset-0 bg-gray-500/75" />
          <div className={`relative w-full ${maxWidth} bg-white rounded-xl shadow-2xl overflow-hidden`}>
            {children}
          </div>
        </div>
      </div>
    );
  }
  