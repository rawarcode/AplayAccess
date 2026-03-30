// src/pages/dashboard/GuestDashboard.jsx
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getBookings } from "../../lib/bookingApi.js";
import { getResortRooms } from "../../lib/resortApi.js";
import BookingModal from "../../components/modals/BookingModal.jsx";
import SuccessModal from "../../components/modals/SuccessModal.jsx";

/** Converts "2026-03-20 07:00" → "Mar 20, 2026 7:00 AM" */
function fmtDateTime(str) {
  if (!str) return str;
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return str;
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function GuestDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [rooms, setRooms]       = useState([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [lastBooking, setLastBooking] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);

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
        }))
      ))
      .catch(() => {});
  }, []);

  // Open booking modal when ?book=1 is in the URL
  useEffect(() => {
    if (searchParams.get("book") === "1") {
      setBookingOpen(true);
      navigate("/dashboard", { replace: true });
    }
  }, [searchParams, navigate]);

  const { upcoming, past, pendingCount } = useMemo(() => {
    const now = new Date();
    const upcoming = [];
    const past = [];
    let pendingCount = 0;

    for (const b of bookings) {
      const ci = new Date(b.checkIn);
      if (b.status === "Pending") pendingCount += 1;
      if (ci >= now) upcoming.push(b);
      else past.push(b);
    }

    return { upcoming, past, pendingCount };
  }, [bookings]);

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

      <div className="bg-white rounded-xl shadow-md p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Guest Dashboard</h1>
          <p className="text-gray-600">Manage your bookings, profile, and messages.</p>
        </div>
        <button
          onClick={() => setBookingOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium"
        >
          Book a Stay
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-100 p-4 rounded-lg shadow-sm text-center">
          <p className="text-sm font-medium text-gray-700">Upcoming Bookings</p>
          <p className="text-2xl font-bold text-blue-700">{loading ? "—" : upcoming.length}</p>
        </div>
        <div className="bg-green-100 p-4 rounded-lg shadow-sm text-center">
          <p className="text-sm font-medium text-gray-700">Past Bookings</p>
          <p className="text-2xl font-bold text-green-700">{loading ? "—" : past.length}</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded-lg shadow-sm text-center">
          <p className="text-sm font-medium text-gray-700">Pending Actions</p>
          <p className="text-2xl font-bold text-yellow-700">{loading ? "—" : pendingCount}</p>
        </div>
      </div>

      {/* Upcoming + Past preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Bookings</h2>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-400 text-sm">Loading...</p>
            ) : upcoming.length === 0 ? (
              <p className="text-gray-500">No upcoming bookings.</p>
            ) : (
              upcoming.slice(0, 3).map((b) => (
                <div key={b.id} className="border rounded-lg p-4 shadow-sm">
                  <p className="font-bold text-gray-800">{b.roomType}</p>
                  <p className="text-sm text-gray-600">
                    {fmtDateTime(b.checkIn)} – {fmtDateTime(b.checkOut)}
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
            {loading ? (
              <p className="text-gray-400 text-sm">Loading...</p>
            ) : past.length === 0 ? (
              <p className="text-gray-500">No past bookings yet.</p>
            ) : (
              past.slice(0, 3).map((b) => (
                <div key={b.id} className="border rounded-lg p-4 shadow-sm">
                  <p className="font-bold text-gray-800">{b.roomType}</p>
                  <p className="text-sm text-gray-600">
                    {fmtDateTime(b.checkIn)} – {fmtDateTime(b.checkOut)}
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
