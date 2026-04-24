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

- **Frontend source-of-truth repo (where `git push origin main` lands from this workspace):** `rawarcode/AplayAccess`. Pushing here is **not** a deploy — Vercel does not watch this repo.
- **Frontend deploy trigger:** `michaelmj23/AplayAccess` (the "mirror"). **Vercel's GitHub integration is wired to this repo**, so a push to it is what actually rebuilds prod. The `/mirror` skill is therefore the deploy step — not a bookkeeping nicety. **Every frontend ship sequence is: commit → push `rawarcode` → `/mirror` → verify Vercel picked up the new SHA.** Skip the mirror and nothing deploys.
- **Backend:** `michaelmj23/AplayAccess-Backend` → Railway → `https://api.aplayabeachresort.com`. Railway's webhook works directly against this repo — pushes auto-deploy, no mirror step needed.
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
- **Room-attached add-ons (fixtures):** Some add-ons are physically attached to specific rooms — e.g. videoke in Blue/Red Pavilion, Patrice. Modeled via the `room_addons` pivot: `(room_id, addon_id, relation, price, qty)` where `relation` is `'package'` (bundled into the room rate — auto-attached on booking at the per-room price, guest sees one combined total with a "Includes videoke" tag) or `'optional'` (shown in the booking modal's add-on picker only for that specific room, at the per-room price — other rooms don't see it). `price` on the pivot overrides `addons.price` because the same fixture may cost different amounts in different rooms. Shared-pool add-ons (pillows, towel, parking, common table) have no `room_addons` entries and continue to use the global pool. Auto-attach happens in `Api\BookingController::attachPackageAddons()` and the equivalent inline block in `Admin\WalkInController::store()`.
- **Auto-checkin:** 24-hour and 24hr-pm bookings get auto-checked-in via scheduled command `bookings:auto-checkin-24hr` when their `check_in` hour arrives. Cron runs every 5 min on Railway. Related: `bookings:cancel-expired` sweeps Pending bookings unpaid for 30+ min.
- **Email change (sensitive action):** Password-gated + verify-before-swap. `PATCH /api/profile` with a new email requires `current_password`, then stores the new address in `pending_email` with its own OTP. Real swap happens only when `POST /api/verify-email-change` consumes the code. Google-linked users (`users.google_id` set) can't change email/password from the app — the Edit Profile UI hides those controls.
- **Messaging:** One-thread-per-guest — `POST /api/messages` from a guest who already has a thread appends to it rather than creating a new root. Staff can initiate threads via `POST /api/admin/messages/compose`. Abusive guests can be flagged via `POST /api/admin/users/{user}/toggle-messaging-block`. Rate limits: 5 new / 10 replies per minute.
- **Receipts are Booking Confirmations, not Official Receipts.** The PDF + email are labeled "Booking Confirmation" and carry a BIR disclaimer. Actual ORs are issued manually at the counter from a BIR-registered booklet.
- **Timezone:** `config/app.php` reads `APP_TIMEZONE` from env, defaults to `Asia/Manila`. Railway must have this set or the scheduler's `now()` drifts 8 hours behind the DB's Manila-time booking rows and the auto-checkin query silently excludes everything.
- **Room transfer pricing:** `Admin\BookingController::transferRoom` re-prices on **every** transfer, not just upgrades. Formula: `newTotal = max(newRate - discount + amenityTotal, paid_amount)`. The `max(..., paid_amount)` clamp is the no-refund-on-downgrade policy: if the guest already paid more than the new room costs, total stays at `paid_amount` (balance 0, resort absorbs the delta) instead of going negative. Transfer-back-after-upgrade case correctly returns total to the original rate. `fully_paid` re-derives against the new total.
- **Room transfer guards:** Two rejections beyond the overlap/quantity check — target room category must not be `admission` (pseudo-room for gate-only walk-ins, day_rate=0), and if the target has `allowed_booking_types` set, this booking's type must be in the list (prevents Day booking landing in 24hr-only room at the wrong rate column). Both backend and frontend apply the filter; frontend drops them from the dropdown entirely.
- **Password strength:** All password-setting surfaces render `<PasswordRequirements value={pw} />` from `src/components/ui/PasswordRequirements.jsx`. Exports a `checkPasswordStrength(value)` predicate used to gate submit buttons. Rules mirror Laravel's `Password::defaults()` exactly: ≥8 chars, upper, lower, number, special. The component renders a 5-segment strength bar + Weak/Medium/Strong label + a per-rule checklist. Used in: Signup, SignupModal, ResetPassword, EditProfile (password change tab), Owner Users (staff create/reset).
- **Legal pages:** `/privacy` + `/terms` live at `src/pages/Privacy.jsx` and `src/pages/Terms.jsx`. Linked from Signup, SignupModal, and the public Footer's bottom bar. DPO: Michael Jason Mayol, michaeljmayol@gmail.com. Resort has 2 employees — below NPC Circular 17-01 registration thresholds (250 employees / 1000 sensitive-PI records / government agency), so registration is not mandatory. DPO designation is still required per DPA § 21 regardless of size and is published in the Privacy Policy.

