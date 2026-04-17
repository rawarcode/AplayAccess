import { api } from './api';

// ── Dashboard ────────────────────────────────────────────────────────────────
export const getAdminStats     = ()         => api.get('/api/admin/stats');

// ── Activity History ─────────────────────────────────────────────────────────
export const getAdminHistory   = (params)   => api.get('/api/admin/history', { params });

// ── Resort Amenities (site builder) ──────────────────────────────────────────
export const getResortAmenities    = ()              => api.get('/api/admin/resort-amenities');
export const createResortAmenity   = (data)          => api.post('/api/admin/resort-amenities', data);
export const updateResortAmenity   = (id, data)      => api.patch(`/api/admin/resort-amenities/${id}`, data);
export const deleteResortAmenity   = (id)            => api.delete(`/api/admin/resort-amenities/${id}`);

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
export const getAdminBookings       = ()              => api.get('/api/admin/bookings');
export const applyPromoToBooking    = (id, promoCode) => api.patch(`/api/admin/bookings/${id}/promo`, { promo_code: promoCode });

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
export const batchCreateGallery      = (images)     => api.post('/api/admin/gallery/batch', { images });
export const renameCategoryGallery   = (oldName, newName) => api.patch('/api/admin/gallery/rename-category', { old_name: oldName, new_name: newName });
export const toggleCategoryHidden    = (category, isHidden) => api.patch('/api/admin/gallery/toggle-category-hidden', { category, is_hidden: isHidden });

// ── Contact Submissions ───────────────────────────────────────────────────────
export const getAdminContacts   = ()         => api.get('/api/admin/contacts');

// ── Messages ─────────────────────────────────────────────────────────────────
export const getAdminMessages       = ()           => api.get('/api/admin/messages');
export const replyAdminMessage      = (id, body)   => api.post(`/api/admin/messages/${id}/reply`, { body });
export const markAdminMessageRead   = (id)         => api.patch(`/api/admin/messages/${id}/read`);
export const deleteAdminMessage     = (id)         => api.delete(`/api/admin/messages/${id}`);

// ── Auto-Reply Rules ─────────────────────────────────────────────────────────
export const getAutoReplies          = ()         => api.get('/api/admin/auto-replies');
export const createAutoReply         = (data)     => api.post('/api/admin/auto-replies', data);
export const updateAutoReply         = (id, data) => api.patch(`/api/admin/auto-replies/${id}`, data);
export const deleteAutoReply         = (id)       => api.delete(`/api/admin/auto-replies/${id}`);

// ── Analytics (owner only) ────────────────────────────────────────────────────
export const getAnalyticsOverview  = ()              => api.get('/api/admin/analytics/overview');
export const getAnalyticsBookings  = (days = 30)     => api.get(`/api/admin/analytics/bookings?days=${days}`);
export const getAnalyticsRevenue   = (days = 30)     => api.get(`/api/admin/analytics/revenue?days=${days}`);
export const getAnalyticsOccupancy = ()              => api.get('/api/admin/analytics/occupancy');
export const getAnalyticsRooms     = (days = 30)     => api.get(`/api/admin/analytics/rooms?days=${days}`);
export const getAnalyticsMonthly   = (months = 6)    => api.get(`/api/admin/analytics/monthly?months=${months}`);
export const getAnalyticsReport    = (month, year)   => api.get(`/api/admin/analytics/report?month=${month}&year=${year}`);

// ── Promo Codes ──────────────────────────────────────────────────────────────
export const getPromoCodes         = ()         => api.get('/api/admin/promo-codes');
export const createPromoCode       = (data)     => api.post('/api/admin/promo-codes', data);
export const updatePromoCode       = (id, data) => api.patch(`/api/admin/promo-codes/${id}`, data);
export const deletePromoCode       = (id)       => api.delete(`/api/admin/promo-codes/${id}`);
export const validatePromo         = (code, subtotal) => api.post('/api/validate-promo', { code, subtotal });

// ── Newsletter (owner only) ───────────────────────────────────────────────────
export const getNewsletterSubscribers  = ()           => api.get('/api/admin/newsletter');
export const sendNewsletterCampaign    = (subject, body) => api.post('/api/admin/newsletter/send', { subject, body });

// ── Announcements ─────────────────────────────────────────────────────────────
export const getAdminAnnouncements    = ()           => api.get('/api/admin/announcements');
export const createAdminAnnouncement  = (data)       => api.post('/api/admin/announcements', data);
export const updateAdminAnnouncement  = (id, data)   => api.patch(`/api/admin/announcements/${id}`, data);
export const deleteAdminAnnouncement  = (id)         => api.delete(`/api/admin/announcements/${id}`);
