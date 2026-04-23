# AplayAccess — Frontend

Aplaya Beach Resort booking system (Capstone).

> **Docs hygiene:** this file only carries things that change slowly or
> can be verified at a glance. Schema, endpoint lists, pricing tables,
> and "completed tasks" logs live in the actual code (migrations,
> routes, seeders) and in git history — not here. If a claim in this
> file starts disagreeing with the code, trust the code and delete
> the claim.

---

## Repos & deployment

- **Frontend:** `rawarcode/AplayAccess` → Vercel → `https://aplayabeachresort.com`
- **Backend:** `michaelmj23/AplayAccess-Backend` → Railway → `https://api.aplayabeachresort.com`
- **User's mirror target:** `michaelmj23/AplayAccess` (frontend) and `michaelmj23/AplayAccess-Backend` (backend). Use the `/mirror` skill to push to the user's copy.
- **Backend local path:** `E:\Capstone\AplayAccess-Backend`
- **Backend scheduler on Railway:** separate cron service named `bubbly-freedom`, runs `php artisan schedule:run` every 5 min via `*/5 * * * *`.

## Stack

React 19 · Vite 7 · Tailwind CSS v4 (via `@theme` in `src/index.css`, no `tailwind.config.js`) · React Router v7 · Axios · Laravel 12 · Sanctum (Bearer tokens, no CSRF) · MySQL.

## Dev

- Frontend: `npm run dev` → http://localhost:5173
- Backend (local): XAMPP MySQL + `php artisan serve` → http://localhost:8000
- Re-seed: `php artisan migrate:fresh --seed` from backend folder

## Test accounts

| Email | Password | Role |
|---|---|---|
| test@example.com | password | guest |
| frontdesk@aplayaccess.test | password | front_desk |
| owner@aplayaccess.test | password | owner |

## Portals

| Portal | Pages | Shell | URL prefix |
|---|---|---|---|
| Guest | `src/pages/dashboard/` | `src/components/dashboard/DashboardShell.jsx` | `/dashboard` |
| Owner | `src/pages/owner/` | `src/components/owner/OwnerShell.jsx` | `/owner` |
| Front desk | `src/frontdesk/components/` | `src/frontdesk/components/Layout/Sidebar.jsx` (composed per page, not a single shell) | `/frontdesk` |

Legacy `/admin/*` routes redirect to `/owner/*`. The `admin` role was consolidated into `owner`; the `admin_role` middleware still exists and behaves as owner-only.

## Auth + storage

- Token in `localStorage['aplaya_token']`, mirrored user object in `aplaya_user_v1`.
- `src/lib/api.js` axios instance injects `Authorization: Bearer`.
- `src/context/AuthContext.jsx` owns session state + `login()`, `logout()`, `refreshUser()`.
- Google Sign-In via `@react-oauth/google` `useGoogleLogin({flow:'implicit'})` → backend verifies access_token via `/api/auth/google`.

## Middleware roles (backend)

- `staff` — front_desk + owner
- `admin_role` — owner only (legacy name)
- `owner_role` — owner only

## Ground truth — don't re-state here, read these

| Need to know... | Go read |
|---|---|
| What columns exist on a table | `E:\Capstone\AplayAccess-Backend\database\migrations\*_<table_name>*.php` in filename order |
| Full API endpoint list | `E:\Capstone\AplayAccess-Backend\routes\api.php` |
| What a model is allowed to fill | The model's `$fillable` in `app/Models/*.php` |
| Pricing / entrance fees defaults | `Setting::pricing()` + `SettingSeeder` — rates are editable at runtime via `/owner/settings` |
| What rooms exist + rates | `database/seeders/RoomSeeder.php` (or the live DB — rates are editable by the owner) |
| Booking types and slot windows | `booking_type` column is enum-like (`day`, `night`, `24hr`, `24hr-pm`). `is24hr === '24hr' || '24hr-pm'` is the common coalescing check across the app. |
| Room categories | `category` column on `rooms` — values seen in code: `room`, `cottage`, `pavilion`, `tent`, `admission` (the last is a pseudo-room for gate-only walk-ins) |

## Stable notes that the code doesn't fully spell out

