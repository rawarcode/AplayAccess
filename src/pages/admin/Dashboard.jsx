import { useState, useEffect } from "react";
import { getAdminStats } from "../../lib/adminApi";

const STATUS_COLORS = {
  Pending:    "bg-amber-100 text-amber-800",
  Confirmed:  "bg-blue-100 text-blue-800",
  "Checked In": "bg-green-100 text-green-800",
  Completed:  "bg-gray-100 text-gray-700",
  Cancelled:  "bg-rose-100 text-rose-800",
};

export default function AdminDashboard() {
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [viewBooking, setViewBooking] = useState(null);

  useEffect(() => {
    getAdminStats()
      .then(r => setStats(r.data.data))
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64 text-gray-500">
      <i className="fas fa-spinner fa-spin mr-2"></i> Loading dashboard…
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">{error}</div>
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
      color: "bg-yellow-100 text-yellow-600",
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
          <div key={c.label} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-full mr-4 ${c.color}`}>
                <i className={`fas ${c.icon} text-xl`}></i>
              </div>
              <div>
                <p className="text-gray-500 text-sm">{c.label}</p>
                <h3 className="text-2xl font-bold">{c.value}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Recent Bookings</h2>
          <span className="text-xs text-gray-400">Latest 5</span>
        </div>
        <div className="overflow-x-auto">
          {stats.recent_bookings.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400">No bookings yet.</p>
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
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{b.id}</td>
                    <td className="px-6 py-4">{b.room}</td>
                    <td className="px-6 py-4">{b.guest}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{b.check_in} – {b.check_out}</td>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Booking — <span className="font-mono text-sm">{viewBooking.id}</span>
              </h3>
              <button onClick={() => setViewBooking(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Guest",     viewBooking.guest],
                  ["Room",      viewBooking.room],
                  ["Check-in",  viewBooking.check_in],
                  ["Check-out", viewBooking.check_out],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className="font-semibold text-slate-900">{val}</p>
                  </div>
                ))}
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[viewBooking.status] || "bg-gray-100 text-gray-700"}`}>
                    {viewBooking.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <button onClick={() => setViewBooking(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
