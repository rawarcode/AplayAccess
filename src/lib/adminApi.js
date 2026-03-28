import { api } from './api';

// ── Dashboard ────────────────────────────────────────────────────────────────
export const getAdminStats     = ()         => api.get('/api/admin/stats');

// ── Rooms ────────────────────────────────────────────────────────────────────
export const getAdminRooms     = ()         => api.get('/api/admin/rooms');
export const createAdminRoom   = (data)     => api.post('/api/admin/rooms', data);
export const updateAdminRoom   = (id, data) => api.patch(`/api/admin/rooms/${id}`, data);
export const deleteAdminRoom   = (id)       => api.delete(`/api/admin/rooms/${id}`);

// ── Guests ───────────────────────────────────────────────────────────────────
export const getAdminGuests    = ()         => api.get('/api/admin/guests');

// ── Staff Users ──────────────────────────────────────────────────────────────
export const getAdminUsers     = ()         => api.get('/api/admin/users');
export const createAdminUser   = (data)     => api.post('/api/admin/users', data);
export const updateAdminUser   = (id, data) => api.patch(`/api/admin/users/${id}`, data);
export const deleteAdminUser   = (id)       => api.delete(`/api/admin/users/${id}`);

// ── Bookings / Transactions ───────────────────────────────────────────────────
export const getAdminBookings  = ()         => api.get('/api/admin/bookings');

// ── Reviews ──────────────────────────────────────────────────────────────────
export const getAdminReviews   = ()         => api.get('/api/admin/reviews');
export const updateAdminReview = (id, data) => api.patch(`/api/admin/reviews/${id}`, data);
export const deleteAdminReview = (id)       => api.delete(`/api/admin/reviews/${id}`);

// ── Settings ─────────────────────────────────────────────────────────────────
export const getAdminSettings    = ()           => api.get('/api/admin/settings');
export const updateAdminSettings = (settings)   => api.patch('/api/admin/settings', { settings });

// ── Add-ons ──────────────────────────────────────────────────────────────────
export const getAdminAddons    = ()         => api.get('/api/admin/addons');
export const createAdminAddon  = (data)     => api.post('/api/admin/addons', data);
export const updateAdminAddon  = (id, data) => api.patch(`/api/admin/addons/${id}`, data);
export const deleteAdminAddon  = (id)       => api.delete(`/api/admin/addons/${id}`);

// ── Gallery ───────────────────────────────────────────────────────────────────
export const getAdminGallery    = ()         => api.get('/api/admin/gallery');
export const createAdminGallery = (data)     => api.post('/api/admin/gallery', data);
export const updateAdminGallery = (id, data) => api.patch(`/api/admin/gallery/${id}`, data);
export const deleteAdminGallery = (id)       => api.delete(`/api/admin/gallery/${id}`);

// ── Contact Submissions ───────────────────────────────────────────────────────
export const getAdminContacts   = ()         => api.get('/api/admin/contacts');
