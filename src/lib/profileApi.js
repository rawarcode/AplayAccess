// src/lib/profileApi.js
import { api } from "./api";

// PATCH /api/profile
export async function updateProfile(payload) {
  const res = await api.patch("/api/profile", payload);
  return res.data; // { user }
}

// POST /api/change-password
export async function changePassword(currentPassword, newPassword) {
  const res = await api.post("/api/change-password", {
    current_password: currentPassword,
    password: newPassword,
    password_confirmation: newPassword,
  });
  return res.data;
}
