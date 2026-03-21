// src/lib/bookingApi.js
import { api } from "./api";

// GET /api/bookings → returns array of user's bookings
export async function getBookings() {
  const res = await api.get("/api/bookings");
  return res.data.data;
}

// POST /api/bookings → creates a booking
export async function createBooking(payload) {
  const res = await api.post("/api/bookings", payload);
  return res.data;
}

// PATCH /api/bookings/{id}/cancel — id is the integer DB id (booking_id)
export async function cancelBooking(bookingId) {
  const res = await api.patch(`/api/bookings/${bookingId}/cancel`);
  return res.data;
}
