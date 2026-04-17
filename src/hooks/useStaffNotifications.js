import { useState, useEffect, useCallback } from 'react';
import { getAdminMessages, getAdminReviews } from '../lib/adminApi';
import { getFdBookings } from '../lib/frontdeskApi';

const POLL_MS = 10_000; // 10 seconds

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Polls messages, bookings, and rooms every 30 s and returns notification counts + items.
 * Designed to be called once per portal shell (AdminShell / frontdesk Sidebar) and shared
 * downward via NotificationContext — not called in leaf components.
 */
const DEFAULT_PATHS = {
  pendingBookings: '/owner/transactions?status=Pending',
  messages:        '/owner/messages',
  arrivals:        '/owner/transactions?status=Confirmed',
};

export function useStaffNotifications(paths = {}) {
  const p = { ...DEFAULT_PATHS, ...paths };
  const [counts, setCounts] = useState({
    unreadMessages:  0,
    pendingBookings: 0,
    todayArrivals:   0,
    pendingReviews:  0,
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
    const pendingReviews = Array.isArray(reviews)
      ? reviews.filter(r => r.status === 'pending').length
      : 0;

    setCounts({ unreadMessages, pendingBookings, todayArrivals, pendingReviews });

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

  const total = counts.unreadMessages + counts.pendingBookings + counts.todayArrivals + counts.pendingReviews;

  return { counts, items, total, refresh: poll };
}
