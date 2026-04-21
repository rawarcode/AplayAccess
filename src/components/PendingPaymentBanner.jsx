import { useNavigate } from 'react-router-dom';
import usePendingPayment, { clearPendingPayment } from '../hooks/usePendingPayment.js';
// clearPendingPayment is only used by the ✕ dismiss button below.
// handleResume intentionally does NOT clear — otherwise the banner
// would vanish the moment the user clicks Resume, and if they then
// close the review modal without paying, it would never return
// (localStorage empty + no re-save trigger). Cleanup lives in the
// payment-success, timeout-cancel, and explicit-cancel paths.

// Floating pill shown at the BOTTOM-LEFT of every page when a guest
// has an open Pending booking they haven't finished paying. Clicking
// "Resume payment" navigates to MyBookings with a ?resume=<id> query
// param, which auto-opens BookingModal in resume mode there — same
// review → Continue Payment flow the table's Continue button uses.
//
// Moved off bottom-right to stop colliding with the Crisp chat widget.
// Invisible when no pending context exists — mounted globally in App.
// The ✕ dismisses the context locally but does NOT cancel the booking:
// the backend's 15-min sweep handles cleanup if the guest never returns.
export default function PendingPaymentBanner() {
  const pending = usePendingPayment();
  const navigate = useNavigate();

  if (!pending) return null;

  function handleResume() {
    // Guest-token bookings (no account): route to the public resume
    // page at /resume-booking?token=<guest_token>. That page fetches
    // booking details via /api/guest-booking/{token} and mounts
    // BookingModal in resume mode — same review + Continue Payment
    // flow authed users see inside MyBookings.
    if (pending.guestToken) {
      navigate(`/resume-booking?token=${encodeURIComponent(pending.guestToken)}`);
      return;
    }
    // Authed: route to MyBookings with a resume hint. That page reads
    // the query param on mount and opens BookingModal in resume mode
    // pointing at this booking. We do NOT clear the reminder here —
    // BookingModal's success + cancel + timeout paths own that. If
    // the user closes the review modal without paying, the banner
    // stays so they have another chance on the next click.
    navigate(`/dashboard/bookings?resume=${pending.bookingId}`);
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-50 max-w-sm"
      aria-label="Pending payment reminder"
    >
      <div className="bg-white border-2 border-amber-400 rounded-xl shadow-lg p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <i className="fas fa-credit-card text-amber-700" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            Payment pending
          </p>
          <p className="text-xs text-slate-500 truncate">
            {pending.resId ?? `Booking #${pending.bookingId}`}
            {pending.roomName ? ` · ${pending.roomName}` : ''}
          </p>
          <button
            type="button"
            onClick={handleResume}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
          >
            <i className="fas fa-arrow-right-to-bracket" aria-hidden="true" />
            Resume payment
          </button>
        </div>
        <button
          type="button"
          onClick={clearPendingPayment}
          aria-label="Dismiss pending-payment reminder"
          title="Dismiss reminder (booking keeps its hold)"
          className="text-slate-400 hover:text-slate-700 p-2 -m-1 rounded-lg hover:bg-slate-100 shrink-0"
        >
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
