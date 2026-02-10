import Modal from "./Modal.jsx";

export default function SuccessModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <span className="text-green-700 text-xl">✓</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Booking Successful!</h3>
            <p className="text-sm text-gray-600 mt-1">
              Thank you for booking with Aplaya Beach Resort. We&apos;ve sent a confirmation to your email address.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
