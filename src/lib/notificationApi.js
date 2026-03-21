import { api } from "./api.js";

/** GET /api/notifications — list + unread count */
export async function getNotifications() {
  const res = await api.get("/api/notifications");
  return res.data; // { data: [...], unread: number }
}

/** PATCH /api/notifications/{id}/read */
export async function markNotificationRead(id) {
  const res = await api.patch(`/api/notifications/${id}/read`);
  return res.data;
}

/** PATCH /api/notifications/read-all */
export async function markAllNotificationsRead() {
  const res = await api.patch("/api/notifications/read-all");
  return res.data;
}
