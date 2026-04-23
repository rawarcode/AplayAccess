// src/lib/frontdeskApi.js
import { api } from "./api";
import { RESORT_ID } from "./config";

// GET /api/admin/bookings — all bookings (staff + admin only).
// Optional params:
//   from   (YYYY-MM-DD)     — earliest check-in date to return; any
//                             still-Checked-In booking is always included
//                             so in-progress stays don't disappear.
//   to     (YYYY-MM-DD)     — latest check-in date to return.
//   search (string)         — filter by guest name / email / phone /
//                             room name / booking id.
// Pass nothing for the classic "all bookings" behavior.
export async function getFdBookings(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const res = await api.get("/api/admin/bookings", { params: clean });
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
export async function collectPayment(bookingId, paymentMethod, entranceFee) {
  const body = { payment_method: paymentMethod };
  if (entranceFee != null) body.entrance_fee = entranceFee;
  const res = await api.post(`/api/admin/bookings/${bookingId}/collect-payment`, body);
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

// PATCH /api/admin/bookings/{id}/amenities/{amenityId} — edit amenity qty
export async function updateAmenity(bookingId, amenityId, qty) {
  const res = await api.patch(`/api/admin/bookings/${bookingId}/amenities/${amenityId}`, { qty });
  return res.data;
}

// DELETE /api/admin/bookings/{id}/amenities/{amenityId} — remove amenity
export async function removeAmenity(bookingId, amenityId) {
  const res = await api.delete(`/api/admin/bookings/${bookingId}/amenities/${amenityId}`);
  return res.data;
}

// GET /api/admin/addons/availability
// Add-on pool tracking is GLOBAL, not windowed — the resort's physical
// stock is shared across every active booking (Pending / Confirmed /
// Checked-In) regardless of dates, since the same physical units
// aren't teleporting between concurrent stays in practice and staff
// want a single "N pillows still available across the resort" number.
//
// Two calling modes:
//   - addonAvailabilityForBooking(bookingId): excludes the booking's
//     own allocation so the picker/editor shows how many *more* it can
//     take from the pool.
//   - addonAvailabilityForSlot(...): for a walk-in that doesn't have
//     a booking row yet — just reads the full pool state.
// Response: { data: [{id, name, icon, price, max_qty, allocated,
// remaining, per_booking}], window: {check_in, check_out} }
export async function addonAvailabilityForBooking(bookingId) {
  const res = await api.get(`/api/admin/addons/availability`, { params: { booking_id: bookingId } });
  return res.data;
}
export async function addonAvailabilityForSlot({ date, bookingType, hour }) {
  const params = { date, booking_type: bookingType };
  if (bookingType === '24hr' && hour != null) params.hour = hour;
  const res = await api.get(`/api/admin/addons/availability`, { params });
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
