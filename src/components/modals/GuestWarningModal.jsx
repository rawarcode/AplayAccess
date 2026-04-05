import Modal from "./Modal.jsx";

/**
 * Shown when a non-logged-in user clicks "Book Now".
 * Lets the user choose: log in / sign up, or continue as a guest.
 */
export default function GuestWarningModal({ open, onClose, onContinueAsGuest, onLoginSignup }) {
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        {/* Icon + heading */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-3">
            <i className="fas fa-user-slash text-2xl text-amber-500"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-900">Booking Without an Account</h3>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            You're about to book as a <span className="font-semibold text-gray-800">guest</span>.
            Without an account you <span className="font-semibold text-red-600">won't be able to</span>:
          </p>
        </div>

        {/* What they lose */}
        <ul className="space-y-2 mb-5 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <i className="fas fa-times-circle text-red-500 mt-0.5 shrink-0"></i>
            View or manage your booking online
          </li>
          <li className="flex items-start gap-2">
            <i className="fas fa-times-circle text-red-500 mt-0.5 shrink-0"></i>
            Cancel or modify your reservation yourself
          </li>
          <li className="flex items-start gap-2">
            <i className="fas fa-times-circle text-red-500 mt-0.5 shrink-0"></i>
            Leave a review after your stay
          </li>
          <li className="flex items-start gap-2">
            <i className="fas fa-times-circle text-red-500 mt-0.5 shrink-0"></i>
            Receive booking history and receipts in-app
          </li>
        </ul>

        <p className="text-xs text-gray-500 mb-5 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          <i className="fas fa-info-circle mr-1 text-blue-400"></i>
          To make changes to a guest booking, you'll need to contact us directly at the resort.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onLoginSignup}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <i className="fas fa-sign-in-alt mr-2"></i>Log In or Sign Up
          </button>
          <button
            onClick={onContinueAsGuest}
            className="w-full py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg border border-gray-300 transition-colors"
          >
            <i className="fas fa-user-secret mr-2 text-gray-400"></i>Continue as Guest
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
