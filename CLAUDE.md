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
| admin@aplayaccess.test | password | admin |
| owner@aplayaccess.test | password | owner |

## Portals

| Portal | Pages | Shell | URL prefix |
|---|---|---|---|
| Guest | `src/pages/dashboard/` | `src/components/dashboard/DashboardShell.jsx` | `/dashboard` |
| Front desk | `src/frontdesk/components/` | `src/frontdesk/components/Layout/Sidebar.jsx` (composed per page, not a single shell) | `/frontdesk` |
| Admin | `src/pages/admin/` (minimal) + reused owner pages | `src/components/admin/AdminShell.jsx` | `/admin` |
| Owner | `src/pages/owner/` | `src/components/owner/OwnerShell.jsx` | `/owner` |

Admin was reintroduced as a distinct role in 2026-04-24 (commits `3030b6b` → `73f7757` → `1365f60`). It sits between front desk and owner: admin runs day-to-day operations (content, reviews, messages, promo codes, newsletter, addons catalog, auto-replies) but cannot change rates, manage staff beyond front_desk, view revenue, or delete user accounts. 2026-04-25 expanded that scope with a "limited oversight" tier: admin can read the activity log, change a room's availability_status (no rate / capacity / name edits), and toggle `is_active` on an add-on (no create / rename / reprice / delete). Later that same day (commits in this branch) admin's user-management surface widened from "toggle active only" to **full CRUD on front_desk staff** — admin can create, edit, toggle, and reset the password of front_desk accounts, but the role picker is locked (admin can never mint another admin or promote a front_desk user). Strategic CRUD that stays owner-only: rooms create/delete/rename/reprice, addons CRUD, admin-account create/edit, all user delete, owner-account changes. Full permission matrix lives in `docs/roles.xlsx`. Owner keeps every admin capability, so an owner logged in can also navigate `/admin/*` directly.

## Auth + storage

- Token in `localStorage['aplaya_token']`, mirrored user object in `aplaya_user_v1`.
- `src/lib/api.js` axios instance injects `Authorization: Bearer`.
- `src/context/AuthContext.jsx` owns session state + `login()`, `logout()`, `refreshUser()`.
- Google Sign-In via `@react-oauth/google` `useGoogleLogin({flow:'implicit'})` → backend verifies access_token via `/api/auth/google`.

## Middleware roles (backend)

- `staff` — front_desk + admin + owner. Operational routes everyone at the counter touches.
- `admin_or_owner` — admin + owner. Day-to-day management (content, reviews, addons catalog, auto-replies, promo codes, newsletter, guests list, announcements). Also covers GET /admin/users + GET /admin/rooms + GET /admin/addons + GET /admin/history (read-only listings), three narrow toggle endpoints (`PATCH /admin/users/{id}/toggle-active` — front_desk only, `PATCH /admin/rooms/{id}/availability`, `PATCH /admin/addons/{id}/toggle-active`), and **`POST /admin/users` + `PATCH /admin/users/{id}` for front_desk CRUD** (UserController guards reject admin callers attempting to touch admin/owner targets or set role≠front_desk). Owner can call all of these too.
- `admin_role` — owner only (legacy alias name). Strategic inventory (rooms CRUD beyond status), pricing settings, audit log, stats. Addons CRUD (POST/PATCH/DELETE) was demoted from admin_or_owner to admin_role on 2026-04-25.
- `owner_role` — owner only. `DELETE /admin/users/{id}`, analytics, financial reports.

