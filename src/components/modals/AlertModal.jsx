import Modal from "./Modal.jsx";

export default function AlertModal({ open, onClose, title = "Alert", type = "info", message }) {
  if (!open) return null;

  const styles =
    {
      info: { header: "bg-blue-100", iconBg: "bg-blue-200", icon: "ℹ️" },
      success: { header: "bg-green-100", iconBg: "bg-green-200", icon: "✅" },
      error: { header: "bg-red-100", iconBg: "bg-red-200", icon: "⛔" },
      warning: { header: "bg-yellow-100", iconBg: "bg-yellow-200", icon: "⚠️" },
    }[type] || { header: "bg-blue-100", iconBg: "bg-blue-200", icon: "ℹ️" };

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      <div className={`p-5 ${styles.header}`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full ${styles.iconBg} flex items-center justify-center`}>
            <span className="text-lg">{styles.icon}</span>
          </div>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
      </div>

      <div className="p-6">
        <p className="text-base text-gray-700 text-center">{message}</p>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
        >
          OK
        </button>
      </div>
    </Modal>
  );
}
