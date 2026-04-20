import { useState } from 'react';
import { api } from '../lib/api.js';
import usePendingPayment, { clearPendingPayment } from '../hooks/usePendingPayment.js';

// Floating pill shown at the bottom-right of every page when a guest
// has an open Pending booking they haven't finished paying. Clicking
// "Resume" calls /api/bookings/:id/resume-payment (or the guest-token
// variant) to mint a fresh PayMongo session and opens it in a popup.
//
// Invisible when no context exists — mounted globally in App so it
// follows the user across navigations. The ✕ button dismisses the
// context locally but does NOT cancel the booking — the backend's
// 15-min sweep handles that if the guest never comes back.
export default function PendingPaymentBanner() {
  const pending = usePendingPayment();
  const [opening, setOpening] = useState(false);
  const [error,   setError]   = useState('');

  if (!pending) return null;

  async function handleResume() {
    setOpening(true);
    setError('');
    try {
      // Guest-token bookings use the public endpoint; authed bookings
      // use the per-id one. Shape differs only in URL + body.
      const res = pending.guestToken
        ? await api.post('/api/guest-resume-payment', {
            guest_token: pending.guestToken,
            pay_full:    Boolean(pending.payFull),
          })
        : await api.post(`/api/bookings/${pending.bookingId}/resume-payment`, {
            pay_full: Boolean(pending.payFull),
          });

      const url = res?.data?.checkout_url;
      if (!url) throw new Error('No checkout URL returned');

      // Open in a new tab — can't reconnect to the original popup since
      // that window is long gone by the time this banner is clicked.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err?.response?.data?.message
        ?? 'Could not reopen payment. The booking may have expired.';
      setError(msg);
      // If the server says it's no longer Pending (422), the context
      // is stale — drop it so the banner doesn't keep pestering.
      if (err?.response?.status === 422) {
        clearPendingPayment();
      }
    } finally {
      setOpening(false);
    }
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-sm"
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
          {error && (
            <p className="text-xs text-rose-600 mt-1" role="alert">{error}</p>
          )}
          <button
            type="button"
            onClick={handleResume}
            disabled={opening}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-60"
          >
            {opening
              ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" />Opening…</>
              : <><i className="fas fa-arrow-right-to-bracket" aria-hidden="true" />Resume payment</>}
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
