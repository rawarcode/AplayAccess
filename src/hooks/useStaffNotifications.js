import { useState, useEffect, useCallback } from 'react';
import { getAdminMessages } from '../lib/adminApi';
import { getFdBookings, getFdRooms } from '../lib/frontdeskApi';

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
  pendingBookings: '/admin/transactions',
  messages:        '/admin/messages',
  arrivals:        '/frontdesk/reservation',
  rooms:           '/frontdesk/rooms',
};

export function useStaffNotifications(paths = {}) {
  const p = { ...DEFAULT_PATHS, ...paths };
  const [counts, setCounts] = useState({
    unreadMessages:  0,
    pendingBookings: 0,
    todayArrivals:   0,
    dirtyRooms:      0,
  });
  const [items, setItems] = useState([]);

  const poll = useCallback(async () => {
    const today = todayStr();

    const [msgRes, bkRes, rmRes] = await Promise.allSettled([
      getAdminMessages(),
      getFdBookings(),
      getFdRooms(),
    ]);

    const threads  = msgRes.status === 'fulfilled' ? (msgRes.value?.data?.data  ?? []) : [];
    const bookings = bkRes.status  === 'fulfilled' ? (bkRes.value  ?? [])             : [];
    const rooms    = rmRes.status  === 'fulfilled' ? (rmRes.value  ?? [])             : [];

    const unreadMessages  = threads.filter(t => !t.is_read).length;
    const pendingBookings = bookings.filter(b => b.status === 'Pending').length;
    const todayArrivals   = bookings.filter(
      b => b.checkIn?.slice(0, 10) === today && b.status === 'Confirmed'
    ).length;
    const dirtyRooms = rooms.filter(
      r => r.housekeeping_status === 'dirty' || r.housekeeping_status === 'cleaning'
    ).length;

    setCounts({ unreadMessages, pendingBookings, todayArrivals, dirtyRooms });

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
    if (dirtyRooms > 0)
      next.push({
        id: 'rooms', icon: 'fa-broom', color: 'orange',
        label: `${dirtyRooms} room${dirtyRooms !== 1 ? 's' : ''} need housekeeping`,
        path: p.rooms,
      });

    setItems(next);
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const total = counts.unreadMessages + counts.pendingBookings + counts.todayArrivals + counts.dirtyRooms;

  return { counts, items, total, refresh: poll };
}
