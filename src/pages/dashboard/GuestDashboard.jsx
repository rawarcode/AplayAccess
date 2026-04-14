// src/pages/dashboard/GuestDashboard.jsx
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getBookings, downloadReceipt } from "../../lib/bookingApi.js";
import { getResortRooms } from "../../lib/resortApi.js";
import BookingModal from "../../components/modals/BookingModal.jsx";
import SuccessModal from "../../components/modals/SuccessModal.jsx";

/** "2026-03-20 07:00" → "Mar 20, 2026 7:00 AM" */
function fmtDateTime(str) {
  if (!str) return str;
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return str;
  return d.toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

/** "2026-03-20 07:00" → "Mar 20, 2026" */
function fmtDate(str) {
  if (!str) return str;
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return str;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

/** Days from now until a date string. Negative = past. */
function daysUntil(str) {
  if (!str) return null;
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

const STATUS_STYLE = {
  Pending:      "bg-yellow-100 text-yellow-800",
  Confirmed:    "bg-blue-100 text-blue-800",
  "Checked In": "bg-purple-100 text-purple-800",
  Completed:    "bg-green-100 text-green-800",
  Cancelled:    "bg-red-100 text-red-800",
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-700"}`}>
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
      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50">
      <i className={`fas ${busy ? "fa-spinner fa-spin" : "fa-download"} text-[10px]`}></i>
      Receipt
    </button>
  );
}

export default function GuestDashboard() {
  const [bookings,     setBookings]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [rooms,        setRooms]        = useState([]);
  const [bookingOpen,  setBookingOpen]  = useState(false);
  const [lastBooking,  setLastBooking]  = useState(null);
  const [successOpen,  setSuccessOpen]  = useState(false);

  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  useEffect(() => {
    getBookings()
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
    getResortRooms(1)
      .then(data => setRooms(
        (data ?? []).map(r => ({
          id:             r?.id             ?? null,
          name:           r?.name           ?? "Room",
          day_rate:       Number(r?.day_rate       ?? 0),
          overnight_rate: Number(r?.overnight_rate ?? 0),
          rate_24hr:      Number(r?.rate_24hr      ?? 0),
          capacity_label: r?.capacity_label ?? "",
          quantity:       Number(r?.quantity ?? 1),
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
      value: loading ? "—" : upcoming.length,
      icon: "fa-calendar-alt",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      sub: pendingCount > 0 ? `${pendingCount} awaiting payment` : "All confirmed",
      subColor: pendingCount > 0 ? "text-yellow-600" : "text-gray-400",
    },
    {
      label: "Past Stays",
      value: loading ? "—" : past.length,
      icon: "fa-history",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      sub: past.filter(b => b.status === "Completed" && !b.has_review).length > 0
        ? `${past.filter(b => b.status === "Completed" && !b.has_review).length} awaiting review`
        : "Thank you for visiting!",
      subColor: past.filter(b => b.status === "Completed" && !b.has_review).length > 0
        ? "text-orange-500"
        : "text-gray-400",
    },
    {
      label: "Total Spent",
      value: loading ? "—" : `₱${totalSpent.toLocaleString()}`,
      icon: "fa-peso-sign",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      sub: "Completed bookings only",
      subColor: "text-gray-400",
    },
    {
      label: "Next Stay",
      value: loading ? "—" : nextDays === null ? "None" : nextDays === 0 ? "Today!" : `${nextDays}d away`,
      icon: "fa-plane-arrival",
      iconBg: nextDays !== null && nextDays <= 3 ? "bg-rose-100" : "bg-amber-100",
      iconColor: nextDays !== null && nextDays <= 3 ? "text-rose-600" : "text-amber-600",
      sub: nextStay ? fmtDate(nextStay.checkIn) : "Book your next visit",
      subColor: "text-gray-400",
    },
  ];

  return (
    <div className="space-y-6">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guest Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your bookings, profile, and messages.</p>
        </div>
        <button
          onClick={() => setBookingOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <i className="fas fa-plus mr-2"></i>Book a Stay
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-lg ${k.iconBg} shrink-0`}>
                <i className={`fas ${k.icon} ${k.iconColor} text-base`}></i>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium truncate">{k.label}</p>
                <p className="text-2xl font-bold text-gray-900 leading-tight">{k.value}</p>
                <p className={`text-xs mt-0.5 truncate ${k.subColor}`}>{k.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming + Past */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming Bookings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              <i className="fas fa-calendar-check text-blue-500 mr-2"></i>Upcoming Bookings
            </h2>
            {upcoming.length > 3 && (
              <Link to="/dashboard/bookings" className="text-xs text-blue-600 hover:underline">
                View all ({upcoming.length})
              </Link>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                <i className="fas fa-spinner fa-spin mr-2"></i>Loading…
              </div>
            ) : upcoming.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <i className="fas fa-calendar-times text-gray-200 text-4xl mb-3 block"></i>
                <p className="text-gray-400 text-sm">No upcoming bookings.</p>
                <button onClick={() => setBookingOpen(true)}
                  className="mt-3 text-xs text-blue-600 hover:underline font-medium">
                  Book a stay →
                </button>
              </div>
            ) : (
              upcoming.slice(0, 3).map((b) => {
                const days = daysUntil(b.checkIn);
                return (
                  <div key={b.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{b.roomType}</p>
                        <p className="text-xs text-gray-500 font-mono">{b.id}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={b.status} />
                        {days !== null && days >= 0 && (
                          <span className={`text-xs font-medium ${days <= 3 ? "text-rose-500" : "text-gray-400"}`}>
                            {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `in ${days} days`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <i className="fas fa-clock text-[10px]"></i>
                      <span>{fmtDateTime(b.checkIn)}</span>
                      <span className="text-gray-300">→</span>
                      <span>{fmtDateTime(b.checkOut)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">₱{Number(b.total).toLocaleString()}</span>
                        {b.promo_code && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded font-medium">
                            <i className="fas fa-tag text-[9px]"></i>{b.promo_code}
                          </span>
                        )}
                        {b.fully_paid && (
                          <span className="text-xs text-green-600 font-medium">
                            <i className="fas fa-check-circle mr-0.5"></i>Paid
                          </span>
                        )}
                      </div>
                      <Link to="/dashboard/bookings"
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        Details →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Past Bookings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              <i className="fas fa-history text-green-500 mr-2"></i>Past Stays
            </h2>
            {past.length > 3 && (
              <Link to="/dashboard/bookings" className="text-xs text-blue-600 hover:underline">
                View all ({past.length})
              </Link>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                <i className="fas fa-spinner fa-spin mr-2"></i>Loading…
              </div>
            ) : past.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <i className="fas fa-umbrella-beach text-gray-200 text-4xl mb-3 block"></i>
                <p className="text-gray-400 text-sm">No past stays yet.</p>
                <p className="text-xs text-gray-300 mt-1">Your completed bookings will appear here.</p>
              </div>
            ) : (
              past.slice(0, 3).map((b) => (
                <div key={b.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{b.roomType}</p>
                      <p className="text-xs text-gray-500 font-mono">{b.id}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <i className="fas fa-clock text-[10px]"></i>
                    <span>{fmtDate(b.checkIn)}</span>
                    <span className="text-gray-300">→</span>
                    <span>{fmtDate(b.checkOut)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">₱{Number(b.total).toLocaleString()}</span>
                      {b.promo_code && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded font-medium">
                          <i className="fas fa-tag text-[9px]"></i>{b.promo_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {b.status === "Completed" && (
                        <ReceiptBtn bookingId={b.booking_id} />
                      )}
                      {b.status === "Completed" && !b.has_review && (
                        <Link to="/dashboard/bookings"
                          className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
                          <i className="fas fa-star text-[10px]"></i>Review
                        </Link>
                      )}
                      {b.status === "Completed" && b.has_review && (
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
    </div>
  );
}
