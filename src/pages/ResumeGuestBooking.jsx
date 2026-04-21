// src/pages/ResumeGuestBooking.jsx
//
// Public page that hosts BookingModal in resume mode for unauthed
// guest-token bookings. Entered via the PendingPaymentBanner when a
// guest closed the PayMongo popup + booking modal without paying.
//
// Why a dedicated page (not just the banner calling /resume-payment
// directly): guests get the same "review → Continue Payment / Cancel"
// screen that authed users see inside MyBookings. One consistent UX
// across both account states.

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { api } from "../lib/api.js";
import BookingModal from "../components/modals/BookingModal.jsx";
import { fmtDateTime } from "../lib/format.js";
import { clearPendingPayment } from "../hooks/usePendingPayment.js";

// Map a booking-type slug to a friendly label. Mirrors the table in
// MyBookings/GuestDashboard so the review screen copy is identical.
const TYPE_LABELS = {
  day:       'Day Visit (6 AM – 6 PM)',
  night:     'Night Stay (6 PM – 7 AM)',
  '24hr':    '24 Hours',
  '24hr-pm': '24 Hours',
};

export default function ResumeGuestBooking() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get('token') || '';

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing booking token.');
      setLoading(false);
      return;
    }
    api.get(`/api/guest-booking/${encodeURIComponent(token)}`)
      .then(r => {
        const b = r.data;
        // If the booking is already paid / checked-in / cancelled, there's
        // nothing to resume — redirect to the appropriate terminal state.
        if (b.fully_paid || b.status === 'Confirmed' || b.status === 'Checked In' || b.status === 'Completed') {
          navigate(`/payment/success?booking=${b.booking_id}`, { replace: true });
          return;
        }
        if (b.status === 'Cancelled') {
          setError('This booking was cancelled and can no longer be paid.');
          clearPendingPayment();
          return;
        }
        setBooking(b);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message
          ?? 'Could not find this booking. It may have expired.';
        setError(msg);
        // If the server outright says 404/403, stop the banner from
        // pointing at a phantom booking next time.
        if (err?.response?.status === 404 || err?.response?.status === 403) {
          clearPendingPayment();
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Shape the booking into the resumeBooking prop BookingModal expects.
  // Keep the field names matching what MyBookings/Dashboard also send
  // so the modal has one code path for both authed and guest resume.
  const resumeBooking = booking ? {
    bookingId:        booking.booking_id,
    resId:            booking.res_id,
    roomName:         booking.room_name,
    bookingType:      booking.booking_type,
    bookingTypeLabel: TYPE_LABELS[booking.booking_type] ?? null,
    checkIn:          booking.check_in  ? fmtDateTime(booking.check_in)  : null,
    checkOut:         booking.check_out ? fmtDateTime(booking.check_out) : null,
    guests:           booking.guests ?? 1,
    total:            Number(booking.total ?? 0),
    reservationFee:   Number(booking.reservation_fee ?? 0),
    payFull:          false, // same default as authed side — resume reservation fee only
    guestToken:       token,
  } : null;

  return (
    <div className="pt-20 min-h-screen bg-slate-50">
      <Helmet><title>Resume Payment — Aplaya Beach Resort</title></Helmet>

      {loading && (
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-sky-500 mb-3" aria-hidden="true"></i>
          <p className="text-sm text-slate-500">Loading your booking…</p>
        </div>
      )}

      {error && (
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-triangle-exclamation text-rose-600 text-xl" aria-hidden="true"></i>
            </div>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">Booking unavailable</h1>
            <p className="text-sm text-slate-500 mb-5">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium transition"
            >
              Back to home
            </button>
          </div>
        </div>
      )}

      {/* The BookingModal already renders its own full-screen overlay
          so we don't need any page chrome behind it. When the user
          clicks Continue Payment or Cancel inside the modal, that
          flow takes over; on close we navigate home. */}
      <BookingModal
        open={!!resumeBooking}
        onClose={() => navigate('/')}
        rooms={[]}
        resumeBooking={resumeBooking}
        guestMode={true}
        onBooked={() => {
          // Payment confirmed inside the modal. The modal clears its own
          // localStorage pending-payment flag in its success path; we
          // just land the guest on the resort page.
          navigate('/');
        }}
      />
    </div>
  );
}
