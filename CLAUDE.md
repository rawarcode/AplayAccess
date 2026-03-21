# AplayAccess — Claude Project Memory

## Project Overview
- **Name:** AplayAccess (Aplaya Beach Resort booking system)
- **Type:** Capstone project — React SPA (guest frontend) + Laravel API (backend)
- **Frontend repo:** AplayAccess (this repo) — branch `GUEST` (merged to `main`)
- **Backend repo:** AplayAccess-Backend — branch `main`
- **Frontend stack:** React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 + Axios
- **Backend stack:** Laravel 12 + Sanctum Bearer token auth + MySQL (XAMPP)
- **Backend URL:** http://localhost:8000
- **Frontend URL:** http://localhost:5173

## Business Model
- Day-use beach resort (NOT a hotel) — guests book 8-hour slots
- **Flat rate: ₱1,500 per slot** regardless of room type
- Guest picks a date + start time (7AM, 9AM, 11AM, 1PM, 2PM)
- Backend auto-calculates check_out = check_in + 8 hours
- Overlap/availability check prevents double-booking
- ₱150 reservation fee paid upfront, ₱1,350 balance on arrival

## Running the Project
```bash
# Backend (terminal 1)
cd AplayAccess-Backend
php artisan serve          # → http://localhost:8000

# Frontend (terminal 2)
cd AplayAccess
npm run dev                # → http://localhost:5173

# Re-seed database (wipes all data)
cd AplayAccess-Backend
php artisan migrate:fresh --seed
```

## Architecture — Frontend
- `src/main.jsx` — entry: BrowserRouter > AuthProvider > App
- `src/App.jsx` — routes: Layout wraps all pages; /dashboard uses RequireAuth
- `src/context/AuthContext.jsx` — auth state; localStorage `aplaya_user_v1` (user) + `aplaya_token` (Bearer token); restores session via me() on boot
- `src/lib/api.js` — axios instance (baseURL localhost:8000); interceptor adds `Authorization: Bearer <token>`
- `src/lib/authApi.js` — login/register/me/logout (NO CSRF, token-based)
- `src/lib/bookingApi.js` — getBookings, createBooking, cancelBooking
- `src/lib/messageApi.js` — getMessages, sendMessage, replyMessage, markMessageRead
- `src/lib/notificationApi.js` — getNotifications, markNotificationRead, markAllNotificationsRead
- `src/lib/profileApi.js` — updateProfile, changePassword
- `src/lib/reviewApi.js` — getReviews, submitReview
- `src/lib/resortApi.js` — getResorts, getResort, getResortRooms, getResortAmenities

## Pages & Components — Frontend
- `Home.jsx` — multi-resort landing (Cavite, Cebu, Bohol)
- `Resort.jsx` — main resort page (RESORT_ID=1); BookingModal, LoginModal, SuccessModal, AlertModal; contact form + newsletter form both wired to API
- `Gallery.jsx` — photo gallery page
- `Signup.jsx` — signup page
- `Navbar.jsx` — fixed nav with Login/Signup modals
- `Layout.jsx` — Navbar + Outlet + Footer
- `components/dashboard/DashboardShell.jsx` — sidebar nav + NotificationBell (real-time polling every 60s) + header
- `RequireAuth.jsx` — redirects unauthenticated to /resort?login=1&next=<path>
- `components/modals/BookingModal.jsx` — date + time slot picker, flat ₱1,500 rate, calls POST /api/bookings

## Dashboard Pages — All API-connected
- `GuestDashboard.jsx` — real booking data from API; upcoming/past split; fmtDateTime helper
- `MyBookings.jsx` — full booking table with inline CancelModal (no browser confirm/alert)
- `EditProfile.jsx` — PATCH /api/profile; saves to AuthContext
- `Messages.jsx` — fully wired: getMessages, sendMessage, replyMessage, markMessageRead, changePassword

## Key Data Files (fallbacks)
- `src/data/rooms.js` — fallback room data (all prices: 1500)
- `src/data/amenities.js` — fallback amenity data
- `src/data/gallery.js` — gallery images
- `src/data/testimonials.js` — testimonial data

## Architecture — Backend
- **Location:** AplayAccess-Backend (separate repo)
- **Database:** aplayaccess (MySQL, root, no password)
- **Auth:** Sanctum Bearer token. Login returns {user, token}. Token in localStorage `aplaya_token`
- **CORS:** config/cors.php — allows localhost:5173 and 127.0.0.1:5173

