import Modal from "./Modal.jsx";

const STYLES = {
  info:    { header: "bg-blue-100",   iconBg: "bg-blue-200",   iconColor: "text-blue-600",   icon: "fa-circle-info",        btn: "bg-blue-600 hover:bg-blue-700",  ring: "focus-visible:ring-blue-500" },
  success: { header: "bg-green-100",  iconBg: "bg-green-200",  iconColor: "text-green-600",  icon: "fa-circle-check",       btn: "bg-green-600 hover:bg-green-700", ring: "focus-visible:ring-green-500" },
  error:   { header: "bg-red-100",    iconBg: "bg-red-200",    iconColor: "text-red-600",    icon: "fa-circle-exclamation", btn: "bg-red-600 hover:bg-red-700",     ring: "focus-visible:ring-red-500" },
  warning: { header: "bg-amber-100",  iconBg: "bg-amber-200",  iconColor: "text-amber-600",  icon: "fa-triangle-exclamation", btn: "bg-amber-600 hover:bg-amber-700", ring: "focus-visible:ring-amber-500" },
};

export default function AlertModal({ open, onClose, title = "Alert", type = "info", message }) {
  const s = STYLES[type] || STYLES.info;
  const titleId = "alert-modal-title";

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md" labelledBy={titleId}>
      <div className={`p-5 ${s.header} rounded-t-xl`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full ${s.iconBg} flex items-center justify-center`}>
            <i className={`fas ${s.icon} text-lg ${s.iconColor}`} aria-hidden="true"></i>
          </div>
          <h3 id={titleId} className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
      </div>

      <div className="p-6">
        <p className="text-base text-gray-700 text-center">{message}</p>
        <button
          onClick={onClose}
          type="button"
          className={`mt-6 w-full ${s.btn} text-white font-medium py-2.5 min-h-11 px-4 rounded-lg transition focus:outline-none focus-visible:ring-2 ${s.ring} focus-visible:ring-offset-2`}
        >
          OK
        </button>
      </div>
    </Modal>
  );
}
