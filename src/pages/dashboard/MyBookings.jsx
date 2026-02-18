// src/pages/dashboard/MyBookings.jsx
import { useMemo, useState } from "react";
import { sampleBookings } from "../../data/dashboard.js";

function statusPill(status) {
  const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
  if (status === "Confirmed") return `${base} text-blue-700 bg-blue-100`;
  if (status === "Completed") return `${base} text-green-700 bg-green-100`;
  if (status === "Cancelled") return `${base} text-red-700 bg-red-100`;
  if (status === "Pending") return `${base} text-yellow-800 bg-yellow-100`;
  return `${base} text-gray-700 bg-gray-100`;
}

export default function MyBookings() {
  const [items, setItems] = useState(sampleBookings);

  const rows = useMemo(() => items, [items]);

  function cancelBooking(id) {
    setItems((prev) => prev.map((b) => (b.id === id ? { ...b, status: "Cancelled" } : b)));
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-gray-600">View and manage your reservations.</p>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guests</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{b.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{b.roomType}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {b.checkIn} - {b.checkOut}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{b.guests}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">₱{b.total}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={statusPill(b.status)}>{b.status}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                      onClick={() => alert(`Details for ${b.id}`)}
                    >
                      Details
                    </button>

                    {b.status !== "Cancelled" && b.status !== "Completed" && (
                      <button
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                        onClick={() => cancelBooking(b.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No bookings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}