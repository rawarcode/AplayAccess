// localStorage-backed "pending payment" context shared between
// BookingModal and the floating PendingPaymentBanner. Lets a guest
// close the modal (or the whole tab) mid-payment and still find
// their way back via the banner that persists on every page.
//
// Shape:
//   { bookingId, resId, roomName, guestToken?, payFull, expiresAt }
//
// expiresAt is an ISO timestamp for when the booking's 15-min payment
// window runs out; the banner uses it to hide itself once the server
// would have auto-cancelled the booking anyway. guestToken is only
// present for no-account bookings (uses the guest resume endpoint).
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'aplaya_pending_payment_v1';
// How long the banner trusts a pending-payment context before hiding
// itself. Matches the backend's stale-Pending sweep window so we don't
// show a "resume" button pointing at a booking the server has already
// cancelled.
const PENDING_TTL_MINUTES = 15;

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.bookingId) return null;
    if (obj.expiresAt && new Date(obj.expiresAt).getTime() < Date.now()) {
      // TTL expired — self-cleanup so the banner doesn't keep rendering
      // a stale entry after the backend has already swept it.
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

export function savePendingPayment(context) {
  if (!context || !context.bookingId) return;
  const expiresAt = context.expiresAt
    ?? new Date(Date.now() + PENDING_TTL_MINUTES * 60 * 1000).toISOString();
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...context, expiresAt })
    );
    // Broadcast to other tabs + our own listeners. The 'storage' event
    // only fires cross-tab, so trigger a local custom event too.
    window.dispatchEvent(new Event('aplaya:pending-payment-changed'));
  } catch {
    /* quota exceeded / disabled — noop, banner just won't show */
  }
}

export function clearPendingPayment() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('aplaya:pending-payment-changed'));
  } catch {
    /* ignore */
  }
}

export function getPendingPayment() {
  return read();
}

// React hook that re-reads the context whenever it changes (local or
// cross-tab). Used by the banner so saving / clearing from BookingModal
// immediately reflects across the app.
export default function usePendingPayment() {
  const [pending, setPending] = useState(() => read());

  useEffect(() => {
    const refresh = () => setPending(read());
    window.addEventListener('storage', refresh);
    window.addEventListener('aplaya:pending-payment-changed', refresh);
    // Re-check every 30 s so the banner hides itself when the TTL
    // passes, even without any user activity.
    const id = setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('aplaya:pending-payment-changed', refresh);
      clearInterval(id);
    };
  }, []);

  return pending;
}
