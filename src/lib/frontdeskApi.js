// src/lib/frontdeskApi.js
import { api } from "./api";

// GET /api/admin/bookings — all bookings (staff + admin only)
export async function getFdBookings() {
  const res = await api.get("/api/admin/bookings");
  return res.data.data;
}

// PATCH /api/admin/bookings/{id}/status
export async function updateBookingStatus(bookingId, status) {
  const res = await api.patch(`/api/admin/bookings/${bookingId}/status`, { status });
  return res.data;
}

// POST /api/admin/bookings/{id}/checkin
export async function checkInBooking(bookingId) {
  const res = await api.post(`/api/admin/bookings/${bookingId}/checkin`);
  return res.data;
}

// POST /api/admin/bookings/{id}/checkout
export async function checkOutBooking(bookingId) {
  const res = await api.post(`/api/admin/bookings/${bookingId}/checkout`);
  return res.data;
}

// POST /api/admin/walkin-booking — create walk-in booking under the guest's own account
export async function createWalkInBooking(payload) {
  const res = await api.post("/api/admin/walkin-booking", payload);
  return res.data;
}

// GET /api/resorts/1/rooms — room list with housekeeping_status
export async function getFdRooms() {
  const res = await api.get("/api/resorts/1/rooms");
  return res.data.data ?? res.data;
}

// POST /api/admin/bookings/{id}/amenities — add amenity to booking
export async function addAmenity(bookingId, name, qty) {
  const res = await api.post(`/api/admin/bookings/${bookingId}/amenities`, { name, qty });
  return res.data;
}

// DELETE /api/admin/bookings/{id}/amenities/{amenityId} — remove amenity
export async function removeAmenity(bookingId, amenityId) {
  const res = await api.delete(`/api/admin/bookings/${bookingId}/amenities/${amenityId}`);
  return res.data;
}

// PATCH /api/admin/rooms/{id}/housekeeping
export async function updateHousekeeping(roomId, status) {
  const res = await api.patch(`/api/admin/rooms/${roomId}/housekeeping`, { status });
  return res.data;
}