- **Pricing model (structural, not numeric):** Bookings store **room rate only** in `bookings.total`. Entrance fee is a **separate column** (`bookings.entrance_fee`) charged per pax and collected at the gate / billing counter. Add-ons live in `booking_amenities` with a snapshot `unit_price`. The grand total a guest sees = `total + entrance_fee + sum(amenities.total)`. Receipt PDF reconstructs this.
- **Add-on inventory:** `addons.max_qty` is the total physical units the resort owns (not a per-booking cap). Pool tracking is **global, not windowed** — the helper `BookingAmenity::allocatedTotal($addonId, $exceptBookingId)` sums qty across every active booking (Pending/Confirmed/Checked-In), regardless of dates. Staff feedback was that the windowed model (where non-overlapping bookings shared pool units because "pillows come back between stays") was confusing; they want a single "N still available across the resort" number. `allocatedInWindow()` still exists as a thin back-compat alias that ignores its start/end args. Live remaining counts come from `GET /api/admin/addons/availability` — two modes: `?booking_id=X` (excludes own allocation) or `?date=Y&booking_type=Z&hour=W` (walk-in slot).
- **Auto-checkin:** 24-hour and 24hr-pm bookings get auto-checked-in via scheduled command `bookings:auto-checkin-24hr` when their `check_in` hour arrives. Cron runs every 5 min on Railway. Related: `bookings:cancel-expired` sweeps Pending bookings unpaid for 30+ min.
- **Email change (sensitive action):** Password-gated + verify-before-swap. `PATCH /api/profile` with a new email requires `current_password`, then stores the new address in `pending_email` with its own OTP. Real swap happens only when `POST /api/verify-email-change` consumes the code. Google-linked users (`users.google_id` set) can't change email/password from the app — the Edit Profile UI hides those controls.
- **Messaging:** One-thread-per-guest — `POST /api/messages` from a guest who already has a thread appends to it rather than creating a new root. Staff can initiate threads via `POST /api/admin/messages/compose`. Abusive guests can be flagged via `POST /api/admin/users/{user}/toggle-messaging-block`. Rate limits: 5 new / 10 replies per minute.
- **Receipts are Booking Confirmations, not Official Receipts.** The PDF + email are labeled "Booking Confirmation" and carry a BIR disclaimer. Actual ORs are issued manually at the counter from a BIR-registered booklet.
- **Timezone:** `config/app.php` reads `APP_TIMEZONE` from env, defaults to `Asia/Manila`. Railway must have this set or the scheduler's `now()` drifts 8 hours behind the DB's Manila-time booking rows and the auto-checkin query silently excludes everything.

## User preferences (observed)

- Terse responses. No trailing summaries of what you did — the diff is readable.
- Ship-oriented: when a plan is agreed, execute; don't re-propose.
- Decisive one-word replies ("go", "ship", "yes") = full approval to execute the most recently-scoped plan.
- Will push back hard and bluntly on sloppy work — good. Take the correction directly, don't soften.
- **Verify → plan → code.** For any non-trivial ask: first read the actual code to confirm the issue is real (a user bug report may describe a symptom whose root cause is elsewhere, or may be based on a stale deploy / misunderstood feature — don't trust it at face value). Then state a 1–2 sentence plan so the user can redirect before code is written. Only then edit. Trivial one-liners (typos, obvious tailwind tweaks) can skip the plan step; when in doubt, plan. Explicitly requested after three back-to-back "fixes" that each missed the actual requirement.

## Known hazards (learned the hard way)

- **Don't trust `.md` docs for schema.** Migrations directory is the only source. This file used to claim `housekeeping_status` and `is_active` existed on `rooms` — neither did, and a migration trusting the doc crashed production.
- **Tailwind v4 has no `tailwind.config.js`.** Design tokens live in `src/index.css` under `@theme { ... }`. Adding custom colors means editing that block.
- **`/api/admin/*` is accessible by BOTH front_desk AND owner** (not just "admin"). The URL prefix is misleading.
- **Emoji can't render inside native `<option>` or `<optgroup>`** — Font Awesome won't work there either. Walk-In room picker keeps emoji deliberately; everywhere else uses FA.

## Docs maintenance rule

When a commit changes any of: migrations, `routes/api.php`, model `$fillable`, middleware roles, test accounts, portal URLs, scheduler behavior, or auth flow — update the affected section in this file **in the same commit**. If it doesn't update, it's rotting. The most recent housekeeping_status / is_active drift happened because six sessions of schema changes landed without a single doc sync.