## User preferences (observed)

- Terse responses. No trailing summaries of what you did — the diff is readable.
- Ship-oriented: when a plan is agreed, execute; don't re-propose.
- Decisive one-word replies ("go", "ship", "yes") = full approval to execute the most recently-scoped plan.
- Will push back hard and bluntly on sloppy work — good. Take the correction directly, don't soften.

## Known hazards (learned the hard way)

- **Don't trust `.md` docs for schema.** Migrations directory is the only source. This file used to claim `housekeeping_status` and `is_active` existed on `rooms` — neither did, and a migration trusting the doc crashed production.
- **Tailwind v4 has no `tailwind.config.js`.** Design tokens live in `src/index.css` under `@theme { ... }`. Adding custom colors means editing that block.
- **`/api/admin/*` is accessible by BOTH front_desk AND owner** (not just "admin"). The URL prefix is misleading.
- **Emoji can't render inside native `<option>` or `<optgroup>`** — Font Awesome won't work there either. Walk-In room picker keeps emoji deliberately; everywhere else uses FA.
- **`bookingRooms` strip trap.** `Rooms.jsx`, `Resort.jsx`, and `GuestDashboard.jsx` each re-map the raw rooms array into a whitelisted `bookingRooms` prop before passing to `BookingModal`. Adding a new field to the rooms API response (e.g. `attached_addons`) does **not** automatically flow through — each mapping silently drops unlisted keys. Any field BookingModal needs must be added to all three whitelists. `MyBookings.jsx` + `ResumeGuestBooking.jsx` pass `rooms={[]}` (resume-only flow) so they're exempt.
- **Shell overflow pattern — OwnerShell vs frontdesk Sidebar.** Both shells render a sticky header + a `<main>` holding the page. For a page to use `h-full flex flex-col` + inner `flex-1 min-h-0` (like Messages.jsx does), `<main>` itself must be the scroll container. The frontdesk Sidebar gets this right: `<main className="flex-1 overflow-auto">`. OwnerShell had `overflow-auto` on the outer wrapper and a plain `<main className="flex-1">` — main grew to content instead of constraining it, which broke `h-full`-based pages (they rendered "too tall" and the whole right column scrolled). Fixed by moving overflow-auto onto `<main>` and setting the wrapper to overflow-hidden. If a new shell is ever added, mirror this pattern.
- **Axios 1.x drops XSRF on cross-origin requests.** Default axios only mirrors the `XSRF-TOKEN` cookie into an `X-XSRF-TOKEN` header for **same-origin** requests, even when `withCredentials: true`. `www → api` is cross-origin (same-site, different subdomain), so without the explicit `withXSRFToken: true` flag on the axios instance, Laravel's CSRF middleware 419s every mutating request once `SANCTUM_STATEFUL_DOMAINS` is active. Symptom: "CSRF token mismatch" on login even with fresh InPrivate cookies. Fix lives on the axios instance in `src/lib/api.js`. Don't remove this flag.
- **Sanctum stateful is Origin-gated, so session code must be guarded.** `EnsureFrontendRequestsAreStateful` only prepends the web-guard middleware group (EncryptCookies, StartSession, ShareErrorsFromSession, ValidateCsrfToken) when the request's Origin matches `SANCTUM_STATEFUL_DOMAINS`. Token-only callers bypass it, meaning `$request->session()` and `$request->session()->regenerate()` throw `Session store not set on request` for those callers. Every session touch in controllers (`register`, `login`, `googleLogin`, `logout`, admin `login`/`logout`) must be wrapped in `if ($request->hasSession()) { ... }`. P1.2 shipped a crash when this was overlooked; fixed in `2839f6a`.
- **Vercel deploy is wired to the mirror, not the source repo.** See "Repos & deployment" at top — `rawarcode/AplayAccess` is push target, `michaelmj23/AplayAccess` is the deploy trigger. Running `/mirror` is part of shipping, not housekeeping.