## Backend Models
- User (role: guest/front_desk/admin/owner)
- Resort, Room, Amenity, GalleryImage
- Booking (check_in/check_out are dateTime, 8-hour slots)
- Message, UserNotification
- ContactSubmission
- PromoCode (created_by, type: percentage/fixed, max_uses, expires_at, is_active)
- NewsletterSubscription

## Backend Migrations (in order)
1. users table + phone/avatar + role column
2. resorts, rooms, amenities tables
3. bookings table (dateTime check_in/check_out, taxes default 0)
4. reviews, messages, user_notifications, gallery_images tables
5. contact_submissions table
6. promo_codes table
7. newsletter_subscriptions table

## Guest API Endpoints (routes/api.php)
**Public:**
- POST /api/register, /api/login
- GET /api/resorts, /api/resorts/{id}, /api/resorts/{id}/rooms, /api/resorts/{id}/amenities, /api/resorts/{id}/room-types, /api/resorts/{id}/gallery, /api/resorts/{id}/reviews
- POST /api/contact
- POST /api/newsletter

**Auth required (Bearer token):**
- POST /api/logout, GET /api/me
- GET/POST /api/bookings, PATCH /api/bookings/{id}/cancel
- PATCH /api/profile, POST /api/change-password
- GET/POST /api/messages, POST /api/messages/{id}/reply, PATCH /api/messages/{id}/read
- GET /api/notifications, PATCH /api/notifications/read-all, PATCH /api/notifications/{id}/read
- GET/POST /api/reviews

## Admin API Endpoints (/api/admin/*)
**Public:**
- POST /api/admin/login (rejects guests, returns Sanctum token)

**Auth required:**
- GET /api/admin/me, POST /api/admin/logout

**staff middleware (front_desk + admin):**
- GET /api/admin/bookings, PATCH /api/admin/bookings/{id}/status
- GET /api/admin/messages, POST /api/admin/messages/{id}/reply, PATCH /api/admin/messages/{id}/read
- GET /api/admin/contacts

**admin_role middleware (admin only):**
- GET/POST /api/admin/rooms, PATCH/DELETE /api/admin/rooms/{id}
- GET/POST /api/admin/gallery, DELETE /api/admin/gallery/{id}

**owner_role middleware (owner only):**
- GET /api/admin/analytics/overview, /bookings, /revenue
- GET/POST /api/admin/promo-codes, PATCH/DELETE /api/admin/promo-codes/{id}
- GET /api/admin/newsletter

## Admin Controllers (app/Http/Controllers/Admin/)
- AuthController — login (rejects guests), me, logout
- BookingController — index (all bookings with guest info), updateStatus
- MessageController — index (threads), reply, markRead
- ContactController — index
- RoomController — index, store, update, destroy
- GalleryController — index, store, destroy
- AnalyticsController — overview, bookings (daily), revenue (period)
- PromoCodeController — index, store, update, destroy
- NewsletterController — index (subscriber list + count)

## Middleware (app/Http/Middleware/)
- StaffMiddleware — allows front_desk + admin roles
- AdminMiddleware — allows admin role only
- OwnerMiddleware — allows owner role only
- Registered in bootstrap/app.php as: staff, admin_role, owner_role

## Test Accounts
| Email | Password | Role |
|---|---|---|
| test@example.com | password | guest |
| frontdesk@aplaya.com | password | front_desk |
| admin@aplaya.com | password | admin |
| owner@aplaya.com | password | owner |

## Seeders (DatabaseSeeder calls in order)
ResortSeeder, RoomSeeder, AmenitySeeder, UserSeeder, ReviewSeeder, GallerySeeder, StaffSeeder

## Key Patterns
- `fmtDateTime(str)` — converts "2026-03-20 07:00" → "Mar 20, 2026 7:00 AM" using `.replace(" ", "T")` for Safari compat
- `useLockBodyScroll(open)` — hook used in all modals
- Booking overlap check: `check_in < new_checkout AND check_out > new_checkin`
- Admin frontend is delegated to another team — backend scaffold only done

## User Preferences
- Filipino context (₱ currency, GCash/PayMaya, Philippines address)
- Paths on dev PC: frontend at E:\Capstone\AplayAccess, backend at E:\Capstone\AplayAccess-Backend
- GitHub: https://github.com/rawarTheNewbie/AplayAccess
