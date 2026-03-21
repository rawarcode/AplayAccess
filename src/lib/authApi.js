// src/lib/authApi.js
import { api } from "./api";

// POST /api/login → tries admin login first (owner/admin/front_desk),
// falls back to guest login if the account is not a staff account.
export async function loginRequest(email, password) {
  try {
    // Try staff login first — returns a token that works with admin API routes
    const res = await api.post("/api/admin/login", { email, password });
    return res.data;
  } catch (err) {
    // 403 means it's a guest account — fall back to regular login
    if (err?.response?.status === 403) {
      const res = await api.post("/api/login", { email, password });
      return res.data;
    }
    throw err;
  }
}

// POST /api/register → returns { user, token }
export async function registerRequest(payload) {
  const res = await api.post("/api/register", payload);
  return res.data;
}

// GET /api/me → returns user object (requires Bearer token)
export async function meRequest() {
  const res = await api.get("/api/me");
  return res.data;
}

// POST /api/logout (requires Bearer token)
export async function logoutRequest() {
  const res = await api.post("/api/logout");
  return res.data;
}
