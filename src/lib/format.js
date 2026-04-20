// src/lib/format.js
// Shared formatting helpers — locale: en-PH, currency: PHP (₱)

/**
 * "2026-03-20 07:00" → "Mar 20, 2026"
 */
export function fmtDate(dt) {
  if (!dt) return '—';
  const d = new Date(String(dt).replace(' ', 'T'));
  if (isNaN(d)) return String(dt);
  return d.toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * "2026-03-20 07:00" → "7:00 AM"
 */
export function fmtTime(dt) {
  if (!dt) return '—';
  const d = new Date(String(dt).replace(' ', 'T'));
  if (isNaN(d)) return String(dt);
  return d.toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/**
 * "2026-03-20 07:00" → "Mar 20, 2026, 7:00 AM"
 */
export function fmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(String(dt).replace(' ', 'T'));
  if (isNaN(d)) return String(dt);
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/**
 * 1500 → "₱1,500.00"
 */
export function fmtMoney(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

/**
 * Render a guest's email for staff-facing lists.
 *
 * When a user self-deletes their account, the backend anonymizes the
 * row — email becomes `deleted_<id>@removed.local`. The booking row
 * sticks around for financial history (forfeited revenue, past stays)
 * but the PII is gone. Showing the raw pseudo-address looks like a
 * leaked DB internal, so we collapse it to "(account deleted)".
 *
 * Returns '—' for missing / empty emails too.
 */
export function fmtGuestEmail(email) {
  if (!email) return '—';
  if (/@removed\.local$/i.test(email)) return '(account deleted)';
  return email;
}

/**
 * Date → "YYYY-MM-DD" in the user's LOCAL timezone.
 *
 * Prefer this over `toISOString().slice(0, 10)` whenever the result
 * represents a calendar date (what day is it / which day is this booking).
 * toISOString() emits UTC, which drifts from the local wall-clock date
 * by up to the offset — in Asia/Manila (UTC+8) that's 8 hours, so
 * between 00:00 and 07:59 local, UTC still shows the previous day.
 */
export function localDateStr(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