Aliases live in `bootstrap/app.php`. The `admin_role` alias name is kept for historical reasons — when the admin role was consolidated into owner in 2026-04-21 and again split back out in 2026-04-24, the alias stayed pointed at `AdminMiddleware` (owner-only) rather than getting renamed. Don't confuse the alias name with the role name — `admin_role` middleware is OWNER-ONLY and always has been.

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
- **Walk-in initial status is slot-relative.** `Admin\WalkInController::store` sets `status = 'Checked In'` only when the normalized `check_in` is `<= now()`. A walk-in booked at the counter for a future slot (tomorrow's Day, tonight's Night booked at 9 AM, or any 24hr start hour later than now) is created as `Confirmed` with `checked_in_at = null`. The activity log + guest notification copy mirror this — "Walk-in Booking Confirmed" vs "Walk-in Booking Checked In". For 24hr / 24hr-pm Confirmed walk-ins, the existing `bookings:auto-checkin-24hr` scheduler flips them to Checked In when the start hour arrives. Day / Night Confirmed walk-ins stay Confirmed until staff manually checks them in at the counter on arrival, mirroring the online Day / Night flow (the online flow is also manual-checkin-on-arrival, by design — staff use the manual click as the "guest physically here" signal).
- **Manual check-in is same-day-or-later only.** `Admin\BookingController::checkIn` rejects with 422 when `booking.check_in.toDateString() > today` ("This booking is scheduled for X. You can only check in on or after the scheduled day."). Staff can still check in BEFORE the slot's hour on the same day (e.g., a Night booking at 6 PM can be checked in at 4 PM for early-arrival accommodation), and they can still check in late (slot already started). Only cross-day early check-in is blocked. The reason: the live rooms board ([frontdesk/Rooms.jsx](src/frontdesk/components/Rooms.jsx)) treats every Checked-In booking as Occupied "regardless of clock" by explicit design, so checking in tomorrow's booking today would mark the room Occupied today and turn away walk-ins for that slot. Same-day early check-in keeps the rooms board honest because the slot is at least within today's window.
- **Email change (sensitive action):** Password-gated + verify-before-swap. `PATCH /api/profile` with a new email requires `current_password`, then stores the new address in `pending_email` with its own OTP. Real swap happens only when `POST /api/verify-email-change` consumes the code. Google-linked users (`users.google_id` set) can't change email/password from the app — the Edit Profile UI hides those controls.
- **Messaging:** One-thread-per-guest — `POST /api/messages` from a guest who already has a thread appends to it rather than creating a new root. Staff can initiate threads via `POST /api/admin/messages/compose`. Abusive guests can be flagged via `POST /api/admin/users/{user}/toggle-messaging-block`. Rate limits: 5 new / 10 replies per minute.
- **Contact submissions are single-reply, gmail-bridge.** `POST /api/contact` (public, throttle:3,1) creates a `contact_submissions` row. Owner/admin read at `/owner/content?tab=contact` or `/admin/content?tab=contact`. Modal-open fires `PATCH /api/admin/contacts/{id}/read` so the bell badge decays; reply goes through `POST /api/admin/contacts/{id}/reply` which sends a Brevo email with `Reply-To: env('CONTACT_REPLY_TO_EMAIL', 'aplayabeachresortph@gmail.com')`. Customer replies don't come back into the system — they land in the resort gmail and staff handle the thread there. Single-reply per submission for v1: once `replied_at` is set the textarea locks. Brevo send is **synchronous** (not `afterResponse` like OTP/booking emails) so a delivery failure surfaces to the staff member as an error toast — they need to know the customer didn't get the message. Unread count plumbed through `useStaffNotifications` as `unreadContacts` alongside messages/reviews.
- **Receipts are Booking Confirmations, not Official Receipts.** The PDF + email are labeled "Booking Confirmation" and carry a BIR disclaimer. Actual ORs are issued manually at the counter from a BIR-registered booklet.
- **Timezone:** `config/app.php` reads `APP_TIMEZONE` from env, defaults to `Asia/Manila`. Railway must have this set or the scheduler's `now()` drifts 8 hours behind the DB's Manila-time booking rows and the auto-checkin query silently excludes everything.
- **Room transfer pricing:** `Admin\BookingController::transferRoom` re-prices on **every** transfer, not just upgrades. Formula: `newTotal = max(newRate - discount + amenityTotal, paid_amount)`. The `max(..., paid_amount)` clamp is the no-refund-on-downgrade policy: if the guest already paid more than the new room costs, total stays at `paid_amount` (balance 0, resort absorbs the delta) instead of going negative. Transfer-back-after-upgrade case correctly returns total to the original rate. `fully_paid` re-derives against the new total.
- **Room transfer guards:** Two rejections beyond the overlap/quantity check — target room category must not be `admission` (pseudo-room for gate-only walk-ins, day_rate=0), and if the target has `allowed_booking_types` set, this booking's type must be in the list (prevents Day booking landing in 24hr-only room at the wrong rate column). Both backend and frontend apply the filter; frontend drops them from the dropdown entirely.
- **Password strength:** All password-setting surfaces render `<PasswordRequirements value={pw} />` from `src/components/ui/PasswordRequirements.jsx`. Exports a `checkPasswordStrength(value)` predicate used to gate submit buttons. Rules mirror Laravel's `Password::defaults()` exactly: ≥8 chars, upper, lower, number, special. The component renders a 5-segment strength bar + Weak/Medium/Strong label + a per-rule checklist. Used in: Signup, SignupModal, ResetPassword, EditProfile (password change tab), Owner Users (staff create/reset).
- **Legal pages:** `/privacy` + `/terms` live at `src/pages/Privacy.jsx` and `src/pages/Terms.jsx`. Linked from Signup, SignupModal, and the public Footer's bottom bar. DPO: Michael Jason Mayol, michaeljmayol@gmail.com. Resort has 2 employees — below NPC Circular 17-01 registration thresholds (250 employees / 1000 sensitive-PI records / government agency), so registration is not mandatory. DPO designation is still required per DPA § 21 regardless of size and is published in the Privacy Policy.
- **Payment methods (current, post-2026-04-26):** GCash (via PayMongo) for online bookings, cash at the counter for walk-ins or balance settlement. PayMaya / Maya / cards were removed from marketing + legal copy because the BookingModal only ever offered GCash anyway. Legacy `payment_method='maya'` decoders in `frontdesk/Billing.jsx` and `frontdesk/BookingDetailModal.jsx` are intentionally kept so historical bookings render the right pill — only NEW Maya/card payments are off the table.
- **Public rooms endpoint is role-aware.** `GET /api/resorts/{id}/rooms` ([Api/ResortController.php:rooms](../../../../AplayAccess-Backend/app/Http/Controllers/Api/ResortController.php)) is unauthenticated but resolves the Sanctum user manually and toggles the response payload: non-staff (anonymous + guest + **admin**) get `whereNotIn('category', ['tent', 'admission'])`; only `front_desk` and `owner` see tents and the "Entrance Only" admission pseudo-room. The frontend `getFdRooms()` consumes this endpoint, so the FDRooms board produces **different vacant counts in admin vs frontdesk vs owner sessions on the same DB**. Three implications:
  1. Admin's `isStaff` exclusion is silent and intentional (admin shouldn't manage the gate-walk-in pseudo-row), but it means anything that adds future role-gated payload to this endpoint must explicitly opt admin in or out.
  2. The "Entrance Only" admission row has `quantity=999` (per the seed migration `2026_04_23_120000_seed_entrance_only_pseudo_room.php`). Any frontend summary that counts physical units across the rooms response MUST exclude category `admission` and `tent`, or the Vacant card reads "1036" instead of "37". `frontdesk/Rooms.jsx` does this via `isExcludedFromVacancy()` and a `getCat()` name-fallback that catches both `'tent'` / `'camp'` (in addition to the DB `category` column).
  3. The card-render loop already drops admission rows naturally because `CATEGORY_GROUPS` has no `admission` entry — only the SUMMARY count needs explicit handling.
