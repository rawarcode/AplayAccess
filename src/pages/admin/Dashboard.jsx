import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminBookings } from "../../lib/adminApi";
import { updateBookingStatus, checkInBooking } from "../../lib/frontdeskApi";
import Toast, { useToast } from "../../components/ui/Toast";
import { fmtTime, fmtDateTime } from "../../lib/format";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Local alias: the original "fmtDate" here included time — it was really fmtDateTime
const fmtDate = fmtDateTime;

const STATUS_COLORS = {
  Pending:      "bg-amber-100 text-amber-800",
  Confirmed:    "bg-blue-100 text-blue-800",
  "Checked In": "bg-green-100 text-green-800",
  Completed:    "bg-gray-100 text-gray-700",
  Cancelled:    "bg-rose-100 text-rose-800",
};

export default function AdminDashboard() {
  const [bookings,    setBookings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [acting,      setActing]      = useState(null); // bookingId being acted on
  const [refreshing,  setRefreshing]  = useState(false);
  const [viewBooking, setViewBooking] = useState(null);

  const [toast, showToast, clearToast, toastType] = useToast();
  const navigate = useNavigate();

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    getAdminBookings()
      .then(r => {
        const data = r.data?.data ?? r.data ?? r;
        setBookings(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch(() => setError("Failed to load bookings."))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  // Escape closes modal
  useEffect(() => {
    if (!viewBooking) return;
    function onKey(e) { if (e.key === "Escape") setViewBooking(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewBooking]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const today = todayStr();

  const pending = bookings.filter(b => b.status === "Pending");
  const todayCheckIns = bookings.filter(
    b => b.status === "Confirmed" && b.checkIn?.slice(0, 10) === today
  );
  const todayCheckOuts = bookings.filter(
    b => b.status === "Checked In" && b.checkOut?.slice(0, 10) === today
  );

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleAction(bookingId, status) {
    setActing(bookingId);
    try {
      if (status === "Checked In") {
        await checkInBooking(bookingId);
      } else {
        await updateBookingStatus(bookingId, status);
      }
      showToast(`Booking ${status.toLowerCase()} successfully.`, "success");
      setViewBooking(null);
      load(true);
    } catch (err) {
      showToast(err.response?.data?.message || `Failed to ${status.toLowerCase()} booking.`, "error");
    } finally {
      setActing(null);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl shadow p-5 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gray-200"></div>
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-gray-200 rounded w-24"></div>
                <div className="h-7 bg-gray-200 rounded w-12"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {[1, 2].map(i => (
        <div key={i} className="bg-white rounded-xl shadow">
          <div className="px-6 py-4 border-b animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-40"></div>
          </div>
          {[1, 2, 3].map(j => (
            <div key={j} className="px-6 py-4 flex gap-6 border-b animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 bg-gray-100 rounded w-32"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) return (
    <div className="p-6">
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-6 text-center">
        <i className="fas fa-exclamation-triangle text-3xl mb-3 block"></i>
        <p className="font-medium mb-3">{error}</p>
        <button
          onClick={() => load()}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 transition"
        >
          <i className="fas fa-redo mr-2"></i>Retry
        </button>
      </div>
    </div>
  );

  // ── Action cards ────────────────────────────────────────────────────────────
  const actionCards = [
    {
      label: "Pending Approval",
      count: pending.length,
      icon: "fa-clock",
      color: "bg-amber-50 text-amber-600 border-amber-200",
      iconBg: "bg-amber-100",
      empty: "All caught up!",
      target: "#pending",
    },
    {
      label: "Today's Check-ins",
      count: todayCheckIns.length,
      icon: "fa-arrow-right-to-bracket",
      color: "bg-green-50 text-green-600 border-green-200",
      iconBg: "bg-green-100",
      empty: "No arrivals today",
      target: "#checkins",
    },
    {
      label: "Today's Check-outs",
      count: todayCheckOuts.length,
      icon: "fa-arrow-right-from-bracket",
      color: "bg-blue-50 text-blue-600 border-blue-200",
      iconBg: "bg-blue-100",
      empty: "No departures today",
      target: "#checkouts",
    },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50 p-2"
          title="Refresh"
        >
          <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
        </button>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actionCards.map(c => (
          <a
            key={c.label}
            href={c.target}
            className={`rounded-xl border p-5 flex items-center gap-4 transition hover:shadow-md ${c.color}`}
          >
            <div className={`h-12 w-12 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0`}>
              <i className={`fas ${c.icon} text-lg`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{c.label}</p>
              {c.count > 0 ? (
                <p className="text-2xl font-bold">{c.count}</p>
              ) : (
                <p className="text-sm font-medium opacity-60">{c.empty}</p>
              )}
            </div>
          </a>
        ))}
      </div>

      {/* Pending Approval Queue */}
      <section id="pending">
        <div className="bg-white rounded-xl shadow">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">
              <i className="fas fa-clock text-amber-500 mr-2"></i>
              Pending Approval
              {pending.length > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {pending.length}
                </span>
              )}
            </h2>
            <button
              onClick={() => navigate("/owner/bookings")}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              View All Bookings <i className="fas fa-arrow-right ml-0.5 text-[10px]"></i>
            </button>
          </div>
          {pending.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <i className="fas fa-check-circle text-green-200 text-4xl mb-3 block"></i>
              <p className="text-gray-400 text-sm font-medium">No pending bookings — all caught up!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 text-left">Guest</th>
                    <th className="px-6 py-3 text-left">Room</th>
                    <th className="px-6 py-3 text-left">Check-in</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Total</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pending.map(b => (
                    <tr key={b.id || b.bookingId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3">
                        <button
                          onClick={() => setViewBooking(b)}
                          className="text-blue-600 hover:underline font-medium text-left"
                        >
                          {b.guest}
                        </button>
                        <p className="text-xs text-gray-400">{b.id}</p>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{b.room}</td>
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{fmtDate(b.checkIn)}</td>
                      <td className="px-6 py-3">
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full capitalize">
                          {b.bookingType || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium">₱{Number(b.total || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAction(b.bookingId || b.id, "Confirmed")}
                            disabled={acting === (b.bookingId || b.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                          >
                            {acting === (b.bookingId || b.id) ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-check mr-1"></i>Confirm</>}
                          </button>
                          <button
                            onClick={() => handleAction(b.bookingId || b.id, "Cancelled")}
                            disabled={acting === (b.bookingId || b.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition"
                          >
                            <i className="fas fa-ban mr-1"></i>Decline
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Today's Schedule — Check-ins & Check-outs side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Today's Check-ins */}
        <section id="checkins" className="bg-white rounded-xl shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">
              <i className="fas fa-arrow-right-to-bracket text-green-500 mr-2"></i>
              Arriving Today
              {todayCheckIns.length > 0 && (
                <span className="ml-2 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {todayCheckIns.length}
                </span>
              )}
            </h2>
          </div>
          {todayCheckIns.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <i className="fas fa-couch text-gray-200 text-3xl mb-2 block"></i>
              <p className="text-gray-400 text-sm">No arrivals scheduled today</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {todayCheckIns.map(b => (
                <div key={b.id || b.bookingId} className="px-6 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <button
                      onClick={() => setViewBooking(b)}
                      className="text-sm font-medium text-blue-600 hover:underline truncate block"
                    >
                      {b.guest}
                    </button>
                    <p className="text-xs text-gray-500">{b.room} · {fmtTime(b.checkIn)}</p>
                  </div>
                  <button
                    onClick={() => handleAction(b.bookingId || b.id, "Checked In")}
                    disabled={acting === (b.bookingId || b.id)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition shrink-0"
                  >
                    {acting === (b.bookingId || b.id) ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-door-open mr-1"></i>Check In</>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Today's Check-outs */}
        <section id="checkouts" className="bg-white rounded-xl shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">
              <i className="fas fa-arrow-right-from-bracket text-blue-500 mr-2"></i>
              Departing Today
              {todayCheckOuts.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {todayCheckOuts.length}
                </span>
              )}
            </h2>
          </div>
          {todayCheckOuts.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <i className="fas fa-door-closed text-gray-200 text-3xl mb-2 block"></i>
              <p className="text-gray-400 text-sm">No departures scheduled today</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {todayCheckOuts.map(b => (
                <div key={b.id || b.bookingId} className="px-6 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <button
                      onClick={() => setViewBooking(b)}
                      className="text-sm font-medium text-blue-600 hover:underline truncate block"
                    >
                      {b.guest}
                    </button>
                    <p className="text-xs text-gray-500">{b.room} · out by {fmtTime(b.checkOut)}</p>
                  </div>
                  <button
                    onClick={() => handleAction(b.bookingId || b.id, "Completed")}
                    disabled={acting === (b.bookingId || b.id)}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition shrink-0"
                  >
                    {acting === (b.bookingId || b.id) ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-flag-checkered mr-1"></i>Check Out</>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Booking Detail Modal */}
      {viewBooking && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog" aria-modal="true" aria-label="Booking detail"
          onClick={() => setViewBooking(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-hero-fade-in opacity-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                <i className="fas fa-calendar-alt mr-2 text-blue-600"></i>Booking Details
              </h3>
              <button onClick={() => setViewBooking(null)} className="text-gray-400 hover:text-gray-600 transition" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              {[
                ["fa-hashtag",      "Booking ID",  viewBooking.id],
                ["fa-user",         "Guest",       viewBooking.guest],
                ["fa-bed",          "Room",        viewBooking.room],
                ["fa-arrow-right-to-bracket", "Check-in", fmtDate(viewBooking.checkIn) || viewBooking.checkIn],
                ["fa-arrow-right-from-bracket", "Check-out", fmtDate(viewBooking.checkOut) || viewBooking.checkOut],
                ...(viewBooking.guests ? [["fa-users", "Guests", viewBooking.guests]] : []),
                ...(viewBooking.bookingType ? [["fa-clock", "Type", viewBooking.bookingType]] : []),
                ...(viewBooking.total ? [["fa-peso-sign", "Total", `₱${Number(viewBooking.total).toLocaleString()}`]] : []),
                ...(viewBooking.paymentMethod ? [["fa-credit-card", "Payment", viewBooking.paymentMethod]] : []),
              ].map(([icon, label, val]) => (
                <div key={label} className="flex items-start gap-3">
                  <i className={`fas ${icon} text-gray-400 w-4 text-center text-xs mt-0.5`}></i>
                  <span className="text-gray-500 min-w-[80px] shrink-0">{label}</span>
                  <span className="font-medium text-gray-900">{val}</span>
                </div>
              ))}
              <div className="flex items-start gap-3">
                <i className="fas fa-circle-info text-gray-400 w-4 text-center text-xs mt-0.5"></i>
                <span className="text-gray-500 min-w-[80px] shrink-0">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[viewBooking.status] || "bg-gray-100 text-gray-700"}`}>
                  {viewBooking.status}
                </span>
              </div>
            </div>
            <div className="px-6 pb-6 flex flex-wrap gap-2 justify-end">
              {viewBooking.status === "Pending" && (
                <>
                  <button
                    onClick={() => handleAction(viewBooking.bookingId || viewBooking.id, "Confirmed")}
                    disabled={acting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {acting ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-check mr-1"></i>}
                    Confirm
                  </button>
                  <button
                    onClick={() => handleAction(viewBooking.bookingId || viewBooking.id, "Cancelled")}
                    disabled={acting}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm hover:bg-red-200 disabled:opacity-50 transition"
                  >
                    <i className="fas fa-ban mr-1"></i>Decline
                  </button>
                </>
              )}
              {viewBooking.status === "Confirmed" && (
                <button
                  onClick={() => handleAction(viewBooking.bookingId || viewBooking.id, "Checked In")}
                  disabled={acting}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {acting ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-door-open mr-1"></i>}
                  Check In
                </button>
              )}
              {viewBooking.status === "Checked In" && (
                <button
                  onClick={() => handleAction(viewBooking.bookingId || viewBooking.id, "Completed")}
                  disabled={acting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  {acting ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-flag-checkered mr-1"></i>}
                  Check Out
                </button>
              )}
              <button onClick={() => setViewBooking(null)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
