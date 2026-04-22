// src/pages/dashboard/MyBookings.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { getBookings, cancelBooking, downloadReceipt } from "../../lib/bookingApi.js";
import { submitReview } from "../../lib/reviewApi.js";
import { api } from "../../lib/api.js";
import Modal from "../../components/modals/Modal.jsx";
import BookingModal from "../../components/modals/BookingModal.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { Helmet } from "react-helmet-async";
import { fmtDateTime } from "../../lib/format";

// Map a MyBookings row (list shape) to the resumeBooking prop shape
// that BookingModal expects. Centralised so row-click + action button
// + entry-point auto-resume stay in sync.
function toResumeBooking(b) {
  if (!b) return null;
  const typeLabels = {
    day: 'Day Visit (6 AM – 6 PM)',
    night: 'Night Stay (6 PM – 7 AM)',
    '24hr': '24 Hours',
    '24hr-pm': '24 Hours',
  };
  return {
    bookingId:        b.bookingId,
    resId:            b.id,                // display string APL-...
    roomName:         b.roomType,
    bookingType:      b.bookingType,
    bookingTypeLabel: typeLabels[b.bookingType] ?? null,
    checkIn:          b.checkIn ? fmtDateTime(b.checkIn) : null,
    checkOut:         b.checkOut ? fmtDateTime(b.checkOut) : null,
    guests:           b.guests ?? 1,
    total:            Number(b.total ?? 0),
    reservationFee:   Number(b.reservationFee ?? 0),
    payFull:          false,                // match original reservation-only default
    guestToken:       null,                 // MyBookings is authed-only
  };
}

// ─── Gate entrance fee helper ────────────────────────────────────────────────
// Matches Setting::pricing() defaults on the backend. Used to show an
// estimate BEFORE check-in (when entrance_fee on the row is still 0
// because staff hasn't collected it yet). Prevents the "Fully Paid →
// surprise at the gate" complaint.
const ENTRANCE_RATE_FALLBACK = { day: 50, night: 80, '24hr': 100, '24hr-pm': 100 };

function effectiveEntrance(b, rates = ENTRANCE_RATE_FALLBACK) {
  const stored = Number(b?.entranceFee ?? 0);
  if (stored > 0) return stored;
  const rate = rates[b?.bookingType ?? 'day'] ?? 50;
  return Number(b?.guests ?? 1) * rate;
}

// True when staff has finalised the entrance fee (check-in has happened
// or the booking is completed). Before that, any entrance figure shown
// is an estimate that will scale with real arrival count.
function entranceIsFinal(b) {
  return Number(b?.entranceFee ?? 0) > 0
    || b?.status === 'Checked In'
    || b?.status === 'Completed';
}

