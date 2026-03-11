import { api } from "./api.js";

/** GET /api/reviews — all reviews by the logged-in user */
export async function getReviews() {
  const res = await api.get("/api/reviews");
  return res.data.data;
}

/**
 * POST /api/reviews — submit a review for a completed booking
 * @param {{ booking_id: number, rating: number, comment?: string }} payload
 */
export async function submitReview(payload) {
  const res = await api.post("/api/reviews", payload);
  return res.data;
}
