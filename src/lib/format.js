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
