// src/components/modals/SuccessModal.jsx
import Modal from "./Modal.jsx";
import { Link } from "react-router-dom";

/**
 * @param {{ open: boolean, onClose: () => void, booking?: object }} props
 * booking shape (optional):
 *   { roomType, checkIn, checkOut, guests, paymentMethod, totals, bookingData }
 */
export default function SuccessModal({ open, onClose, booking = null }) {
  // Build a booking reference from the DB id if available
  const ref = booking?.bookingData?.id
    ? "RES-" + String(booking.bookingData.id).padStart(6, "0")
    : null;

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <span className="text-green-700 text-xl">✓</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Booking Successful!</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Thank you for choosing Aplaya Beach Resort.
            </p>
          </div>
        </div>

        {/* Booking summary card */}
        {booking && (
          <div className="bg-blue-50 rounded-lg p-4 mb-5 space-y-2 text-sm">
            {ref && (
              <div className="flex justify-between">
                <span className="text-gray-600">Booking Reference</span>
                <span className="font-bold text-blue-700">{ref}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Room</span>
              <span className="font-medium text-gray-900">{booking.roomType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Check-in</span>
              <span className="font-medium text-gray-900">{booking.checkIn}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Check-out</span>
              <span className="font-medium text-gray-900">{booking.checkOut}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Guests</span>
              <span className="font-medium text-gray-900">{booking.guests}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment</span>
              <span className="font-medium text-gray-900">{booking.paymentMethod}</span>
            </div>
            {booking.totals && (
              <>
                <div className="border-t border-blue-200 pt-2 flex justify-between">
                  <span className="text-gray-600">Reservation Fee (Due Now)</span>
                  <span className="font-semibold text-gray-900">
                    ₱{Number(booking.totals.reservationFee).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Balance Due at Check-in</span>
                  <span>₱{Number(booking.totals.balanceDue).toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500 mb-4">
          A confirmation has been noted. You can view your booking anytime from your dashboard.
        </p>

        <div className="flex gap-3">
          <Link
            to="/dashboard/bookings"
            onClick={onClose}
            className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md text-sm"
          >
            View My Bookings
          </Link>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-md text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
