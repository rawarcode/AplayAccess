import { useState, useEffect, useCallback, useRef } from 'react';
import { getAdminMessages, getAdminReviews, getAdminContacts } from '../lib/adminApi';
import { getFdBookings } from '../lib/frontdeskApi';
import { localDateStr } from '../lib/format';
import { playMessageChime } from '../lib/notificationSound';

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
// notification — auto-decay safety net for the never-visited case.
// When the owner visits /owner/reviews we timestamp the visit, and from
// that point the "new" cutoff is whichever is MORE RECENT: the visit
// or 7 days ago. So visiting the page clears the badge for everything
// currently there.
const NEW_REVIEW_WINDOW_DAYS = 7;

// Browser-local timestamp of when the owner last opened the Reviews page.
// Written by pages/owner/Reviews.jsx on mount. Read here as the "seen
// watermark". Per-device by design — no backend column needed for a
// single-owner capstone, and cross-device drift isn't worth the
// additional API surface.
const REVIEWS_SEEN_KEY = 'aplaya_reviews_last_seen_at';

function getReviewsSeenCutoffMs() {
  try {
    const raw = localStorage.getItem(REVIEWS_SEEN_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

const DEFAULT_PATHS = {
  messages:         '/owner/messages',
  arrivals:         '/owner/transactions?status=Confirmed',
  soonCheckouts:    '/owner/transactions?status=Checked+In',
  overdueCheckouts: '/owner/transactions?status=Checked+In',
  contacts:         '/owner/content?tab=contact',
};

// Pending bookings are transient — they auto-cancel after 5 minutes
// without payment, and staff can't do anything about them in the
// meantime (the guest either pays or abandons). Surfacing them as a
// "needs approval" notification was misleading and created noise
// that staff learned to ignore. Removed.
export function useStaffNotifications(paths = {}) {
  const p = { ...DEFAULT_PATHS, ...paths };
  const [counts, setCounts] = useState({
    unreadMessages:   0,
    unreadContacts:   0,
    todayArrivals:    0,
    arrivedToday:     0,
    currentlyInHouse: 0,
    newReviews:       0,
    pendingReviews:   0,
    soonCheckouts:    0,
    overdueCheckouts: 0,
  });
  const [items, setItems] = useState([]);
  // Chime-on-new-message tracking. First poll after mount establishes
  // a baseline — no chime on initial load, no chime after refreshes.
  // Subsequent polls that return a higher unread-message count play
  // a soft two-tone via notificationSound.playMessageChime.
  const hasPolledOnce          = useRef(false);
  const prevUnreadMessagesRef  = useRef(0);

  const poll = useCallback(async () => {
    const today = todayStr();

    const [msgRes, bkRes, rvRes, ctRes] = await Promise.allSettled([
      getAdminMessages(),
      getFdBookings(),
      getAdminReviews(),
      getAdminContacts(),
    ]);

    const threads   = msgRes.status === 'fulfilled' ? (msgRes.value?.data?.data  ?? []) : [];
    const bookings  = bkRes.status  === 'fulfilled' ? (bkRes.value  ?? [])             : [];
    const reviews   = rvRes.status  === 'fulfilled' ? (rvRes.value?.data?.data ?? rvRes.value?.data ?? []) : [];
    const contacts  = ctRes.status  === 'fulfilled' ? (ctRes.value?.data?.data  ?? []) : [];

    const unreadMessages  = threads.filter(t => !t.is_read).length;
    const unreadContacts  = contacts.filter(c => !c.is_read).length;
    // todayArrivals = Confirmed bookings still pending check-in for today.
    // Drops as guests get checked in (count goes to zero when work is
    // done — the operational signal). arrivedToday is the companion
    // backfill so the dashboard can show "X already arrived" instead
    // of falsely claiming "nothing booked yet".
    const todayArrivals   = bookings.filter(
      b => b.checkIn?.slice(0, 10) === today && b.status === 'Confirmed'
    ).length;
    const arrivedToday    = bookings.filter(
      b => b.checkIn?.slice(0, 10) === today && b.status === 'Checked In'
    ).length;
    const now = new Date();
    const soonWindowMs = CHECKOUT_SOON_WINDOW_MIN * 60 * 1000;
    let overdueCheckouts = 0;
    let soonCheckouts    = 0;
    let currentlyInHouse = 0;
    for (const b of bookings) {
      if (b.status !== 'Checked In' || !b.checkOut || !b.checkIn) continue;
      const ci = new Date(String(b.checkIn).replace(' ', 'T'));
      const co = new Date(String(b.checkOut).replace(' ', 'T'));
      if (isNaN(ci.getTime()) || isNaN(co.getTime())) continue;
      // Same-day early check-in is allowed (Night booking at 6 PM can
      // be checked in at 4 PM for early-arrival accommodation), but
      // the booking's check_in time may still be in the future when
      // we observe it here. Cross-day early check-in is blocked
      // server-side, so the only "future check_in but Checked In"
      // case is same-day early. Either way, treating it as in-house
      // before the stay window opens would falsely inflate
      // currentlyInHouse / soon / overdue, so we skip until the
      // window has actually started.
      if (ci.getTime() > now.getTime()) continue;
      const msUntil = co.getTime() - now.getTime();
      if (msUntil <= 0)                              overdueCheckouts++;
      else                                           currentlyInHouse++;
      if (msUntil > 0 && msUntil <= soonWindowMs)    soonCheckouts++;
    }
    // Reviews carry awareness (new this week) AND moderation-queue
    // (status=Pending) semantics separately. Most submissions default to
    // Approved so pendingReviews is usually 0 — that's fine; the
    // "N new reviews" count covers the "review just came in" case even
    // when moderation is off. Case-insensitive status comparison guards
    // against the DB storing 'Pending' while older code used 'pending'.
    //
    // Cutoff = max(lastSeenVisit, 7-days-ago). Visiting /owner/reviews
    // writes the timestamp to localStorage, which becomes the new
    // baseline — everything older than the visit drops off the badge.
    // The 7-day floor is the auto-decay fallback for owners who never
    // visit the Reviews page.
    const weekAgoMs          = now.getTime() - NEW_REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const seenCutoffMs       = getReviewsSeenCutoffMs();
    const newReviewCutoffMs  = Math.max(seenCutoffMs, weekAgoMs);
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

    // Chime trigger — only on a genuine increase AFTER the first poll.
    // First poll sets the baseline so staff who already have N unread
    // on page open don't get bombarded with chimes. Refresh = new
    // hook instance = new baseline = silent, which is exactly what
    // we want.
    if (hasPolledOnce.current) {
      if (unreadMessages > prevUnreadMessagesRef.current) {
        playMessageChime();
      }
    } else {
      hasPolledOnce.current = true;
    }
    prevUnreadMessagesRef.current = unreadMessages;

    setCounts({ unreadMessages, unreadContacts, todayArrivals, arrivedToday, currentlyInHouse, newReviews, pendingReviews, soonCheckouts, overdueCheckouts });

    const next = [];
    if (unreadMessages > 0)
      next.push({
        id: 'msgs', icon: 'fa-envelope', color: 'blue',
        label: `${unreadMessages} unread message${unreadMessages !== 1 ? 's' : ''}`,
        path: p.messages,
      });
    if (unreadContacts > 0 && p.contacts)
      next.push({
        id: 'contacts', icon: 'fa-envelope-open-text', color: 'blue',
        label: `${unreadContacts} new contact submission${unreadContacts !== 1 ? 's' : ''}`,
        path: p.contacts,
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

  // Visibility-aware polling. Same pattern as the guest-dashboard
  // shell: pause the 20s interval while the tab is hidden so we
  // don't burn battery / API calls on a backgrounded staff machine,
  // and re-fire once on tab-return so the alert strip is fresh
  // before the staff member touches anything.
  useEffect(() => {
    let id = null;
    function start() {
      if (id != null) return;
      id = setInterval(poll, POLL_MS);
    }
    function stop() {
      if (id == null) return;
      clearInterval(id);
      id = null;
    }
    function onVis() {
      if (document.visibilityState === 'visible') { poll(); start(); }
      else { stop(); }
    }
    poll();
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [poll]);

  const total = counts.unreadMessages + counts.unreadContacts + counts.todayArrivals + counts.newReviews + counts.pendingReviews + counts.soonCheckouts + counts.overdueCheckouts;

  return { counts, items, total, refresh: poll };
}
