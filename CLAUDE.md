# AplayAccess — Frontend (Claude Code Context)

## Project
Aplaya Beach Resort booking system — Capstone project.
**Stack:** React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 + Axios

- **Frontend repo:** `rawarcode/AplayAccess` (this repo)
- **Backend repo:** `michaelmj23/AplayAccess-Backend` at `E:\Capstone\AplayAccess-Backend`
- **Dev server:** `npm run dev` → http://localhost:5173
- **Backend URL:** http://localhost:8000 (XAMPP + `php artisan serve`)
- **Re-seed:** `php artisan migrate:fresh --seed` in the backend folder

## Test Accounts
| Email | Password | Role |
|---|---|---|
| test@example.com | password | guest |
| frontdesk@aplaya.com | password | front_desk |
| admin@aplaya.com | password | admin |
| owner@aplaya.com | password | owner |

## Architecture
- `src/main.jsx` → BrowserRouter > AuthProvider > App
- `src/lib/api.js` — Axios; adds `Authorization: Bearer <token>` from localStorage `aplaya_token`
- `src/lib/authApi.js` — login / register / me / logout (Sanctum Bearer token, NO CSRF)
- `src/lib/adminApi.js` — admin stats, analytics, rooms CRUD, addons, promo codes
- `src/lib/frontdeskApi.js` — frontdesk bookings, rooms, walk-in, transfer, housekeeping
- `src/context/AuthContext.jsx` — auth state; localStorage: `aplaya_user_v1` + `aplaya_token`
- `src/context/ContentContext.jsx` — site content from API; cached in `aplaya_content_cache_v1`

## Portals
| Portal    | Pages                    | Shell                                    |
|-----------|--------------------------|------------------------------------------|
| Guest     | `src/pages/dashboard/`   | `src/components/DashboardShell.jsx`     |
| Admin     | `src/pages/admin/`       | `src/components/admin/AdminShell.jsx`   |
| Owner     | `src/pages/owner/`       | `src/components/owner/OwnerShell.jsx`   |
| Frontdesk | `src/frontdesk/`         | `src/frontdesk/components/Layout/`      |

## Key Files
- `src/components/modals/BookingModal.jsx` — guest/public online booking (3 types, PayMongo)
- `src/frontdesk/components/WalkIn.jsx` — frontdesk walk-in booking form
- `src/pages/admin/Rooms.jsx` — admin room CRUD

## Pricing Model (current)
- **3 booking types:** `day` (6AM–6PM), `night` (6PM–7AM next day), `24hr` (6AM–6AM next day)
- **Room rate only** — no entrance fees, no guest count in booking price
- **Entrance fees** collected at gate by frontdesk: ₱50 day / ₱80 night / ₱100 24hr (adults); children 3 & below free
- **Online bookings:** 20% reservation fee paid upfront via PayMongo; balance at resort
- **Walk-ins:** full amount at counter; `reservation_fee = 0`

## Room Types (rooms table key fields)
| Field               | Notes                                              |
|---------------------|----------------------------------------------------|
| `day_rate`          | 6AM–6PM rate                                       |
| `overnight_rate`    | 6PM–7AM rate (often same as day_rate)              |
| `rate_24hr`         | 6AM–6AM next-day rate                              |
| `capacity_label`    | Display string e.g. "4–5 pax"                      |
| `quantity`          | Units available (e.g. 12 for Small Cottage)        |
| `features`          | JSON array `[{text, icon}]`                        |
| `availability_status` | available / renovation / maintenance / reserved / closed |
| `housekeeping_status` | clean / dirty / cleaning                         |

## Rooms (seeded)
### Rooms
| Name | Day | Night | 24hr | Capacity |
|---|---|---|---|---|
| Rohan | ₱1,500 | ₱1,500 | ₱2,000 | 2–3 pax |
| Ellie | ₱1,500 | ₱1,500 | ₱2,000 | 4–5 pax |
| Quian | ₱1,500 | ₱1,500 | ₱2,000 | 4–5 pax |
| 2nd Floor Standard | ₱1,800 | ₱1,800 | ₱2,500 | 2–3 pax |
| Cassey | ₱1,800 | ₱1,800 | ₱2,500 | 6–7 pax |
| Katrina | ₱1,800 | ₱1,800 | ₱2,500 | 5–6 pax |
| Patrice | ₱3,000 | ₱3,000 | ₱4,500 | 7–8 pax · videoke add-on ₱1,000 |

### Cottages & Pavilions (with quantity)
| Name | Day | Night | 24hr | Qty | Notes |
|---|---|---|---|---|---|
| Small Cottage | ₱400 | ₱400 | ₱700 | 12 | — |
| Medium Cottage | ₱600 | ₱600 | ₱1,000 | 4 | — |
| Large Cottage | ₱800 | ₱800 | ₱1,400 | 3 | — |
| Red Pavilion | ₱700 | ₱700 | ₱1,200 | 2 | Videoke add-on ₱1,500 |
| Blue Pavilion | ₱2,000 | ₱2,000 | ₱2,000 | 1 | Videoke included |

## API Endpoints (summary)
- `POST /api/login` | `GET /api/me` | `POST /api/logout`
- `GET /api/resorts/1/rooms` — available rooms (full model: rate_24hr, capacity_label, quantity)
- `GET /api/resorts/1/room-types` — lightweight list (id, name, day_rate, overnight_rate, rate_24hr, capacity_label, quantity)
- `GET /api/availability?date=YYYY-MM-DD&booking_type=day|night|24hr`
- `GET|POST /api/bookings` | `PATCH /api/bookings/{id}/cancel`
- `POST /api/guest-booking` — booking without account
- `POST /api/admin/walkin-booking` — frontdesk walk-in (auto sets status=Checked In)
- `PATCH /api/admin/bookings/{id}/transfer-room`
- `GET|POST /api/admin/rooms` | `PATCH /api/admin/rooms/{id}` | `DELETE /api/admin/rooms/{id}`
- `GET|POST|PATCH|DELETE /api/admin/promo-codes` | `POST /api/validate-promo`
- `GET /api/admin/stats` | `GET /api/admin/analytics/*` (owner only)
- `GET /api/bookings/{id}/receipt` | `GET /api/admin/bookings/{id}/receipt`

## Pending Tasks (as of 2026-04-15)
1. **Re-seed database** — `php artisan migrate:fresh --seed` (applies quantity column + new rooms)
2. **KPI dashboards** — Admin Dashboard + Frontdesk Dashboard improvements

## Completed (2026-04-15)
- BookingModal: reservation fee ₱0 bug fixed; 3PM day cutoff; hide prices until room selected
- WalkIn: 3PM day cutoff added
- Admin Rooms: rate_24hr, capacity_label, quantity in form/table/modal; Add Cottage/Pavilion buttons; Videoke icon
- AvailabilityController: booking_type param; quantity-aware; returns remaining count
- ResortController::roomTypes(): now returns rate_24hr, capacity_label, quantity
- Migration + Room model: quantity field added
- RoomSeeder: cottage quantities seeded
- RoomController: validates rate_24hr, capacity_label, quantity
- BookingController + WalkInController: quantity-aware conflict checks

## Middleware Roles
- `staff` — front_desk + admin
- `admin_role` — admin only
- `owner_role` — owner only
