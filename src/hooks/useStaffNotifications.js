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
    const pendingReviews = Array.isArray(reviews)
      ? reviews.filter(r => r.status === 'pending').length
      : 0;

    setCounts({ unreadMessages, pendingBookings, todayArrivals, pendingReviews, soonCheckouts, overdueCheckouts });

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

    setItems(next);
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const total = counts.unreadMessages + counts.pendingBookings + counts.todayArrivals + counts.pendingReviews + counts.soonCheckouts + counts.overdueCheckouts;

  return { counts, items, total, refresh: poll };
}
