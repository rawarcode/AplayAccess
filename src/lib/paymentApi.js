// src/lib/paymentApi.js
import { api } from "./api";

/**
 * Creates a PayMongo Payment Link for a booking.
 * Returns { checkout_url, link_id, reference_number }
 * Guest selects GCash, Maya, or card on PayMongo's hosted checkout page.
 *
 * @param {number} bookingId  - the booking's database ID
 */
export async function createPaymentLink(bookingId) {
  const res = await api.post("/api/payments/link", {
    booking_id: bookingId,
  });
  return res.data;
}

/**
 * Polls the payment status of a booking.
 * Returns { booking_id, status, paid, paid_at, payment_method }
 *
 * @param {number} bookingId
 */
export async function getPaymentStatus(bookingId) {
  const res = await api.get(`/api/payments/status/${bookingId}`);
  return res.data;
}
