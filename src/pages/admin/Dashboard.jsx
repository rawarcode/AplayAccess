import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminStats } from "../../lib/adminApi";
import { updateBookingStatus } from "../../lib/frontdeskApi";
import Toast, { useToast } from "../../components/ui/Toast";

function fmtDateTime(str) {
  if (!str) return str;
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return str;
  return d.toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const STATUS_COLORS = {
  Pending:      "bg-amber-100 text-amber-800",
  Confirmed:    "bg-blue-100 text-blue-800",
  "Checked In": "bg-green-100 text-green-800",
  Completed:    "bg-gray-100 text-gray-700",
  Cancelled:    "bg-rose-100 text-rose-800",
};

export default function AdminDashboard() {
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [viewBooking, setViewBooking] = useState(null);
  const [acting,      setActing]      = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);

  const [toast, showToast, clearToast, toastType] = useToast();
  const navigate = useNavigate();

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    getAdminStats()
      .then(r => { setStats(r.data.data); setError(null); })
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  // Escape key closes modal
  useEffect(() => {
    if (!viewBooking) return;
    function onKey(e) { if (e.key === "Escape") setViewBooking(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewBooking]);

  async function handleAction(bookingId, status) {
    setActing(true);
    try {
      await updateBookingStatus(bookingId, status);
      showToast(`Booking ${status.toLowerCase()} successfully.`, "success");
      setViewBooking(null);
      load(true);
    } catch (err) {
      showToast(err.response?.data?.message || `Failed to ${status.toLowerCase()} booking.`, "error");
    } finally {
      setActing(false);
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-full bg-gray-200 mr-4"></div>
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-gray-200 rounded w-24"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
                <div className="h-2 bg-gray-100 rounded w-32"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b animate-pulse flex justify-between">
          <div className="h-5 bg-gray-200 rounded w-36"></div>
          <div className="h-4 bg-gray-100 rounded w-16"></div>
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="px-6 py-4 flex gap-6 border-b animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-28"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-100 rounded w-28"></div>
            <div className="h-4 bg-gray-100 rounded w-40"></div>
            <div className="h-5 bg-gray-200 rounded-full w-20"></div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Error state ────────────────────────────────────────────────────────────
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

  const cards = [
    {
      label: "Total Guests",
      value: stats.total_guests.toLocaleString(),
      icon: "fa-users",
      color: "bg-blue-100 text-blue-600",
      sub: `${stats.pending_bookings} pending bookings`,
    },
    {
      label: "Total Rooms",
      value: stats.total_rooms,
      icon: "fa-bed",
      color: "bg-green-100 text-green-600",
      sub: "All room types",
    },
    {
      label: "Bookings This Month",
      value: stats.bookings_this_month,
      icon: "fa-calendar-check",
      color: "bg-amber-100 text-amber-600",
      sub: "Current month",
    },
    {
      label: "Revenue This Month",
      value: `₱${Number(stats.revenue_this_month).toLocaleString()}`,
      icon: "fa-peso-sign",
      color: "bg-purple-100 text-purple-600",
      sub: "Completed + forfeited fees",
    },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
            <div className="flex items-center">
              <div className={`p-3 rounded-full mr-4 ${c.color}`}>
                <i className={`fas ${c.icon} text-xl`}></i>
              </div>
              <div>
                <p className="text-gray-500 text-sm">{c.label}</p>
                <h3 className="text-2xl font-bold">{c.value}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {c.label === "Total Guests" && stats.pending_bookings > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                      {stats.pending_bookings} pending
                    </span>
                  ) : c.sub}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Recent Bookings</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
              title="Refresh"
            >
              <i className={`fas fa-sync-alt text-sm ${refreshing ? "fa-spin" : ""}`}></i>
            </button>
            <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full">Latest 5</span>
            <button
              onClick={() => navigate("/admin/history")}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              View All <i className="fas fa-arrow-right ml-0.5 text-[10px]"></i>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {stats.recent_bookings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <i className="fas fa-calendar-times text-gray-200 text-4xl mb-3 block"></i>
              <p className="text-gray-400 text-sm">No bookings yet.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">ID</th>
                  <th className="px-6 py-3 text-left">Room</th>
                  <th className="px-6 py-3 text-left">Guest</th>
                  <th className="px-6 py-3 text-left">Dates</th>
                  <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recent_bookings.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setViewBooking(b)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{b.id}</td>
                    <td className="px-6 py-4">{b.room}</td>
                    <td className="px-6 py-4">{b.guest}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      <div>{fmtDateTime(b.checkIn) || b.checkIn}</div>
                      <div className="text-xs text-gray-400">→ {fmtDateTime(b.checkOut) || b.checkOut}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-700"}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View Booking Modal */}
      {viewBooking && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setViewBooking(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-hero-fade-in opacity-0"
            onClick={(e) => e.stopPropagation()}
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
                ["fa-arrow-right-to-bracket", "Check-in", fmtDateTime(viewBooking.checkIn) || viewBooking.checkIn],
                ["fa-arrow-right-from-bracket", "Check-out", fmtDateTime(viewBooking.checkOut) || viewBooking.checkOut],
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
              {/* Quick actions */}
              {viewBooking.status === "Pending" && (
                <button
                  onClick={() => handleAction(viewBooking.bookingId || viewBooking.id, "Confirmed")}
                  disabled={acting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {acting ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-check mr-1"></i>}
                  Confirm
                </button>
              )}
              {viewBooking.status === "Pending" && (
                <button
                  onClick={() => handleAction(viewBooking.bookingId || viewBooking.id, "Cancelled")}
                  disabled={acting}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm hover:bg-red-200 disabled:opacity-50 transition"
                >
                  <i className="fas fa-ban mr-1"></i>Cancel
                </button>
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