// ─── Special requests formatter ───────────────────────────────────────────────
function renderSpecialRequests(text) {
  if (!text) return null;
  const parts = text.split(/,\s*(?=(?:Walk-in|Phone|Type|Email|Name)\s*:)/i);
  const parsed = parts.length > 1
    ? parts.map(p => { const [k, ...v] = p.split(':'); return [k.trim(), v.join(':').trim()]; })
    : null;
  const icons = { 'walk-in': 'fa-user', phone: 'fa-phone', email: 'fa-envelope', type: 'fa-clock' };
  return (
    <div className="pt-3 border-t border-slate-200">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
        {parsed ? "Walk-in Details" : "Special Requests"}
      </p>
      {parsed ? (
        <div className="space-y-2 bg-slate-50 rounded-lg p-3">
          {parsed.map(([key, val]) => (
            <div key={key} className="flex items-start gap-2">
              <i className={`fas ${icons[key.toLowerCase()] || 'fa-info-circle'} text-slate-400 w-4 text-center text-xs mt-0.5`} />
              <span className="text-xs text-slate-500 min-w-[56px] shrink-0">{key}</span>
              <span className="text-sm text-slate-700 font-medium break-all">{val}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{text}</p>
      )}
    </div>
  );
}

// ─── Status helpers ──────────────────────────────────────────────────────────
// No client-side "Expired" concept: the backend stale-Pending sweep is
// the single source of truth. While a booking reads status=Pending, the
// guest can still complete payment (even if the PayMongo session was
// closed) via the Continue Payment action. Once the sweep fires (15 min
// after creation), the backend flips the row to Cancelled and we render
// Cancelled. No flag-racing on the client.
const STATUS_STYLES = {
  Pending:      "text-amber-800 bg-amber-100",
  Confirmed:    "text-sky-700 bg-sky-100",
  "Checked In": "text-violet-700 bg-violet-100",
  Completed:    "text-emerald-700 bg-emerald-100",
  Cancelled:    "text-rose-700 bg-rose-100",
};

function statusPill(status) {
  const colors = STATUS_STYLES[status] || "text-slate-700 bg-slate-100";
  return `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`;
}

function StatusLabel({ booking }) {
  const icons = {
    Pending: "fa-clock", Confirmed: "fa-check-circle", "Checked In": "fa-door-open",
    Completed: "fa-flag-checkered", Cancelled: "fa-ban",
  };
  return (
    <span className={statusPill(booking.status)}>
      {icons[booking.status] && <i className={`fas ${icons[booking.status]} text-[10px]`} />}
      {booking.status}
    </span>
  );
}

// ─── Star rating picker ───────────────────────────────────────────────────────
function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button"
          onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)} aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`} className="text-2xl leading-none focus:outline-none focus:ring-2 focus:ring-brand/50">
          <i className={`fas fa-star ${(hovered || value) >= star ? "text-amber-400" : "text-slate-300"}`} />
        </button>
      ))}
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const FILTERS = [
  { key: "all",        label: "All" },
  { key: "Pending",    label: "Pending",    icon: "fa-clock" },
  { key: "Confirmed",  label: "Confirmed",  icon: "fa-check-circle" },
  { key: "Checked In", label: "Checked In", icon: "fa-door-open" },
  { key: "Completed",  label: "Completed",  icon: "fa-flag-checkered" },
  { key: "Cancelled",  label: "Cancelled",  icon: "fa-ban" },
];

// ─── Cancel confirm modal ─────────────────────────────────────────────────────
function CancelModalContent({ booking, reservationFeePct, onClose, onConfirmed }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError]           = useState("");

  const feePct = Number(reservationFeePct || 20);
  const feeAmount = Math.round(Number(booking.total || 0) * feePct / 100);

  async function handleConfirm() {
    setError("");
    setCancelling(true);
    try {
      await cancelBooking(booking.bookingId);
      onConfirmed(booking.bookingId);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to cancel booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center">
            <i className="fas fa-ban text-rose-600 text-sm" />
          </span>
          <h3 className="text-lg font-bold text-slate-900">Cancel Booking</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times" /></button>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-slate-700">
          Are you sure you want to cancel booking{" "}
          <span className="font-semibold text-slate-900">{booking.id}</span>?
        </p>
        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 text-sm text-amber-800">
          The {feePct}% reservation fee (approx. ₱{feeAmount.toLocaleString()}) is{" "}
          <span className="font-medium">non-refundable</span> upon cancellation.
        </div>
        {error && (
          <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={cancelling}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 disabled:opacity-60">
            Keep Booking
          </button>
          <button type="button" onClick={handleConfirm} disabled={cancelling}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium">
            {cancelling ? "Cancelling..." : "Yes, Cancel"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Review modal ─────────────────────────────────────────────────────────────
function ReviewModalContent({ booking, onClose, onSubmitted }) {
  const [rating, setRating]   = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const hasDraft = rating > 0 || !!comment.trim();
  function guardedClose() { if (hasDraft && !confirm("Discard your review?")) return; onClose?.(); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) { setError("Please select a star rating."); return; }
    setError("");
    setSaving(true);
    try {
      await submitReview({ booking_id: booking.bookingId, rating, comment });
      onSubmitted(booking.bookingId, { rating, comment });
      setSuccess(true);
      setTimeout(onClose, 2500);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to submit review. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-check text-emerald-600 text-2xl" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Review Submitted!</h3>
        <p className="text-slate-500 text-sm mb-1">
          Thank you for your {rating}<i className="fas fa-star text-amber-400 mx-0.5" /> rating on <span className="font-medium">{booking.roomType}</span>.
        </p>
        <p className="text-slate-400 text-xs">Your review is pending approval and will appear shortly.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <i className="fas fa-star text-amber-600 text-sm" />
          </span>
          <h3 className="text-lg font-bold text-slate-900">Write a Review</h3>
        </div>
        <button onClick={guardedClose} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times" /></button>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <p className="text-sm text-slate-600">
          Reviewing: <span className="font-medium">{booking.roomType}</span>
          <br />
          <span className="text-slate-400">{fmtDateTime(booking.checkIn)} – {fmtDateTime(booking.checkOut)}</span>
        </p>

        {error && (
          <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Your Rating</label>
          <StarRating value={rating} onChange={setRating} />
          {rating > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Comment (optional)</label>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-sky-500 focus:border-sky-500 text-sm" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={guardedClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-700">Cancel</button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium">
            {saving ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </form>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MyBookings() {
  const [toast, showToast, clearToast, toastType, toastAction] = useToast();

  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState("");
  const [filter, setFilter]         = useState("all");
  const [reviewing, setReviewing]   = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [selected, setSelected]     = useState(null);
  // Resume-payment flow — set when the user clicks a Pending row or
  // the Continue Payment action button. Feeds BookingModal's
  // resumeBooking prop. Null means the modal is closed.
  const [resuming, setResuming]     = useState(null);
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const [checkingIn, setCheckingIn]     = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [reservationFeePct, setReservationFeePct] = useState(20);

  function load() {
    setLoading(true);
    setLoadError("");
    getBookings()
      .then(setItems)
      .catch(() => setLoadError("Failed to load bookings."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.get("/api/pricing")
      .then(r => setReservationFeePct(Number(r.data?.data?.reservation_fee_pct ?? 20)))
      .catch(() => {});
  }, []);

  // Deep-link auto-resume — PendingPaymentBanner navigates here with
  // /dashboard/bookings?resume=<bookingId> when the guest closed the
  // PayMongo window mid-payment. We wait for items to load, find the
  // matching Pending row, open BookingModal in resume mode, and strip
  // the query param so a page refresh doesn't re-trigger the modal.
  useEffect(() => {
    const resumeId = searchParams.get('resume');
    if (!resumeId || loading) return;
    const booking = items.find(b => String(b.bookingId) === String(resumeId));
    if (booking && booking.status === 'Pending') {
      setResuming(toResumeBooking(booking));
    }
    navigate('/dashboard/bookings', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loading]);

  // Poll every 5s while any booking is in an active state
  const itemsRef = useRef(items);
  itemsRef.current = items; // sync ref without extra effect
  useEffect(() => {
    const ACTIVE = ["Pending", "Confirmed", "Checked In"];
    let active = true;
    const id = setInterval(() => {
      if (!itemsRef.current.some(b => ACTIVE.includes(b.status))) return;
      getBookings().then(fresh => { if (active) setItems(fresh); }).catch(() => {});
    }, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // Filtered items
  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(b => b.status === filter);
  }, [items, filter]);

  // Filter counts
  const counts = useMemo(() => {
    const c = { all: items.length };
    FILTERS.forEach(f => {
      if (f.key !== "all") c[f.key] = items.filter(b => b.status === f.key).length;
    });
    return c;
  }, [items]);

  async function handleCheckIn(b) {
    setCheckingIn(true);
    try {
      await api.post(`/api/bookings/${b.bookingId}/checkin`);
      setItems(prev => prev.map(x => x.bookingId === b.bookingId ? { ...x, status: "Checked In" } : x));
      setSelected(prev => prev ? { ...prev, status: "Checked In" } : null);
    } catch {
      // silent — polling will catch it
    } finally {
      setCheckingIn(false);
    }
  }

  function handleCancelConfirmed(bookingId) {
    setItems(prev => prev.map(b => b.bookingId === bookingId ? { ...b, status: "Cancelled" } : b));
    showToast("Booking cancelled successfully.", "success");
  }

  async function handleDownloadReceipt(b) {
    setDownloadingId(b.bookingId);
    try {
      const blob = await downloadReceipt(b.bookingId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${b.id}-receipt.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Failed to download receipt. Please try again.', 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  function handleReviewSubmitted(bookingId, review) {
    setItems(prev => prev.map(b => b.bookingId === bookingId ? { ...b, hasReview: true, review } : b));
    showToast("Review submitted! Thank you.", "success");
  }

  // ─── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Helmet><title>My Bookings — Aplaya Beach Resort</title></Helmet>
        {/* Header skeleton */}
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-200" />
          <div className="space-y-2">
            <div className="h-6 bg-slate-200 rounded w-40" />
            <div className="h-3 bg-slate-100 rounded w-56" />
          </div>
        </div>
        {/* Filter pills skeleton */}
        <div className="flex gap-2 animate-pulse">
          {[60, 70, 80, 80, 80, 80].map((w, i) => (
            <div key={i} className="h-8 bg-slate-100 rounded-full" style={{ width: w }} />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
          <div className="bg-white px-6 py-3 flex gap-6 border-b border-slate-200">
            {[80, 100, 120, 60, 70, 70, 80].map((w, i) => (
              <div key={i} className="h-3 bg-slate-200 rounded animate-pulse" style={{ width: w }} />
            ))}
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="px-6 py-4 flex gap-6 border-t border-slate-100 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-20" />
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="h-4 bg-slate-100 rounded w-32" />
              <div className="h-4 bg-slate-100 rounded w-10" />
              <div className="h-4 bg-slate-200 rounded w-16" />
              <div className="h-5 bg-slate-200 rounded-full w-16" />
              <div className="h-4 bg-slate-100 rounded w-14" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Helmet><title>My Bookings — Aplaya Beach Resort</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* ── Page header with icon badge ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-sky-100 flex items-center justify-center">
            <i className="fas fa-calendar-alt text-sky-600 text-lg" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Bookings</h1>
            <p className="text-slate-500 text-sm">View and manage your reservations</p>
          </div>
        </div>
      </div>

      {/* ── Load error banner ── */}
      {loadError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <i className="fas fa-exclamation-circle text-rose-500" />
          <span className="text-sm text-rose-700 flex-1">{loadError}</span>
          <button onClick={load} className="text-sm font-medium text-rose-700 hover:text-rose-800 underline">Retry</button>
        </div>
      )}

      {/* ── Status filter tabs ── */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => {
          const active = filter === f.key;
          const count = counts[f.key] || 0;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all
                ${active
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {f.icon && <i className={`fas ${f.icon} text-[11px]`} />}
              {f.label}
              <span className={`ml-0.5 text-xs ${active ? "text-sky-200" : "text-slate-400"}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Table (desktop) ── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 hidden md:table">
            <thead className="bg-white">
              <tr>
                {["Booking ID", "Room Type", "Visit Slot", "Guests", "Total", "Status", "Actions"].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filtered.map(b => {
                // Pending rows are entry points to resume-payment — clicking
                // anywhere on the row opens BookingModal in resume mode
                // instead of the read-only details drawer. Matches the
                // "click the pending booking to continue" UX.
                const onRowActivate = () => b.status === 'Pending'
                  ? setResuming(toResumeBooking(b))
                  : setSelected(b);
                return (
                <tr key={b.id} role="button" tabIndex={0}
                    onClick={onRowActivate}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowActivate(); }}}
                    className={`cursor-pointer hover:bg-slate-50 transition-colors ${b.status === 'Pending' ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">{b.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{b.roomType}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                    <div>{fmtDateTime(b.checkIn)}</div>
                    <div className="text-slate-400 text-xs">→ {fmtDateTime(b.checkOut)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{b.guests}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                    {(() => {
                      // Pre-check-in, b.entranceFee = 0. Use effectiveEntrance
                      // so the grand total reflects the REAL all-in cost,
                      // not just the room. Mark the figure "est." so guests
                      // know it scales with actual arrivals.
                      const entrance    = effectiveEntrance(b);
                      const entranceFinal = entranceIsFinal(b);
                      const grandTotal  = Number(b.total ?? 0) + entrance;
                      const outstanding = Math.max(0, grandTotal - Number(b.paidAmount ?? 0));
                      return (
                        <>
                          <div className="font-medium">₱{grandTotal.toLocaleString()}</div>
                          {entrance > 0 && (
                            <div className="text-[11px] text-slate-400">
                              incl. ₱{entrance.toLocaleString()} entrance
                              {!entranceFinal && <span className="ml-1 text-amber-600">est.</span>}
                            </div>
                          )}
                          {outstanding > 0 && b.status !== 'Pending' && b.status !== 'Cancelled' && (
                            <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-medium">
                              <i className="fas fa-circle-exclamation text-[10px]"></i>
                              ₱{outstanding.toLocaleString()} owed
                            </div>
                          )}
                          {b.promoCode && Number(b.discount) > 0 && (
                            <div className="mt-0.5 flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                                <i className="fas fa-tag text-[10px]" />{b.promoCode}
                              </span>
                              <span className="text-xs text-emerald-600 font-medium">-₱{Number(b.discount).toLocaleString()}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusLabel booking={b} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      {/* Pending bookings: primary action is Continue Payment
                          (same as clicking the row). Shown first so the CTA
                          is obvious in the actions column. */}
                      {b.status === "Pending" && (
                        <button onClick={() => setResuming(toResumeBooking(b))}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700 font-semibold">
                          <i className="fas fa-arrow-right-to-bracket mr-1" />Continue
                        </button>
                      )}
                      {/* Backend allows self-cancel for Pending + Confirmed;
                          blocks Checked In / Completed / Cancelled. Button
                          visibility mirrors that so the UI doesn't promise
                          an action the API will reject at submit time. */}
                      {(b.status === "Pending" || b.status === "Confirmed") && (
                        <button onClick={() => setCancelling(b)}
                          className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-200">Cancel</button>
                      )}
                      {b.status === "Completed" && !b.hasReview && (
                        <button onClick={() => setReviewing(b)}
                          className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-200">
                          <i className="fas fa-star mr-1" />Review
                        </button>
                      )}
                      {b.status === "Completed" && b.hasReview && (
                        <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg" title={b.review?.comment || ""}>
                          <i className="fas fa-star mr-1" />{b.review?.rating}/5 Reviewed
                        </span>
                      )}
                      {["Confirmed", "Checked In", "Completed"].includes(b.status) && (
                        <button onClick={() => handleDownloadReceipt(b)}
                          disabled={downloadingId === b.bookingId}
                          className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-lg hover:bg-sky-200 disabled:opacity-50">
                          {downloadingId === b.bookingId
                            ? <><i className="fas fa-spinner fa-spin mr-1" />Downloading...</>
                            : <><i className="fas fa-file-pdf mr-1" />Receipt</>}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && !loadError && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <i className="fas fa-calendar-times text-slate-200 text-4xl mb-3 block" />
                    <p className="text-slate-400 text-sm">
                      {filter !== "all" ? `No ${filter.toLowerCase()} bookings.` : "No bookings found."}
                    </p>
                    {filter === "all" && (
                      <Link to="/dashboard?book=1" className="mt-2 inline-block text-xs text-sky-600 hover:underline font-medium">
                        <i className="fas fa-plus mr-1" />Book a stay
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards ── */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 && !loadError && (
            <div className="px-5 py-12 text-center">
              <i className="fas fa-calendar-times text-slate-200 text-4xl mb-3 block" />
              <p className="text-slate-400 text-sm">
                {filter !== "all" ? `No ${filter.toLowerCase()} bookings.` : "No bookings found."}
              </p>
              {filter === "all" && (
                <Link to="/dashboard?book=1" className="mt-2 inline-block text-xs text-sky-600 hover:underline font-medium">
                  <i className="fas fa-plus mr-1" />Book a stay
                </Link>
              )}
            </div>
          )}
          {filtered.map(b => {
            const onCardActivate = () => b.status === 'Pending'
              ? setResuming(toResumeBooking(b))
              : setSelected(b);
            return (
            <div key={b.id} role="button" tabIndex={0} onClick={onCardActivate}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardActivate(); }}}
              className={`bg-white px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors space-y-3 ${b.status === 'Pending' ? 'bg-amber-50/30' : ''}`}>
              {/* Top row: ID + status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">{b.id}</span>
                <StatusLabel booking={b} />
              </div>
              {/* Room + slot */}
              <div>
                <p className="text-sm font-medium text-slate-700">{b.roomType}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {fmtDateTime(b.checkIn)} → {fmtDateTime(b.checkOut)}
                </p>
              </div>
              {/* Bottom: total + actions */}
              <div className="flex items-center justify-between">
                <div>
                  {(() => {
                    const entrance      = effectiveEntrance(b);
                    const entranceFinal = entranceIsFinal(b);
                    const grandTotal    = Number(b.total ?? 0) + entrance;
                    const outstanding   = Math.max(0, grandTotal - Number(b.paidAmount ?? 0));
                    return (
                      <>
                        <span className="text-sm font-semibold text-slate-900">₱{grandTotal.toLocaleString()}</span>
                        {entrance > 0 && (
                          <span className="ml-1 text-[11px] text-slate-400">
                            {entranceFinal ? '(incl. entrance)' : '(incl. est. entrance)'}
                          </span>
                        )}
                        {b.promoCode && Number(b.discount) > 0 && (
                          <span className="ml-2 text-xs text-emerald-600 font-medium">-₱{Number(b.discount).toLocaleString()}</span>
                        )}
                        {outstanding > 0 && b.status !== 'Pending' && b.status !== 'Cancelled' && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-medium">
                            <i className="fas fa-circle-exclamation text-[10px]"></i>
                            ₱{outstanding.toLocaleString()} owed
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {b.status === "Pending" && (
                    <button onClick={() => setResuming(toResumeBooking(b))}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg font-semibold">
                      <i className="fas fa-arrow-right-to-bracket mr-1" />Continue
                    </button>
                  )}
                  {(b.status === "Pending" || b.status === "Confirmed") && (
                    <button onClick={() => setCancelling(b)} className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-lg">Cancel</button>
                  )}
                  {b.status === "Completed" && !b.hasReview && (
                    <button onClick={() => setReviewing(b)} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
                      <i className="fas fa-star mr-1" />Review
                    </button>
                  )}
                  {["Confirmed", "Checked In", "Completed"].includes(b.status) && (
                    <button onClick={() => handleDownloadReceipt(b)} disabled={downloadingId === b.bookingId}
                      className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-lg disabled:opacity-50">
                      <i className={`fas ${downloadingId === b.bookingId ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* ── Resume-payment modal — reuses BookingModal in resume mode.
           Mounted at the page level so clicking a Pending row / Continue
           button opens the same review + PayMongo flow a fresh booking
           uses. onBooked refreshes the list so the newly-paid booking
           flips to Confirmed without waiting on the 5s poll. ── */}
      <BookingModal
        open={!!resuming}
        onClose={() => setResuming(null)}
        rooms={[]}
        resumeBooking={resuming}
        onBooked={() => {
          setResuming(null);
          getBookings().then(fresh => setItems(fresh)).catch(() => {});
        }}
      />

      {/* ── Cancel modal (shared Modal) ── */}
      <Modal open={!!cancelling} onClose={() => setCancelling(null)} maxWidth="max-w-sm">
        {cancelling && (
          <CancelModalContent booking={cancelling} reservationFeePct={reservationFeePct}
            onClose={() => setCancelling(null)} onConfirmed={handleCancelConfirmed} />
        )}
      </Modal>

      {/* ── Review modal (shared Modal) ── */}
      <Modal open={!!reviewing} onClose={() => setReviewing(null)} maxWidth="max-w-md">
        {reviewing && (
          <ReviewModalContent booking={reviewing}
            onClose={() => setReviewing(null)} onSubmitted={handleReviewSubmitted} />
        )}
      </Modal>

      {/* ── Booking detail drawer (shared Modal) ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} maxWidth="max-w-md">
        {selected && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center">
                  <i className="fas fa-receipt text-sky-600 text-sm" />
                </span>
                <h3 className="text-lg font-semibold text-slate-900">Booking Details</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm text-slate-700">
              {(() => {
                const entrance      = effectiveEntrance(selected);
                const entranceFinal = entranceIsFinal(selected);
                const grandTotal    = Number(selected.total ?? 0) + entrance;
                const paid          = Number(selected.paidAmount ?? 0);
                const outstanding   = Math.max(0, grandTotal - paid);
                const rows = [
                  ["Booking ID",      selected.id],
                  ["Room",            selected.roomType],
                  ["Check-in",        fmtDateTime(selected.checkIn)],
                  ["Check-out",       fmtDateTime(selected.checkOut)],
                  ["Guests",          selected.guests],
                  ["Room Total",      `₱${Number(selected.total).toLocaleString()}`],
                ];
                // Entrance row always shown for online bookings. Pre-check-in
                // it's an estimate ("est. · paid at gate"), post-check-in
                // it's the actual collected amount. Dropping the fee
                // entirely here is what caused the "surprise at gate"
                // complaints — guests never saw it in the detail view.
                if (entrance > 0) {
                  rows.push([
                    entranceFinal ? "Entrance Fee" : "Entrance Fee (est. · gate)",
                    `₱${entrance.toLocaleString()}`,
                  ]);
                }
                rows.push(["Grand Total", `₱${grandTotal.toLocaleString()}`]);
                // Only show "Reservation Fee Paid" when money actually cleared
                // (paidAmount covers the reservation fee). Previously this
                // rendered for any online booking — because reservation_fee
                // is set at creation time as the quoted 20% — making
                // unpaid bookings look like they'd already been paid.
                if (Number(selected.reservationFee) > 0 && paid >= Number(selected.reservationFee)) {
                  rows.push(["Reservation Fee Paid", `₱${Number(selected.reservationFee).toLocaleString()}`]);
                }
                if (paid > 0) rows.push(["Paid so far", `₱${paid.toLocaleString()}`]);
                if (outstanding > 0 && selected.status !== 'Cancelled' && selected.status !== 'Pending') {
                  rows.push([
                    entranceFinal ? "Outstanding" : "Outstanding (incl. est. entrance)",
                    `₱${outstanding.toLocaleString()}`,
                  ]);
                }
                rows.push(
                  ["Payment",         selected.paymentMethod],
                  ["Status",          selected.status],
                );
                return rows.map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-slate-500">{label}</span>
                    <span className={
                      label.startsWith("Outstanding")
                        ? "font-semibold text-right text-sky-700"
                        : label === "Grand Total"
                          ? "font-semibold text-right"
                          : label.startsWith("Entrance Fee")
                            ? "font-medium text-right text-amber-700"
                            : "font-medium text-right"
                    }>{val}</span>
                  </div>
                ));
              })()}
              {selected.promoCode && Number(selected.discount) > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Promo</span>
                  <span className="font-medium text-emerald-600">{selected.promoCode} (-₱{Number(selected.discount).toLocaleString()})</span>
                </div>
              )}
              {renderSpecialRequests(selected.specialRequests)}
            </div>
            <div className="px-6 pb-6 flex flex-wrap gap-2 justify-end">
              {selected.status === 'Confirmed' && selected.fullyPaid && (
                <button onClick={() => handleCheckIn(selected)} disabled={checkingIn}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm hover:bg-violet-700 disabled:opacity-60">
                  {checkingIn ? <><i className="fas fa-spinner fa-spin mr-1" />Checking in...</> : <><i className="fas fa-door-open mr-1" />Check In</>}
                </button>
              )}
              {(selected.status === "Pending" || selected.status === "Confirmed") && (
                <button onClick={() => { setSelected(null); setCancelling(selected); }}
                  className="px-4 py-2 bg-rose-100 text-rose-700 rounded-xl text-sm hover:bg-rose-200">Cancel Booking</button>
              )}
              {selected.status === "Completed" && !selected.hasReview && (
                <button onClick={() => { setSelected(null); setReviewing(selected); }}
                  className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm hover:bg-amber-200">
                  <i className="fas fa-star mr-1" />Leave Review
                </button>
              )}
              {["Confirmed", "Checked In", "Completed"].includes(selected.status) && (
                <button onClick={() => handleDownloadReceipt(selected)}
                  disabled={downloadingId === selected.bookingId}
                  className="px-4 py-2 bg-sky-100 text-sky-700 rounded-xl text-sm hover:bg-sky-200 disabled:opacity-50">
                  {downloadingId === selected.bookingId
                    ? <><i className="fas fa-spinner fa-spin mr-1" />Downloading...</>
                    : <><i className="fas fa-file-pdf mr-1" />Receipt</>}
                </button>
              )}
              <button onClick={() => setSelected(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Close</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
