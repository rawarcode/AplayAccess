import Modal from "./Modal.jsx";

const STYLES = {
  info:    { header: "bg-blue-100",   iconBg: "bg-blue-200",   iconColor: "text-blue-600",   icon: "fa-circle-info",        btn: "bg-blue-600 hover:bg-blue-700"     },
  success: { header: "bg-green-100",  iconBg: "bg-green-200",  iconColor: "text-green-600",  icon: "fa-circle-check",       btn: "bg-green-600 hover:bg-green-700"   },
  error:   { header: "bg-red-100",    iconBg: "bg-red-200",    iconColor: "text-red-600",    icon: "fa-circle-exclamation", btn: "bg-red-600 hover:bg-red-700"       },
  warning: { header: "bg-amber-100",  iconBg: "bg-amber-200",  iconColor: "text-amber-600",  icon: "fa-triangle-exclamation", btn: "bg-amber-600 hover:bg-amber-700" },
};

export default function AlertModal({ open, onClose, title = "Alert", type = "info", message }) {
  if (!open) return null;

  const s = STYLES[type] || STYLES.info;

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      <div className={`p-5 ${s.header} rounded-t-xl`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full ${s.iconBg} flex items-center justify-center`}>
            <i className={`fas ${s.icon} text-lg ${s.iconColor}`}></i>
          </div>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
      </div>

      <div className="p-6">
        <p className="text-base text-gray-700 text-center">{message}</p>
        <button
          onClick={onClose}
          className={`mt-6 w-full ${s.btn} text-white font-medium py-2.5 px-4 rounded-lg transition`}
        >
          OK
        </button>
      </div>
    </Modal>
  );
}
