import { api } from './api';

// ── Dashboard ────────────────────────────────────────────────────────────────
export const getAdminStats     = ()         => api.get('/api/admin/stats');

// ── Activity History ─────────────────────────────────────────────────────────
export const getAdminHistory   = (params)   => api.get('/api/admin/history', { params });

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

// ── Page Content (site builder) ───────────────────────────────────────────────
export const updateAdminContent  = (content)    => api.patch('/api/admin/content', { content });

// ── Add-ons ──────────────────────────────────────────────────────────────────
export const getAdminAddons    = ()         => api.get('/api/admin/addons');
export const createAdminAddon  = (data)     => api.post('/api/admin/addons', data);
export const updateAdminAddon  = (id, data) => api.patch(`/api/admin/addons/${id}`, data);
export const deleteAdminAddon  = (id)       => api.delete(`/api/admin/addons/${id}`);

// ── Gallery ───────────────────────────────────────────────────────────────────
export const getAdminGallery          = ()           => api.get('/api/admin/gallery');
export const createAdminGallery       = (data)       => api.post('/api/admin/gallery', data);
export const updateAdminGallery       = (id, data)   => api.patch(`/api/admin/gallery/${id}`, data);
export const batchFeaturedGallery     = (featuredIds) => api.put('/api/admin/gallery/featured', { featured_ids: featuredIds });
export const deleteAdminGallery       = (id)         => api.delete(`/api/admin/gallery/${id}`);

// ── Contact Submissions ───────────────────────────────────────────────────────
export const getAdminContacts   = ()         => api.get('/api/admin/contacts');

// ── Messages ─────────────────────────────────────────────────────────────────
export const getAdminMessages       = ()           => api.get('/api/admin/messages');
export const replyAdminMessage      = (id, body)   => api.post(`/api/admin/messages/${id}/reply`, { body });
export const markAdminMessageRead   = (id)         => api.patch(`/api/admin/messages/${id}/read`);

// ── Analytics (owner only) ────────────────────────────────────────────────────
export const getAnalyticsOverview  = ()              => api.get('/api/admin/analytics/overview');
export const getAnalyticsBookings  = (days = 30)     => api.get(`/api/admin/analytics/bookings?days=${days}`);
export const getAnalyticsRevenue   = (days = 30)     => api.get(`/api/admin/analytics/revenue?days=${days}`);
export const getAnalyticsOccupancy = ()              => api.get('/api/admin/analytics/occupancy');
export const getAnalyticsRooms     = (days = 30)     => api.get(`/api/admin/analytics/rooms?days=${days}`);
export const getAnalyticsReport    = (month, year)   => api.get(`/api/admin/analytics/report?month=${month}&year=${year}`);

// ── Promo Codes ──────────────────────────────────────────────────────────────
export const getPromoCodes         = ()         => api.get('/api/admin/promo-codes');
export const createPromoCode       = (data)     => api.post('/api/admin/promo-codes', data);
export const updatePromoCode       = (id, data) => api.patch(`/api/admin/promo-codes/${id}`, data);
export const deletePromoCode       = (id)       => api.delete(`/api/admin/promo-codes/${id}`);
export const validatePromo         = (code, subtotal) => api.post('/api/validate-promo', { code, subtotal });