## Per-room add-on pricing — the 4 write paths that must stay aligned

Optional add-ons attached to a specific room have a per-room `price` on the `room_addons` pivot that overrides `addons.price`. Every place a `BookingAmenity` row is created must look up the per-room price to avoid charging catalog when it should be charging the override. The four paths:

| Path | File | Lookup |
|---|---|---|
| Guest online booking (authed + guest) | `Api\BookingController::attachOptionalAmenities` | `$room->optionalAddons->keyBy('id')` |
| Walk-in form submit | `Admin\WalkInController::store` (inline loop) | `$room->optionalAddons->keyBy('id')` |
| Post-booking staff add | `Admin\AmenityController::store` | `$booking->room->optionalAddons` |
| Auto-attach of packages | `Api\BookingController::attachPackageAddons` / walk-in inline | `$room->packageAddons->pivot->price` directly |

On the frontend, each picker filters the catalog by the booking's room and overrides `price` in a `visibleCatalog`/`visibleAddons` memo so the ₱ shown = ₱ charged. Surfaces:
- `src/components/modals/BookingModal.jsx` — guest new-booking (optionalAddons memo)
- `src/frontdesk/components/WalkIn.jsx` — walk-in form (visibleAddons memo)
- `src/frontdesk/components/BookingDetailModal.jsx` — post-booking staff picker (visibleCatalog memo)

## Cookie auth topology (post-P1.2)

Session-cookie auth is the primary path; Bearer is a decaying back-compat path.

**Required Railway env (backend):**
- `SANCTUM_STATEFUL_DOMAINS=www.aplayabeachresort.com,aplayabeachresort.com`
- `SESSION_DOMAIN=.aplayabeachresort.com` (leading dot = parent domain, readable by both `www.` and `api.` subdomains)
- `SESSION_SECURE_COOKIE=true`

Missing any of these → `EnsureFrontendRequestsAreStateful` sees no match, web middleware never prepends, session+CSRF silently off, cookies never set → refresh logs user out.

**Frontend axios (`src/lib/api.js`):**
- `withCredentials: true` — sends cookies cross-origin
- `withXSRFToken: true` — opts into cross-origin XSRF header mirroring (see hazards above)
- Still injects `Authorization: Bearer` if `aplaya_token` exists in localStorage — back-compat for users who logged in pre-P1.2

**CORS (`config/cors.php`):** must include `X-XSRF-TOKEN` in `allowed_headers` or preflight rejects the CSRF header.

**Login flow:** `primeCsrf()` hits `/sanctum/csrf-cookie` first to get an `XSRF-TOKEN` cookie; axios auto-mirrors it as `X-XSRF-TOKEN` on the login POST; Laravel's CSRF middleware validates; login endpoint returns a session cookie (`aplayaccess-session`, HttpOnly, SameSite=Lax, Domain=.aplayabeachresort.com). From that point on, every request carries the session cookie; the bearer token in the response is ignored by new clients.

**localStorage state:**
- `aplaya_user_v1` (STORAGE_KEY) — cached user object for instant render on reload. NOT a source of truth — `/api/me` always runs on boot and overwrites. Safe to delete; causes a brief "logged out" flash while `/api/me` resolves.
- `aplaya_token` (TOKEN_KEY) — legacy bearer token. New logins don't write it. Pre-P1.2 sessions still have it and still work via the Authorization header fallback. Logout clears it.

**Diagnostic rule for "CSRF token mismatch":** always inspect the **Request** Headers of the failing POST (not Response). Checklist:
1. Is `X-Xsrf-Token:` present? If not → axios isn't mirroring (check `withXSRFToken: true` is deployed, not just committed).
2. Does its value match the `XSRF-TOKEN` cookie in Application → Cookies? If different → stale JS cached from a pre-fix deploy.
3. Is `Cookie:` sending `aplayaccess-session=...`? If not → SameSite / Domain scoping issue on the session cookie.
4. If all three pass and still 419 → clear all cookies for `.aplayabeachresort.com` (not just one subdomain) and retry fresh.

## Docs maintenance rule

When a commit changes any of: migrations, `routes/api.php`, model `$fillable`, middleware roles, test accounts, portal URLs, scheduler behavior, or auth flow — update the affected section in this file **in the same commit**. If it doesn't update, it's rotting. The most recent housekeeping_status / is_active drift happened because six sessions of schema changes landed without a single doc sync.
