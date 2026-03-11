// src/lib/authApi.js
import { api } from "./api";

// POST /api/login → returns { user, token }
export async function loginRequest(email, password) {
  const res = await api.post("/api/login", { email, password });
  return res.data;
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
