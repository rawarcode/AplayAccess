import { api } from "./api.js";

/** GET /api/messages — all message threads for the logged-in user */
export async function getMessages() {
  const res = await api.get("/api/messages");
  return res.data.data;
}

/**
 * POST /api/messages — start a new thread
 * @param {{ subject: string, body: string }} payload
 */
export async function sendMessage(payload) {
  const res = await api.post("/api/messages", payload);
  return res.data;
}

/**
 * POST /api/messages/{id}/reply — reply in a thread
 * @param {number} threadId
 * @param {string} body
 */
export async function replyMessage(threadId, body) {
  const res = await api.post(`/api/messages/${threadId}/reply`, { body });
  return res.data;
}

/**
 * PATCH /api/messages/{id}/read — mark thread as read
 * @param {number} threadId
 */
export async function markMessageRead(threadId) {
  const res = await api.patch(`/api/messages/${threadId}/read`);
  return res.data;
}
