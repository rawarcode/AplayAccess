import { fmtMoney } from '../../lib/format';

// Fallback entrance-fee rates matching Setting::pricing() defaults —
// used when the caller doesn't (or can't) pass live rates through.
// '24hr-pm' is kept for legacy bookings created before the flexible
// 24hr start-hour; priced the same as '24hr'.
const FALLBACK_RATES = { day: 50, night: 80, '24hr': 100, '24hr-pm': 100 };

// Uses the backend-persisted entranceFee when it's non-zero (set at
// check-in), otherwise computes guests × per-head rate so
// Pending / Confirmed rows don't silently render at ₱0. Mirrors the
// calcEntrance used inside Billing.jsx and Bookings.jsx so the pill
// matches whatever the parent table would show.
function calcEntrance(b, rates = FALLBACK_RATES) {
  if (b?.entranceFee != null && Number(b.entranceFee) > 0) return Number(b.entranceFee);
  const rate = rates[b?.bookingType ?? 'day'] ?? 50;
  return Number(b?.guests ?? 1) * rate;
}

// ─── PaymentPill ─────────────────────────────────────────────────────────────
// Single shape across every state so a column of these reads
// apples-to-apples. Carries the money amount inline in every state so
// "how much?" never requires opening the detail drawer:
//
//   Paid ₱X       — booking is fully paid (emerald)
//   Collected ₱X  — booking checked out, payment finalised (emerald)
//   Due ₱X        — outstanding balance (sky)
//   Due ₱X (₱Y paid) — partial payment landed, balance remaining (sky)
//   Forfeited ₱X  — cancelled WITH paid_amount > 0 (rose)
//   No payment    — cancelled with nothing collected (slate)
//
// Shared between Billing table's "Payment" column and Bookings table's
// payment column so staff moving between the two pages see consistent
// language and colors.
export default function PaymentPill({ booking, entranceRates }) {
  const paid  = Number(booking?.paidAmount ?? 0);
  const grand = Number(booking?.total ?? 0) + calcEntrance(booking, entranceRates);

  // Derive "fully paid" from math, not from the backend flag. There was a
  // bug where checkIn updated entrance_fee without re-deriving
  // booking.fully_paid, leaving flag=true while paid_amount < grand total.
  // The pill then rendered "Paid ₱<room-only>" because it trusted the
  // stale flag. Computing from paid vs grand keeps the display honest
  // even if some future mutation re-introduces the drift.
  // 0.01 tolerance handles float noise (matches Booking::computeFullyPaid).
  const isFullyPaid = paid + 0.01 >= grand && grand > 0;

  if (booking?.status === 'Completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
        <i className="fas fa-check text-[10px]" aria-hidden="true"></i>
        Collected {fmtMoney(paid)}
      </span>
    );
  }
  if (booking?.status === 'Cancelled') {
    // Two flavors: the guest actually paid something before cancelling
    // (forfeited revenue — rose) vs they abandoned before any money
    // cleared (neutral — slate). Using reservation_fee as the amount
    // here was a bug: that column is the quoted upfront charge, not
    // proof of collection, so it mis-labeled abandoned cancellations
    // as forfeited-paid at the quoted 20%.
    if (paid > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
          <i className="fas fa-ban text-[10px]" aria-hidden="true"></i>
          Forfeited {fmtMoney(paid)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
        <i className="fas fa-circle-minus text-[10px]" aria-hidden="true"></i>
        No payment
      </span>
    );
  }
  if (isFullyPaid) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
        <i className="fas fa-check text-[10px]" aria-hidden="true"></i>
        Paid {fmtMoney(paid)}
      </span>
    );
  }
  const due = Math.max(0, grand - paid);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
      <i className="fas fa-coins text-[10px]" aria-hidden="true"></i>
      Due {fmtMoney(due)}
      {paid > 0 && (
        <span className="text-[10px] font-normal text-sky-700/80">
          ({fmtMoney(paid)} paid)
        </span>
      )}
    </span>
  );
}
