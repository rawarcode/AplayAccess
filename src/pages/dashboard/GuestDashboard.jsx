// src/pages/dashboard/GuestDashboard.jsx
import { Link } from "react-router-dom";
import { useMemo } from "react";
import { sampleBookings } from "../../data/dashboard.js";

export default function GuestDashboard() {
  const { upcoming, past, pendingCount } = useMemo(() => {
    const now = new Date();
    const upcoming = [];
    const past = [];
    let pendingCount = 0;

    for (const b of sampleBookings) {
      const ci = new Date(b.checkIn);
      if (b.status === "Pending") pendingCount += 1;
      if (ci >= now) upcoming.push(b);
      else past.push(b);
    }

    return { upcoming, past, pendingCount };
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Guest Dashboard</h1>
        <p className="text-gray-600">Manage your bookings, profile, and messages.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-100 p-4 rounded-lg shadow-sm text-center">
          <p className="text-sm font-medium text-gray-700">Upcoming Bookings</p>
          <p className="text-2xl font-bold text-blue-700">{upcoming.length}</p>
        </div>
        <div className="bg-green-100 p-4 rounded-lg shadow-sm text-center">
          <p className="text-sm font-medium text-gray-700">Past Bookings</p>
          <p className="text-2xl font-bold text-green-700">{past.length}</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded-lg shadow-sm text-center">
          <p className="text-sm font-medium text-gray-700">Pending Actions</p>
          <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          to="/resort?book=1"
          className="bg-blue-100 text-blue-700 py-3 px-4 rounded-md text-center hover:bg-blue-200 flex flex-col items-center justify-center"
        >
          <span className="font-medium">Book a Stay</span>
        </Link>
        <Link
          to="/dashboard/bookings"
          className="bg-green-100 text-green-700 py-3 px-4 rounded-md text-center hover:bg-green-200 flex flex-col items-center justify-center"
        >
          <span className="font-medium">My Bookings</span>
        </Link>
        <Link
          to="/dashboard/profile"
          className="bg-purple-100 text-purple-700 py-3 px-4 rounded-md text-center hover:bg-purple-200 flex flex-col items-center justify-center"
        >
          <span className="font-medium">Edit Profile</span>
        </Link>
        <Link
          to="/dashboard/messages"
          className="bg-yellow-100 text-yellow-700 py-3 px-4 rounded-md text-center hover:bg-yellow-200 flex flex-col items-center justify-center"
        >
          <span className="font-medium">Messages</span>
        </Link>
      </div>

      {/* Upcoming + Past preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Bookings</h2>
          <div className="space-y-4">
            {upcoming.length === 0 ? (
              <p className="text-gray-500">No upcoming bookings.</p>
            ) : (
              upcoming.slice(0, 3).map((b) => (
                <div key={b.id} className="border rounded-lg p-4 shadow-sm">
                  <p className="font-bold text-gray-800">{b.roomType}</p>
                  <p className="text-sm text-gray-600">
                    {b.checkIn} - {b.checkOut}
                  </p>
                  <p className="text-sm text-gray-600">{b.guests} Guests</p>
                  <p className="text-sm text-gray-600">Booking ID: {b.id}</p>
                  <div className="mt-3">
                    <Link to="/dashboard/bookings" className="text-sm text-blue-600 hover:text-blue-700">
                      View details →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Past Bookings</h2>
          <div className="space-y-4">
            {past.length === 0 ? (
              <p className="text-gray-500">No past bookings yet.</p>
            ) : (
              past.slice(0, 3).map((b) => (
                <div key={b.id} className="border rounded-lg p-4 shadow-sm">
                  <p className="font-bold text-gray-800">{b.roomType}</p>
                  <p className="text-sm text-gray-600">
                    {b.checkIn} - {b.checkOut}
                  </p>
                  <p className="text-sm text-gray-600">Booking ID: {b.id}</p>
                  <div className="mt-3">
                    <Link to="/dashboard/bookings" className="text-sm text-blue-600 hover:text-blue-700">
                      View booking →
                    </Link>
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