// src/components/modals/SuccessModal.jsx
import { useState } from "react";
import Modal from "./Modal.jsx";
import { Link } from "react-router-dom";
import { downloadGuestReceipt } from "../../lib/bookingApi.js";

/**
 * @param {{ open, onClose, booking, guestMode }} props
 * booking shape (optional):
 *   { roomType, checkIn, checkOut, guests, paymentMethod, totals, bookingData }
 * guestMode: true = guest booking (no account), show download receipt instead of dashboard link
 */
export default function SuccessModal({ open, onClose, booking = null, guestMode = false }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  // Build a booking reference from the DB id if available
  const bookingId = booking?.bookingData?.id ?? null;
  const ref = bookingId
    ? "RES-" + String(bookingId).padStart(6, "0")
    : null;

  async function handleDownloadReceipt() {
    if (!bookingId) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const blob = await downloadGuestReceipt(bookingId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${ref}-receipt.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Could not download receipt. Please contact the resort.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <i className="fas fa-check text-green-600 text-xl"></i>
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
          <div className="bg-blue-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
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
                  <span className="text-gray-600">Reservation Fee (Paid)</span>
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

        {/* Guest mode notice */}
        {guestMode ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4 text-xs text-amber-800 flex items-start gap-2">
              <i className="fas fa-info-circle mt-0.5 shrink-0 text-amber-500"></i>
              <span>
                You booked as a guest. <strong>Download your receipt now</strong> — this is the only way to retrieve your booking details without contacting the resort.
              </span>
            </div>

            {downloadError && (
              <p className="text-xs text-red-600 mb-3">
                <i className="fas fa-exclamation-circle mr-1"></i>{downloadError}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleDownloadReceipt}
                disabled={downloading || !bookingId}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-md text-sm"
              >
                {downloading
                  ? <><i className="fas fa-spinner fa-spin"></i> Downloading...</>
                  : <><i className="fas fa-file-pdf"></i> Download Receipt (PDF)</>}
              </button>
              <button
                onClick={onClose}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-md text-sm"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">
              You can view and manage your booking anytime from your dashboard.
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
          </>
        )}
      </div>
    </Modal>
  );
}
