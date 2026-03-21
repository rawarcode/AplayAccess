// src/lib/ownerApi.js
import { api } from "./api";

// GET /api/admin/analytics/overview
export const getOverview = () =>
  api.get("/api/admin/analytics/overview").then((r) => r.data.data);

// GET /api/admin/analytics/bookings?days=X  (daily revenue data)
export const getBookingsChart = (days = 365) =>
  api.get(`/api/admin/analytics/bookings?days=${days}`).then((r) => r.data.data);

// GET /api/admin/analytics/revenue?days=X
export const getRevenue = (days = 30) =>
  api.get(`/api/admin/analytics/revenue?days=${days}`).then((r) => r.data.data);

// GET /api/admin/bookings  (all bookings with guest info)
export const getRecentBookings = () =>
  api.get("/api/admin/bookings").then((r) => r.data.data);

// PATCH /api/profile
export const updateProfile = (data) =>
  api.patch("/api/profile", data).then((r) => r.data.user);

// POST /api/change-password
export const changePassword = (data) =>
  api.post("/api/change-password", data).then((r) => r.data);
