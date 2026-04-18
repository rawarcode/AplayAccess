import { useState, useEffect, useCallback } from 'react';
import { getAdminMessages, getAdminReviews } from '../lib/adminApi';
import { getFdBookings } from '../lib/frontdeskApi';
import { localDateStr } from '../lib/format';

const POLL_MS = 20_000; // 20 seconds — unified polling cadence across the app

const todayStr = () => localDateStr();

/**
 * Polls messages, bookings, and rooms every 30 s and returns notification counts + items.
 * Designed to be called once per portal shell (AdminShell / frontdesk Sidebar) and shared
 * downward via NotificationContext — not called in leaf components.
 */
// Bookings whose scheduled checkout is this many minutes (or less) away
// get the amber "Checkout soon" heads-up. 30 minutes gives staff time to
// prep the room, remind the guest, or offer a stay extension before the
// deadline — avoiding the scramble that triggers the overdue notification.
const CHECKOUT_SOON_WINDOW_MIN = 30;

// Reviews created within this many days count as "new" for the awareness
// notification. 7 days matches a typical weekly check-in cadence — longer
// lets stale reviews linger, shorter risks owners missing one over a
// weekend. Separate from moderation-queue counts (which look at status).
const NEW_REVIEW_WINDOW_DAYS = 7;

const DEFAULT_PATHS = {
  pendingBookings:  '/owner/transactions?status=Pending',
  messages:         '/owner/messages',
  arrivals:         '/owner/transactions?status=Confirmed',
  soonCheckouts:    '/owner/transactions?status=Checked+In',
  overdueCheckouts: '/owner/transactions?status=Checked+In',
};

export function useStaffNotifications(paths = {}) {
  const p = { ...DEFAULT_PATHS, ...paths };
  const [counts, setCounts] = useState({
    unreadMessages:   0,
    pendingBookings:  0,
    todayArrivals:    0,
    newReviews:       0,
    pendingReviews:   0,
    soonCheckouts:    0,
    overdueCheckouts: 0,
  });
  const [items, setItems] = useState([]);

  const poll = useCallback(async () => {
    const today = todayStr();

    const [msgRes, bkRes, rvRes] = await Promise.allSettled([
      getAdminMessages(),
      getFdBookings(),
      getAdminReviews(),
    ]);

    const threads  = msgRes.status === 'fulfilled' ? (msgRes.value?.data?.data  ?? []) : [];
    const bookings = bkRes.status  === 'fulfilled' ? (bkRes.value  ?? [])             : [];
    const reviews  = rvRes.status  === 'fulfilled' ? (rvRes.value?.data?.data ?? rvRes.value?.data ?? []) : [];

    const unreadMessages  = threads.filter(t => !t.is_read).length;
    const pendingBookings = bookings.filter(b => b.status === 'Pending').length;
    const todayArrivals   = bookings.filter(
      b => b.checkIn?.slice(0, 10) === today && b.status === 'Confirmed'
    ).length;
    const now = new Date();
    const soonWindowMs = CHECKOUT_SOON_WINDOW_MIN * 60 * 1000;
    let overdueCheckouts = 0;
    let soonCheckouts    = 0;
    for (const b of bookings) {
      if (b.status !== 'Checked In' || !b.checkOut) continue;
      const co = new Date(String(b.checkOut).replace(' ', 'T'));
      if (isNaN(co.getTime())) continue;
      const msUntil = co.getTime() - now.getTime();
      if (msUntil <= 0)                              overdueCheckouts++;
      else if (msUntil <= soonWindowMs)              soonCheckouts++;
    }
    // Reviews carry awareness (new this week) AND moderation-queue
    // (status=Pending) semantics separately. Most submissions default to
    // Approved so pendingReviews is usually 0 — that's fine; the
    // "N new reviews" count covers the "review just came in" case even
    // when moderation is off. Case-insensitive status comparison guards
    // against the DB storing 'Pending' while older code used 'pending'.
    const newReviewCutoffMs = now.getTime() - NEW_REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    let newReviews = 0;
    let pendingReviews = 0;
    if (Array.isArray(reviews)) {
      for (const r of reviews) {
        const created = r.createdAt ? new Date(r.createdAt) : (r.date ? new Date(r.date) : null);
        if (created && !isNaN(created.getTime()) && created.getTime() >= newReviewCutoffMs) {
          newReviews++;
        }
        if (String(r.status ?? '').toLowerCase() === 'pending') pendingReviews++;
      }
    }

    setCounts({ unreadMessages, pendingBookings, todayArrivals, newReviews, pendingReviews, soonCheckouts, overdueCheckouts });

    const next = [];
    if (pendingBookings > 0)
      next.push({
        id: 'pending', icon: 'fa-clock', color: 'yellow',
        label: `${pendingBookings} pending booking${pendingBookings !== 1 ? 's' : ''} need approval`,
        path: p.pendingBookings,
      });
    if (unreadMessages > 0)
      next.push({
        id: 'msgs', icon: 'fa-envelope', color: 'blue',
        label: `${unreadMessages} unread message${unreadMessages !== 1 ? 's' : ''}`,
        path: p.messages,
      });
    if (todayArrivals > 0)
      next.push({
        id: 'arrivals', icon: 'fa-plane-arrival', color: 'green',
        label: `${todayArrivals} guest arrival${todayArrivals !== 1 ? 's' : ''} today`,
        path: p.arrivals,
      });
    if (overdueCheckouts > 0)
      next.push({
        id: 'overdue', icon: 'fa-exclamation-triangle', color: 'red',
        label: `${overdueCheckouts} overdue checkout${overdueCheckouts !== 1 ? 's' : ''}`,
        path: p.overdueCheckouts,
      });
    // Amber-tier signal: amber is between neutral info (blue/green) and
    // urgent action (red), which matches the "act soon, not now" vibe.
    // Shown AFTER overdue so overdue sits on top when both exist.
    if (soonCheckouts > 0)
      next.push({
        id: 'soon', icon: 'fa-clock', color: 'yellow',
        label: `${soonCheckouts} checkout${soonCheckouts !== 1 ? 's' : ''} in <${CHECKOUT_SOON_WINDOW_MIN} min`,
        path: p.soonCheckouts,
      });
    if (pendingReviews > 0 && p.reviews)
      next.push({
        id: 'reviews', icon: 'fa-star', color: 'yellow',
        label: `${pendingReviews} review${pendingReviews !== 1 ? 's' : ''} pending approval`,
        path: p.reviews,
      });
    // Awareness notification — fires when a review lands regardless of
    // whether moderation is on. Keeps owners in the loop even when
    // reviews auto-approve (the default). Pending-approval notification
    // above still fires when moderation IS on.
    if (newReviews > 0 && p.reviews)
      next.push({
        id: 'new-reviews', icon: 'fa-star', color: 'yellow',
        label: `${newReviews} new review${newReviews !== 1 ? 's' : ''} this week`,
        path: p.reviews,
      });

    setItems(next);
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const total = counts.unreadMessages + counts.pendingBookings + counts.todayArrivals + counts.newReviews + counts.pendingReviews + counts.soonCheckouts + counts.overdueCheckouts;

  return { counts, items, total, refresh: poll };
}
