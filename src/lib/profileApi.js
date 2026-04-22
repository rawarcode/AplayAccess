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

// GET /api/account/export (PDF)
export async function exportAccountData() {
  const res = await api.get("/api/account/export", { responseType: "blob" });
  return res.data;
}

// DELETE /api/account
export async function deleteAccount() {
  const res = await api.delete("/api/account");
  return res.data;
}

// ── Email-change flow ────────────────────────────────────────────────
// These hit ProfileController's pending-email endpoints. The initial
// request goes through updateProfile() above with `current_password`
// plus the new `email`; the response carries `email_change_pending`
// and the new `pending_email` so the frontend can route the user to
// the verification page.

// POST /api/verify-email-change
export async function verifyEmailChange(code) {
  const res = await api.post("/api/verify-email-change", { code });
  return res.data; // { message, user }
}

// POST /api/resend-email-change-otp
export async function resendEmailChangeOtp() {
  const res = await api.post("/api/resend-email-change-otp");
  return res.data;
}

// POST /api/cancel-email-change
export async function cancelEmailChange() {
  const res = await api.post("/api/cancel-email-change");
  return res.data; // { message, user }
}
