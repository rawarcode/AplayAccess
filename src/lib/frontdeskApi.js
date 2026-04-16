// src/lib/frontdeskApi.js
import { api } from "./api";
import { RESORT_ID } from "./config";

// GET /api/admin/bookings — all bookings (staff + admin only)
export async function getFdBookings() {
  const res = await api.get("/api/admin/bookings");
  return res.data.data;
}

// PATCH /api/admin/bookings/{id}/status
export async function updateBookingStatus(bookingId, status, extra = {}) {
  const res = await api.patch(`/api/admin/bookings/${bookingId}/status`, { status, ...extra });
  return res.data;
}

// POST /api/admin/bookings/{id}/checkin
export async function checkInBooking(bookingId, entranceFee) {
  const payload = entranceFee != null ? { entrance_fee: entranceFee } : {};
  const res = await api.post(`/api/admin/bookings/${bookingId}/checkin`, payload);
  return res.data;
}

// POST /api/admin/bookings/{id}/collect-payment
export async function collectPayment(bookingId, paymentMethod) {
  const res = await api.post(`/api/admin/bookings/${bookingId}/collect-payment`, { payment_method: paymentMethod });
  return res.data;
}

// PATCH /api/admin/bookings/{id}/guests
export async function updateBookingGuests(bookingId, guests) {
  const res = await api.patch(`/api/admin/bookings/${bookingId}/guests`, { guests });
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

// GET /api/resorts/:id/rooms — room list (backend auto-includes tent for authenticated staff)
export async function getFdRooms() {
  const res = await api.get(`/api/resorts/${RESORT_ID}/rooms`);
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

// PATCH /api/admin/bookings/{id}/transfer-room — move a Checked In booking to another room
export async function transferRoom(bookingId, roomId) {
  const res = await api.patch(`/api/admin/bookings/${bookingId}/transfer-room`, { room_id: roomId });
  return res.data;
}

// GET /api/admin/bookings/{id}/receipt — staff downloads PDF receipt as a blob
export async function downloadStaffReceipt(bookingId) {
  const res = await api.get(`/api/admin/bookings/${bookingId}/receipt`, { responseType: 'blob' });
  return res.data;
}
