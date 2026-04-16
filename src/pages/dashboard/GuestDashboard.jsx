// src/pages/dashboard/GuestDashboard.jsx
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getBookings, downloadReceipt } from "../../lib/bookingApi.js";
import { getResortRooms } from "../../lib/resortApi.js";
import { RESORT_ID } from "../../lib/config.js";
import { Helmet } from "react-helmet-async";
import BookingModal from "../../components/modals/BookingModal.jsx";
import SuccessModal from "../../components/modals/SuccessModal.jsx";
import Modal from "../../components/modals/Modal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { fmtDateTime, fmtDate } from "../../lib/format";

/** Days from now until a date string. Negative = past. */
function daysUntil(str) {
  if (!str) return null;
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

const STATUS_STYLE = {
  Pending:      "bg-amber-100 text-amber-800",
  Confirmed:    "bg-sky-100 text-sky-800",
  "Checked In": "bg-violet-100 text-violet-800",
  Completed:    "bg-emerald-100 text-emerald-800",
  Cancelled:    "bg-rose-100 text-rose-800",
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

function ReceiptBtn({ bookingId }) {
  const [busy, setBusy] = useState(false);
  async function handle() {
    setBusy(true);
    try {
      const blob = await downloadReceipt(bookingId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${bookingId}-receipt.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally { setBusy(false); }
  }
  return (
    <button onClick={handle} disabled={busy}
      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50">
      <i className={`fas ${busy ? "fa-spinner fa-spin" : "fa-download"} text-[10px]`}></i>
      Receipt
    </button>
  );
}

function renderSpecialRequests(text) {
  if (!text) return null;
  const parts = text.split(/,\s*(?=(?:Walk-in|Phone|Type|Email|Name)\s*:)/i);
  const parsed = parts.length > 1
    ? parts.map(p => { const [k, ...v] = p.split(':'); return [k.trim(), v.join(':').trim()]; })
    : null;
  const icons = { 'walk-in': 'fa-user', phone: 'fa-phone', email: 'fa-envelope', type: 'fa-clock' };
  return (
    <div className="pt-3 border-t border-slate-100">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
        {parsed ? "Walk-in Details" : "Special Requests"}
      </p>
      {parsed ? (
        <div className="space-y-2 bg-slate-50 rounded-lg p-3">
          {parsed.map(([key, val]) => (
            <div key={key} className="flex items-start gap-2">
              <i className={`fas ${icons[key.toLowerCase()] || 'fa-info-circle'} text-slate-400 w-4 text-center text-xs mt-0.5`}></i>
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

export default function GuestDashboard() {
  const [bookings,     setBookings]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [rooms,        setRooms]        = useState([]);
  const [bookingOpen,  setBookingOpen]  = useState(false);
  const [lastBooking,  setLastBooking]  = useState(null);
  const [successOpen,  setSuccessOpen]  = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { user }       = useAuth();

  useEffect(() => {
    getBookings()
      .then(setBookings)
      .catch(() => setError("Could not load your bookings. Please try again later."))
      .finally(() => setLoading(false));
    getResortRooms(RESORT_ID)
      .then(data => setRooms(
        (data ?? []).map(r => ({
          id:             r?.id             ?? null,
          name:                  r?.name           ?? "Room",
          day_rate:              Number(r?.day_rate       ?? 0),
          overnight_rate:        Number(r?.overnight_rate ?? 0),
          rate_24hr:             Number(r?.rate_24hr      ?? 0),
          capacity_label:        r?.capacity_label ?? "",
          quantity:              Number(r?.quantity ?? 1),
          allowed_booking_types: r?.allowed_booking_types ?? null,
        }))
      ))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("book") === "1") {
      setBookingOpen(true);
      navigate("/dashboard", { replace: true });
    }
  }, [searchParams, navigate]);

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
      // silent
    } finally {
      setDownloadingId(null);
    }
  }

  const { upcoming, past, totalSpent, nextStay, pendingCount } = useMemo(() => {
    const now = new Date();
    const upcoming = [];
    const past     = [];
    let totalSpent  = 0;
    let pendingCount = 0;
    let nextStay    = null;

    for (const b of bookings) {
      const ci = new Date(b.checkIn.replace(" ", "T"));
      if (b.status === "Pending") pendingCount += 1;

      if (b.status === "Completed") totalSpent += Number(b.total ?? 0);

      if (ci >= now) {
        upcoming.push(b);
        if (!nextStay || ci < new Date(nextStay.checkIn.replace(" ", "T"))) nextStay = b;
      } else {
        past.push(b);
      }
    }

    // sort upcoming ascending (soonest first), past descending (most recent first)
    upcoming.sort((a, b) => new Date(a.checkIn.replace(" ", "T")) - new Date(b.checkIn.replace(" ", "T")));
    past.sort((a, b) => new Date(b.checkIn.replace(" ", "T")) - new Date(a.checkIn.replace(" ", "T")));

    return { upcoming, past, totalSpent, nextStay, pendingCount };
  }, [bookings]);

  const nextDays = nextStay ? daysUntil(nextStay.checkIn) : null;

  // ── KPI cards ────────────────────────────────────────────────────────────────
  const kpis = [
    {
      label: "Upcoming Bookings",
      value: loading ? "\u2014" : upcoming.length,
      icon: "fa-calendar-alt",
      iconBg: "bg-sky-100",
      iconColor: "text-sky-600",
      sub: pendingCount > 0 ? `${pendingCount} awaiting payment` : "All confirmed",
      subColor: pendingCount > 0 ? "text-yellow-600" : "text-slate-400",
    },
    {
      label: "Past Stays",
      value: loading ? "\u2014" : past.length,
      icon: "fa-history",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      sub: past.filter(b => b.status === "Completed" && !b.hasReview).length > 0
        ? `${past.filter(b => b.status === "Completed" && !b.hasReview).length} awaiting review`
        : "Thank you for visiting!",
      subColor: past.filter(b => b.status === "Completed" && !b.hasReview).length > 0
        ? "text-orange-500"
        : "text-slate-400",
    },
    {
      label: "Total Spent",
      value: loading ? "\u2014" : `\u20B1${totalSpent.toLocaleString()}`,
      icon: "fa-peso-sign",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
      sub: "Completed bookings only",
      subColor: "text-slate-400",
    },
    {
      label: "Next Stay",
      value: loading ? "\u2014" : nextDays === null ? "None" : nextDays === 0 ? "Today!" : `${nextDays}d away`,
      icon: "fa-plane-arrival",
      iconBg: nextDays !== null && nextDays <= 3 ? "bg-rose-100" : "bg-amber-100",
      iconColor: nextDays !== null && nextDays <= 3 ? "text-rose-600" : "text-amber-600",
      sub: nextStay ? fmtDate(nextStay.checkIn) : "Book your next visit",
      subColor: "text-slate-400",
    },
  ];

  return (
    <div className="space-y-6">
      <Helmet><title>Dashboard — Aplaya Beach Resort</title></Helmet>
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        selectedRoom=""
        rooms={rooms}
        onBooked={(details) => {
          setLastBooking(details);
          setBookingOpen(false);
          setSuccessOpen(true);
        }}
      />
      <SuccessModal
        open={successOpen}
        onClose={() => { setSuccessOpen(false); setLastBooking(null); }}
        booking={lastBooking}
      />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.name?.split(' ')[0] || 'Guest'}!
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your bookings, profile, and messages.</p>
        </div>
        <button
          onClick={() => setBookingOpen(true)}
          className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <i className="fas fa-plus mr-2"></i>Book a Stay
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <i className="fas fa-exclamation-circle text-red-500 mt-0.5 shrink-0"></i>
          <div>
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <button
              onClick={() => { setError(""); setLoading(true); getBookings().then(setBookings).catch(() => setError("Could not load your bookings. Please try again later.")).finally(() => setLoading(false)); }}
              className="text-xs text-red-600 hover:underline mt-1"
            >
              <i className="fas fa-redo mr-1"></i>Retry
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-200 shrink-0"></div>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 bg-slate-200 rounded w-20"></div>
                  <div className="h-6 bg-slate-200 rounded w-14"></div>
                  <div className="h-2.5 bg-slate-100 rounded w-24"></div>
                </div>
              </div>
            </div>
          ))
        ) : (
          kpis.map((k) => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${k.iconBg} shrink-0`}>
                  <i className={`fas ${k.icon} ${k.iconColor} text-base`}></i>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium truncate">{k.label}</p>
                  <p className="text-2xl font-bold text-slate-900 leading-tight">{k.value}</p>
                  <p className={`text-xs mt-0.5 truncate ${k.subColor}`}>{k.sub}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick-action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/rooms" className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:border-sky-300 hover:shadow-md transition group">
          <div className="h-11 w-11 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 group-hover:bg-sky-200 transition">
            <i className="fas fa-bed text-sky-600"></i>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Browse Rooms</p>
            <p className="text-xs text-slate-400">View available rooms & cottages</p>
          </div>
        </Link>
        <Link to="/dashboard/messages" className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:border-emerald-300 hover:shadow-md transition group">
          <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition">
            <i className="fas fa-envelope text-emerald-600"></i>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Messages</p>
            <p className="text-xs text-slate-400">View your inbox & notifications</p>
          </div>
        </Link>
        <Link to="/dashboard/profile" className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:border-violet-300 hover:shadow-md transition group">
          <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 group-hover:bg-violet-200 transition">
            <i className="fas fa-user-edit text-violet-600"></i>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Edit Profile</p>
            <p className="text-xs text-slate-400">Update your account details</p>
          </div>
        </Link>
      </div>

      {/* Empty dashboard CTA */}
      {!loading && bookings.length === 0 && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-sky-100 mb-4">
            <i className="fas fa-umbrella-beach text-sky-600 text-3xl"></i>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Ready for your first stay?</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            Browse our rooms, cottages, and pavilions to plan your perfect beach getaway at Aplaya Beach Resort.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/rooms"
              className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Browse Rooms
            </Link>
            <button onClick={() => setBookingOpen(true)}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium transition-colors">
              Book Now
            </button>
          </div>
        </div>
      )}

      {/* Upcoming + Past */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming Bookings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">
              <i className="fas fa-calendar-check text-sky-500 mr-2"></i>Upcoming Bookings
            </h2>
            {upcoming.length > 3 && (
              <Link to="/dashboard/bookings" className="text-xs text-sky-600 hover:underline">
                View all ({upcoming.length})
              </Link>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="divide-y divide-slate-50">
                {[1, 2].map((i) => (
                  <div key={i} className="px-6 py-4 animate-pulse">
                    <div className="flex justify-between mb-2">
                      <div className="space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-32"></div>
                        <div className="h-3 bg-slate-100 rounded w-20"></div>
                      </div>
                      <div className="h-5 bg-slate-200 rounded-full w-16"></div>
                    </div>
                    <div className="h-3 bg-slate-100 rounded w-48 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-20"></div>
                  </div>
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <i className="fas fa-calendar-times text-slate-200 text-4xl mb-3 block"></i>
                <p className="text-slate-400 text-sm">No upcoming bookings.</p>
                <button onClick={() => setBookingOpen(true)}
                  className="mt-3 text-xs text-sky-600 hover:underline font-medium">
                  Book a stay →
                </button>
              </div>
            ) : (
              upcoming.slice(0, 3).map((b) => {
                const days = daysUntil(b.checkIn);
                return (
                  <div key={b.id} onClick={() => setSelected(b)} className="px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{b.roomType}</p>
                        <p className="text-xs text-slate-500 font-mono">{b.id}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={b.status} />
                        {days !== null && days >= 0 && (
                          <span className={`text-xs font-medium ${days <= 3 ? "text-rose-500" : "text-slate-400"}`}>
                            {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `in ${days} days`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <i className="fas fa-clock text-[10px]"></i>
                      <span>{fmtDateTime(b.checkIn)}</span>
                      <span className="text-slate-300">{"\u2192"}</span>
                      <span>{fmtDateTime(b.checkOut)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{"\u20B1"}{Number(b.total).toLocaleString()}</span>
                        {b.promoCode && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded font-medium">
                            <i className="fas fa-tag text-[9px]"></i>{b.promoCode}
                          </span>
                        )}
                        {b.fullyPaid && (
                          <span className="text-xs text-green-600 font-medium">
                            <i className="fas fa-check-circle mr-0.5"></i>Paid
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-sky-600 font-medium">
                        Details <i className="fas fa-chevron-right text-[9px] ml-0.5"></i>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Past Bookings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">
              <i className="fas fa-history text-emerald-500 mr-2"></i>Past Stays
            </h2>
            {past.length > 3 && (
              <Link to="/dashboard/bookings" className="text-xs text-sky-600 hover:underline">
                View all ({past.length})
              </Link>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="divide-y divide-slate-50">
                {[1, 2].map((i) => (
                  <div key={i} className="px-6 py-4 animate-pulse">
                    <div className="flex justify-between mb-2">
                      <div className="space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-32"></div>
                        <div className="h-3 bg-slate-100 rounded w-20"></div>
                      </div>
                      <div className="h-5 bg-slate-200 rounded-full w-16"></div>
                    </div>
                    <div className="h-3 bg-slate-100 rounded w-48 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-20"></div>
                  </div>
                ))}
              </div>
            ) : past.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <i className="fas fa-umbrella-beach text-slate-200 text-4xl mb-3 block"></i>
                <p className="text-slate-400 text-sm">No past stays yet.</p>
                <p className="text-xs text-slate-300 mt-1">Your completed bookings will appear here.</p>
              </div>
            ) : (
              past.slice(0, 3).map((b) => (
                <div key={b.id} onClick={() => setSelected(b)} className="px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{b.roomType}</p>
                      <p className="text-xs text-slate-500 font-mono">{b.id}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <i className="fas fa-clock text-[10px]"></i>
                    <span>{fmtDate(b.checkIn)}</span>
                    <span className="text-slate-300">{"\u2192"}</span>
                    <span>{fmtDate(b.checkOut)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{"\u20B1"}{Number(b.total).toLocaleString()}</span>
                      {b.promoCode && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded font-medium">
                          <i className="fas fa-tag text-[9px]"></i>{b.promoCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      {b.status === "Completed" && (
                        <ReceiptBtn bookingId={b.bookingId} />
                      )}
                      {b.status === "Completed" && !b.hasReview && (
                        <Link to="/dashboard/bookings"
                          className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
                          <i className="fas fa-star text-[10px]"></i>Review
                        </Link>
                      )}
                      {b.status === "Completed" && b.hasReview && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <i className="fas fa-star text-[10px]"></i>
                          {b.review?.rating}/5
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Booking detail modal (shared Modal component) */}
      <Modal open={!!selected} onClose={() => setSelected(null)} maxWidth="max-w-md">
        {selected && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                  <i className="fas fa-receipt text-sky-600 text-lg"></i>
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Booking Details</h3>
                  <p className="text-xs text-slate-400">{selected.id}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm text-slate-700">
              {[
                ["Booking ID",      selected.id],
                ["Room",            selected.roomType],
                ["Booking Type",    selected.bookingType],
                ["Check-in",        fmtDateTime(selected.checkIn)],
                ["Check-out",       fmtDateTime(selected.checkOut)],
                ["Guests",          selected.guests],
                ["Total",           `\u20B1${Number(selected.total).toLocaleString()}`],
                ["Reservation Fee", `\u20B1${Number(selected.reservationFee).toLocaleString()}`],
                ["Payment",         selected.paymentMethod],
                ["Status",          selected.status],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-right">{val}</span>
                </div>
              ))}
              {selected.promoCode && Number(selected.discount) > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Promo</span>
                  <span className="font-medium text-green-600">{selected.promoCode} (-{"\u20B1"}{Number(selected.discount).toLocaleString()})</span>
                </div>
              )}
              {selected.fullyPaid && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Payment Status</span>
                  <span className="font-medium text-green-600"><i className="fas fa-check-circle mr-1"></i>Fully Paid</span>
                </div>
              )}
              {renderSpecialRequests(selected.specialRequests)}
            </div>
            <div className="px-6 pb-6 flex flex-wrap gap-2 justify-end">
              {["Confirmed", "Checked In", "Completed"].includes(selected.status) && (
                <>
                  <button onClick={() => handleDownloadReceipt(selected)}
                    disabled={downloadingId === selected.bookingId}
                    className="px-4 py-2 bg-sky-100 text-sky-700 rounded-xl text-sm hover:bg-sky-200 disabled:opacity-50">
                    {downloadingId === selected.bookingId
                      ? <><i className="fas fa-spinner fa-spin mr-1"></i>Downloading...</>
                      : <><i className="fas fa-file-pdf mr-1"></i>Receipt</>}
                  </button>
                </>
              )}
              <Link to="/dashboard/bookings"
                onClick={() => setSelected(null)}
                className="px-4 py-2 bg-sky-600 text-white rounded-xl text-sm hover:bg-sky-700 font-medium">
                <i className="fas fa-list mr-1"></i>View All Bookings
              </Link>
              <button onClick={() => setSelected(null)}
                className="px-4 py-2 border rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
