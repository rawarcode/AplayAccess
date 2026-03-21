// src/pages/dashboard/MyBookings.jsx
import { useEffect, useState } from "react";
import { getBookings, cancelBooking } from "../../lib/bookingApi.js";
import { submitReview } from "../../lib/reviewApi.js";
import useLockBodyScroll from "../../hooks/useLockBodyScroll.js";

// ─── Datetime formatter ───────────────────────────────────────────────────────
/** Converts "2026-03-20 07:00" → "Mar 20, 2026 7:00 AM" */
function fmtDateTime(str) {
  if (!str) return str;
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return str;
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Status pill ─────────────────────────────────────────────────────────────
function statusPill(status) {
  const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
  if (status === "Confirmed") return `${base} text-blue-700 bg-blue-100`;
  if (status === "Completed") return `${base} text-green-700 bg-green-100`;
  if (status === "Cancelled") return `${base} text-red-700 bg-red-100`;
  if (status === "Pending")   return `${base} text-yellow-800 bg-yellow-100`;
  return `${base} text-gray-700 bg-gray-100`;
}

// ─── Star rating picker ───────────────────────────────────────────────────────
function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="text-2xl leading-none focus:outline-none"
        >
          <span className={(hovered || value) >= star ? "text-yellow-400" : "text-gray-300"}>★</span>
        </button>
      ))}
    </div>
  );
}

// ─── Cancel confirm modal ─────────────────────────────────────────────────────
function CancelModal({ booking, onClose, onConfirmed }) {
  useLockBodyScroll(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError]           = useState("");

  async function handleConfirm() {
    setError("");
    setCancelling(true);
    try {
      await cancelBooking(booking.booking_id);
      onConfirmed(booking.booking_id);
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Failed to cancel booking. Please try again.";
      setError(msg);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-gray-500/75" />
        <div className="relative bg-white w-full max-w-sm rounded-lg shadow-xl">
          <div className="p-5 flex items-center justify-between border-b">
            <h3 className="text-lg font-bold text-gray-900">Cancel Booking</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to cancel booking{" "}
              <span className="font-semibold text-gray-900">{booking.id}</span>?
            </p>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 text-sm text-yellow-800">
              The ₱150.00 reservation fee is <span className="font-medium">non-refundable</span> upon cancellation.
            </div>

            {error ? (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={cancelling}
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm disabled:opacity-60"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={cancelling}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Review modal ─────────────────────────────────────────────────────────────
function ReviewModal({ booking, onClose, onSubmitted }) {
  useLockBodyScroll(true);
  const [rating, setRating]   = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) { setError("Please select a star rating."); return; }
    setError("");
    setSaving(true);
    try {
      await submitReview({ booking_id: booking.booking_id, rating, comment });
      onSubmitted(booking.booking_id, { rating, comment });
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to submit review. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-gray-500/75" />
        <div className="relative bg-white w-full max-w-md rounded-lg shadow-xl">
          <div className="p-5 flex items-center justify-between border-b">
            <h3 className="text-lg font-bold text-gray-900">Write a Review</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-sm text-gray-600">
              Reviewing: <span className="font-medium">{booking.roomType}</span>
              <br />
              <span className="text-gray-500">{fmtDateTime(booking.checkIn)} – {fmtDateTime(booking.checkOut)}</span>
            </p>

            {error ? (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
              <StarRating value={rating} onChange={setRating} />
              {rating > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium"
              >
                {saving ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MyBookings() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [reviewing, setReviewing] = useState(null); // booking object for review modal
  const [cancelling, setCancelling] = useState(null); // booking object for cancel modal

  useEffect(() => {
    getBookings()
      .then(setItems)
      .catch(() => setError("Failed to load bookings."))
      .finally(() => setLoading(false));
  }, []);

  function handleCancelConfirmed(bookingId) {
    setItems((prev) =>
      prev.map((b) => (b.booking_id === bookingId ? { ...b, status: "Cancelled" } : b))
    );
  }

  function handleReviewSubmitted(bookingId, review) {
    setItems((prev) =>
      prev.map((b) =>
        b.booking_id === bookingId ? { ...b, has_review: true, review } : b
      )
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <p className="text-gray-500">Loading bookings...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-gray-600">View and manage your reservations.</p>
        </div>
      </div>

      {error ? <p className="text-red-600 mb-4">{error}</p> : null}

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visit Slot</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guests</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((b) => (
              <tr key={b.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{b.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{b.roomType}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <div>{fmtDateTime(b.checkIn)}</div>
                  <div className="text-gray-400 text-xs">→ {fmtDateTime(b.checkOut)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{b.guests}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">₱{Number(b.total).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={statusPill(b.status)}>{b.status}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex flex-wrap gap-2">
                    {/* Cancel — only for active bookings */}
                    {b.status !== "Cancelled" && b.status !== "Completed" && (
                      <button
                        className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                        onClick={() => setCancelling(b)}
                      >
                        Cancel
                      </button>
                    )}

                    {/* Review — only for completed bookings not yet reviewed */}
                    {b.status === "Completed" && !b.has_review && (
                      <button
                        className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200"
                        onClick={() => setReviewing(b)}
                      >
                        ★ Review
                      </button>
                    )}

                    {/* Already reviewed badge */}
                    {b.status === "Completed" && b.has_review && (
                      <span
                        className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded"
                        title={b.review?.comment || ""}
                      >
                        {"★".repeat(b.review?.rating || 0)} Reviewed
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {items.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No bookings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cancel confirm modal */}
      {cancelling && (
        <CancelModal
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onConfirmed={handleCancelConfirmed}
        />
      )}

      {/* Review modal */}
      {reviewing && (
        <ReviewModal
          booking={reviewing}
          onClose={() => setReviewing(null)}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  );
}
