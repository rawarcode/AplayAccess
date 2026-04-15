// src/lib/bookingApi.js
import { api } from "./api";

// GET /api/bookings → returns array of user's bookings
export async function getBookings() {
  const res = await api.get("/api/bookings");
  return res.data.data;
}

// POST /api/bookings → creates a booking (requires auth)
export async function createBooking(payload) {
  const res = await api.post("/api/bookings", payload);
  return res.data;
}

// POST /api/guest-booking → creates a booking without an account (public)
export async function createGuestBooking(payload) {
  const res = await api.post("/api/guest-booking", payload);
  return res.data;
}

// POST /api/guest-payment-link → PayMongo checkout session for guest booking (public)
export async function createGuestPaymentLink(guestToken, payFull = false) {
  const res = await api.post("/api/guest-payment-link", { guest_token: guestToken, pay_full: payFull });
  return res.data;
}

// GET /api/guest-payment-status/{guest_token} → poll payment status (public)
export async function getGuestPaymentStatus(guestToken) {
  const res = await api.get(`/api/guest-payment-status/${guestToken}`);
  return res.data;
}

// POST /api/guest-confirm-payment/{guest_token} → confirm payment after redirect (public)
export async function guestConfirmPayment(guestToken, fullyPaid = false) {
  const res = await api.post(`/api/guest-confirm-payment/${guestToken}`, { fully_paid: fullyPaid });
  return res.data;
}

// PATCH /api/bookings/{id}/cancel — id is the integer DB id (booking_id)
export async function cancelBooking(bookingId) {
  const res = await api.patch(`/api/bookings/${bookingId}/cancel`);
  return res.data;
}

// POST /api/guest-cancel-booking/{guest_token} — cancel a guest booking (no auth)
export async function cancelGuestBooking(guestToken) {
  const res = await api.post(`/api/guest-cancel-booking/${guestToken}`);
  return res.data;
}

// GET /api/bookings/{id}/receipt — download PDF receipt as a blob (auth required)
export async function downloadReceipt(bookingId) {
  const res = await api.get(`/api/bookings/${bookingId}/receipt`, { responseType: 'blob' });
  return res.data;
}

// GET /api/guest-receipt/{guest_token} — download PDF receipt for guest bookings (no auth)
export async function downloadGuestReceipt(guestToken) {
  const res = await api.get(`/api/guest-receipt/${guestToken}`, { responseType: 'blob' });
  return res.data;
}