- **Home page defaults live in TWO places that must stay in sync.** `src/pages/Home.jsx` `HOME_DEFAULTS` is the live-site fallback when no CMS override is saved. `src/pages/owner/Content.jsx` `DEFAULT_CONTENT` is the website-builder pre-fill. Updating one without the other creates a "live site shows X, builder pre-fills Y" mismatch. Both default sets were re-aligned in `17130d0`. Same caveat applies to the resort hero and CTA defaults. CMS keys are `page_home_hero`, `page_home_why`, `page_home_cta`, `page_home_resort` (note: SINGULAR `_resort`, not `_resorts` — the `_resorts` block in `DEFAULT_CONTENT` is legacy and not consumed by Home.jsx).

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
- **Sanctum stateful is Origin-gated, so session code must be guarded.** `EnsureFrontendRequestsAreStateful` only prepends the web-guard middleware group (EncryptCookies, StartSession, ShareErrorsFromSession, ValidateCsrfToken) when the request's Origin matches `SANCTUM_STATEFUL_DOMAINS`. Token-only callers bypass it, meaning `$request->session()` and `$request->session()->regenerate()` throw `Session store not set on request` for those callers. Every session touch in controllers (`register`, `login`, `googleLogin`, `logout`, admin `login`/`logout`, `deleteAccount`) must be wrapped in `if ($request->hasSession()) { ... }`. P1.2 shipped a crash when this was overlooked; fixed in `2839f6a`.
- **Token revocation ≠ session invalidation under cookie auth.** Auth is session-cookie-based (P1.2), so `$user->tokens()->delete()` does nothing for the active SPA — the session cookie still authenticates. Any "destructive identity change" path (account delete, future password-reset-while-logged-in, etc.) that wants to terminate the active session must also `Auth::guard('web')->logout()` + `$request->session()->invalidate()` + `$request->session()->regenerateToken()` (all guarded by `$request->hasSession()`). `ProfileController::deleteAccount` originally only revoked tokens — the user could refresh after delete and `/api/me` returned the anonymized "Deleted User" record, putting them back on the dashboard. Frontend `AuthContext` boot now also rejects `is_active=false` from `/api/me` as belt-and-braces, and `EditProfile.onDeleteAccount` calls `clearPersistedAuth()` immediately after the delete succeeds so localStorage can't repopulate the celebration window with a ghost identity on refresh.
- **Vercel deploy is wired to the mirror, not the source repo.** See "Repos & deployment" at top — `rawarcode/AplayAccess` is push target, `michaelmj23/AplayAccess` is the deploy trigger. Running `/mirror` is part of shipping, not housekeeping.
- **Signup paths need `primeCsrf()` too.** Every login variant (email / staff / Google) calls `await primeCsrf()` before the mutating POST, but the two register paths (`Signup.jsx` + `SignupModal.jsx`) historically relied on app-boot's single priming call. That's brittle — if the session rotated between boot and the signup click (e.g. previous logout invalidated the session), the XSRF-TOKEN cookie points at a dead session and the POST 419s. Both signup handlers now prime explicitly. Any new mutating endpoint reached without going through AuthContext's login helpers must prime too.
- **MessageController `store()` and `reply()` must stay in parity for cross-cutting message logic.** `store()` is the new-thread path (also handles one-thread-per-guest append); `reply()` is the existing-thread follow-up. The auto-reply engine originally lived only in `store()`, so a guest's very first message triggered bot responses but every follow-up went silent. Any feature that belongs on "every inbound guest message" (auto-reply, keyword routing, notification fan-out, activity log, etc.) has to be added to both endpoints. Consider extracting to a shared private helper if this pattern grows.
- **`/api/rooms` is owner/staff-gated** despite the casual-sounding URL. The public room listing is `/api/resorts/{id}/rooms`. Tests that need a "public 200 GET" should hit `/api/resorts`, not `/api/rooms`.
- **`git add -A` sweeps untracked files you may not have meant to commit.** The worktree has files that aren't tracked (`AGENTS.md` parallel to `CLAUDE.md`, various Claude machinery). Prefer staging specific paths with `git add <file1> <file2>` when the commit is supposed to be scoped. Check `git status` before committing scoped changes.
- **Print uses a hidden iframe, not `window.open`.** The popup pattern (`window.open('', '_blank')` + `w.document.write(html)` + `w.print()`) works on desktop but breaks on mobile: iOS Safari and Android Chrome aggressively block popups, and even when they open the print dialog often never fires (the popup renders as a dead tab). All three print callers (`frontdesk/Reports.jsx`, `owner/Reports.jsx`, `owner/Transactions.jsx`) now go through `printHtml(html, {title})` from `src/lib/print.js`, which injects an off-screen iframe, writes the HTML into it, and calls `iframe.contentWindow.print()` on load. Same approach `react-to-print` and `print-js` use; works on every browser tested. **CSP angle still matters:** the iframe inherits the parent's CSP, so don't embed `<script>window.print()</script>` in the printable HTML — `printHtml` fires print() from the parent module instead. If you add a fourth print surface, use the helper, don't reach for `window.open`.
- **`RequireAuth.ROLE_REDIRECTS` must list every staff role.** The `/dashboard` guest guard falls through to `return children` for any role not in its redirect map, so a new staff role that isn't listed will silently see the guest dashboard. Today's map covers `front_desk`, `admin`, `owner`. If another staff role appears, add it here too.
- **Front-desk pages embed their own `<Sidebar>`; owner pages are shell-less.** `OwnerShell` wraps child routes with `<Outlet />` so owner pages render just body content. The FD portal has no shared shell — each page imports `Sidebar` and wraps itself. That's why reusing FD pages inside `AdminShell` required the `embedded` prop: with `embedded={true}`, the page swaps its top-level `<Sidebar>` for a `<Fragment>` so the outer shell provides the chrome. If a new FD page is added and later needs to live under `/admin/*` too, add `embedded` the same way as `Bookings`, `WalkIn`, `Billing`, `GuestRecords`, `Rooms`.
- **In-page hardcoded portal URLs break cross-mount reuse.** FD pages contained `navigate('/frontdesk/walkin')` and `navigate('/frontdesk/bookings')` — fine for `/frontdesk/*` consumers, but admin mounting the same component under `/admin/*` would get navigated out of their portal. Pattern for any cross-mounted component: `const walkinPath = location.pathname.startsWith('/admin') ? '/admin/walk-in' : '/frontdesk/walkin';` then `navigate(walkinPath)`. Only the navigation is context-aware; data paths are the same because backend auth admits both roles.
- **`/admin/users` and `/admin/activity-log` reuse owner pages with role-aware rendering.** Both paths in `App.jsx` mount `OwnerUsers` / `OwnerActivityLog` under the admin shell — there is no separate admin component. `OwnerUsers` reads `useAuth().user.role === 'admin'` into an `isAdminView` flag and uses three predicates to gate per-row controls: `canEdit(u)` (admin only on `front_desk` rows), `canToggleActive(u)` (admin only on `front_desk` rows — matches backend `toggleStaffActive` 403 contract), `canDelete(u)` (always false for admin — DELETE stays owner-only). Owner-only UI still hidden behind `!isAdminView`: bulk-action bar, select-all + per-row checkboxes. Add User button + Ctrl+N shortcut now show for both roles; the create/edit modal's Role radio collapses to a single locked "Front Desk" tile when admin opens it (backend `UserController::store/update` enforce the same scoping — admin caller + non-front_desk role/target → 403). The role filter chips collapse to a single "Front Desk" pill for admin and `filterRole` initializes to `'front_desk'` (and the "Clear filters" button respects that for admin too). `handleToggleActive` routes through `toggleStaffActive` (PATCH narrow) for admin and `updateAdminUser` (full update) for owner. If a new owner-only feature lands on this page, gate it the same way (`!isAdminView` for hard owner-only, `canEdit/canToggle/canDelete` for per-row); if a new endpoint is added for admin's tier, mirror the routing in `handleToggleActive`. Activity Log doesn't need gating — it's read-only by design.
- **Message sender attribution uses `sender_user_id`, not `user_id`.** `messages.user_id` is the thread OWNER (guest) for all rows in the thread, regardless of who sent the specific row. Previously some paths overloaded `user_id` to mean "the staff who replied," which created bugs (compose-initiated threads showing the guest's name as the sender). Now staff-sent rows set `sender_user_id = auth()->id()` and response serializers resolve name via `->sender?->name` with an "Aplaya Resort" fallback for auto-reply-rule rows (null sender). Any new staff-message-creating path must set `sender_user_id` explicitly.

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

## Auth topology (current, post-P1 hardening cycle)

Session-cookie auth is the **sole** SPA auth path. No bearer tokens are minted by register/login/googleLogin/admin-login anymore — response shape is `{user}`, not `{user, token}`. Google is on OAuth2 auth-code + PKCE, no longer implicit.

**Required Railway env (backend):**
- `SANCTUM_STATEFUL_DOMAINS=www.aplayabeachresort.com,aplayabeachresort.com`
- `SESSION_DOMAIN=.aplayabeachresort.com` (leading dot = parent domain, readable by both `www.` and `api.` subdomains)
- `SESSION_SECURE_COOKIE=true`
- `GOOGLE_CLIENT_ID=...apps.googleusercontent.com` (public, identifies the OAuth client)
- `GOOGLE_CLIENT_SECRET=GOCSPX-...` (backend-only, proves to Google's token endpoint that the code exchange is coming from our server). **The frontend MUST NOT have this.** It's only in the backend Railway env.

Missing any of the first three → `EnsureFrontendRequestsAreStateful` sees no Origin match, web middleware never prepends, session+CSRF silently off, cookies never set → refresh logs user out. Missing `GOOGLE_CLIENT_SECRET` → Google login fails with "Google token exchange returned no access token."

**Frontend axios (`src/lib/api.js`):**
- `withCredentials: true` — sends cookies cross-origin
- `withXSRFToken: true` — opts into cross-origin XSRF header mirroring (see hazards above)
- No bearer injection, no Authorization interceptor. `TOKEN_KEY` export is kept only so AuthContext can sweep any legacy `aplaya_token` left on pre-P1.2 clients (removeItem on boot 401 + on logout); once that population decays to zero, the export + sweeps can go too.

**CORS (`config/cors.php`):** must include `X-XSRF-TOKEN` in `allowed_headers` or preflight rejects the CSRF header.

**Email login flow:** `primeCsrf()` hits `/sanctum/csrf-cookie` first → axios auto-mirrors the cookie as `X-XSRF-TOKEN` on the login POST → Laravel's CSRF middleware validates → login endpoint regenerates the session + returns `{user}`. Session cookie (`aplayaccess-session`, HttpOnly, SameSite=Lax, Domain=.aplayabeachresort.com) now carries auth. Same priming happens on register, Google, staff login.

**Google login flow (auth-code + PKCE, popup mode):**
1. Frontend: `useGoogleLogin({flow: 'auth-code'})` from `@react-oauth/google` opens the Google popup. PKCE code_verifier is generated internally by Google's JS SDK — we never touch it.
2. Popup returns `{code}` to the opener via postMessage. The `access_token` never enters the browser.
3. Frontend posts `{code}` to `POST /api/auth/google`.
4. Backend exchanges the code at `https://oauth2.googleapis.com/token` with `grant_type=authorization_code`, `redirect_uri=postmessage` (the literal string Google documents for popup mode — no URI needs to be whitelisted in Google Console for this), `client_id`, and `client_secret`.
5. Exchange returns `{access_token, id_token, ...}`. Backend reuses the existing `userinfo` call to resolve the identity and proceed with find-or-create + session regenerate.

**localStorage state:**
- `aplaya_user_v1` (STORAGE_KEY) — cached user object for instant render on reload. NOT a source of truth — `/api/me` always runs on boot and overwrites. Safe to delete; causes a brief "logged out" flash while `/api/me` resolves.
- `aplaya_token` (TOKEN_KEY) — legacy. Not written by any current code path. Removed on logout / boot 401. Decays naturally.

**Diagnostic rule for "CSRF token mismatch":** always inspect the **Request** Headers of the failing POST (not Response). Checklist:
1. Is `X-Xsrf-Token:` present? If not → axios isn't mirroring (check `withXSRFToken: true` is deployed, not just committed).
2. Does its value match the `XSRF-TOKEN` cookie in Application → Cookies? If different → stale JS cached from a pre-fix deploy.
3. Is `Cookie:` sending `aplayaccess-session=...`? If not → SameSite / Domain scoping issue on the session cookie.
4. If all three pass and still 419 → clear all cookies for `.aplayabeachresort.com` (not just one subdomain) and retry fresh.
5. If it's the register POST specifically → make sure the calling code primes CSRF first. See the signup primeCsrf hazard above.

## Rate limiting & enumeration defense patterns

Sensitive public/semi-public endpoints need two complementary defenses. Current conventions:

**Brute-force (OTP, auth, sensitive mutations):**
- **Route-level throttle** via Laravel's built-in `throttle:N,1` middleware caps the request rate regardless of user. Use it as the outer guard — the per-minute window makes a flood obvious and cheap to reject before controllers run.
- **Per-user `RateLimiter`** keyed on a stable identifier (`user->id` for authed paths, user agent + IP for anon) counts attempts against a single target. Decay window should match the target's own TTL (e.g. OTP lives 15 min → limiter decays in 15 min). Clear on success + on any path that issues a fresh target (e.g. resend OTP resets the counter).
- **Example**: `Api\AuthController::verifyEmail` — route throttle `throttle:10,1` + per-user limiter at 5 attempts / 900s, cleared in both `verifyEmail` (on success) and `resendVerification` (on fresh OTP).

**Enumeration defense (public probes that could reveal membership):**
- Return **identical** user-visible response whether the target is new or already known. The DB side-effect can differ (skip duplicate insert, etc.), but the response body must not leak state.
- **Example**: `Api\NewsletterController::store` and `Api\NewsletterController::unsubscribe` both return the same message regardless of whether the email was on the list. Pattern introduced for unsubscribe first; signup retrofitted in `3a181ad`.
- Watch for timing leaks too — if the "already subscribed" path skips an outbound HTTP call (Brevo) while the "new" path makes one, a sufficiently patient attacker can enumerate via response latency. Not currently a concern here but something to keep in mind for future endpoints.

**Endpoints still on the backlog:**
- `/api/forgot-password` — currently acknowledges existence / non-existence with the same message (good), but no route throttle. Should have `throttle:5,1` to prevent bulk email triggering.
- Guest-booking endpoints (`/api/guest-*`) still use the bearer-secret-in-URL model for `{guest_token}`. Structural fix would be short-lived tokens + one-time receipt links; sizable refactor, tracked as P2 residual from the OWASP audit.

## Docs maintenance rule

When a commit changes any of: migrations, `routes/api.php`, model `$fillable`, middleware roles, test accounts, portal URLs, scheduler behavior, or auth flow — update the affected section in this file **in the same commit**. If it doesn't update, it's rotting. The most recent housekeeping_status / is_active drift happened because six sessions of schema changes landed without a single doc sync.
