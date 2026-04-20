# Aplaya Beach Resort — Entity Relationship Diagrams

Three themed ERDs in [DBML](https://dbml.dbdiagram.io/home) format. Paste each `.dbml` file into <https://dbdiagram.io> to render, then export PNG / PDF / SVG for your capstone document.

## Files

| File | Scope | Tables |
|---|---|---|
| `01-booking-payment.dbml` | Rooms, bookings, add-ons, promos — the money path | 8 |
| `02-users-content.dbml` | Accounts, reviews, site content (gallery, announcements, settings) | 7 |
| `03-activity-messaging.dbml` | Messages, notifications, audit log, chatbot rules | 4 |

Cross-diagram references use small **stubs** (just `id` + a note pointing at the full definition). Example: `users` is fully defined in diagram 2 but appears as a stub in diagrams 1 and 3 so the FK lines still render.

## How to render

1. Open <https://dbdiagram.io/d> (free, no account needed)
2. Paste the contents of one `.dbml` file into the left editor panel
3. The canvas redraws. Drag tables to arrange.
4. **Export → PNG / PDF / SVG** from the top-right menu

Repeat for all three files. If you want a single combined page for your thesis, paste all three files concatenated — dbdiagram will render it as one big diagram (25 tables, noisy but complete).

## Detail level

**Hybrid** — per your spec:

- ✅ Primary keys (`id`)
- ✅ Foreign keys with target (arrow relationships render automatically)
- ✅ Business columns (room rates, booking totals, payment state)
- ✅ Named composite / unique indexes where they matter
- ✅ Enum types extracted for readability (e.g. `booking_status`, `room_category`)
- ❌ `created_at` / `updated_at` / `deleted_at` — scaffolding, omitted
- ❌ `remember_token` / `email_verified_at` — Laravel auth scaffolding, omitted
- ❌ Single-column performance indexes — included only where they constrain behavior

## Cross-reference notes

These are things the schema does NOT enforce but the code does:

### `bookings.promo_code` is a string, not a foreign key

When a guest applies a promo, the code string is *copied* onto the booking. No FK to `promo_codes.code` or `promo_codes.id`. Deleting a promo leaves historical bookings' `promo_code` field intact. Intentional: the promo was valid at booking time, and its historical record should survive the promo's deletion.

### `booking_amenities.name` links to `addons.name` only by convention

`booking_amenities` rows are purchase snapshots — they copy `name`, `unit_price`, and `qty` at the moment of purchase. No FK back to `addons`. Same rationale: an owner can rename or delete an add-on without corrupting past receipts.

### `activity_logs.subject_type` + `subject_id` are polymorphic by convention

The columns exist and are populated with `class_basename()` strings (e.g. `"Booking"`, not `"App\Models\Booking"`). The `ActivityLog` model does **not** declare a `morphTo()` relationship — `subject_id` is queried manually where needed. No FK constraint.

### `bookings.user_id` is nullable

Guest-token bookings (no account) have `user_id = NULL` with contact info carried in `guest_name` / `guest_email` / `guest_phone` / `guest_token`. The model-level `belongsTo` is still wired; it just resolves to `null` for guest rows.

### `messages.parent_id` is self-referential

Thread starter has `parent_id = NULL`; replies reference their starter. Cascade-on-delete means deleting the starter wipes the whole thread.

### Deleted users are anonymized, not removed

When a guest self-deletes:

- `name` → `"Deleted User"`
- `email` → `deleted_<id>@removed.local`
- `google_id` → `NULL`
- `phone` / `avatar` → `NULL`
- `is_active` → `false`

The row stays for financial history (forfeited revenue, past stays attribution). Frontend staff UIs render the pseudo-email as `"(account deleted)"` via `fmtGuestEmail()` in `src/lib/format.js`.

### Free-form strings that are functionally enums

A few columns store their values as `varchar` even though the backend treats them like enums. We modeled them as enums in the DBML for readability. If you need to match the exact schema, replace with `varchar`:

| Column | Stored as | Modeled as |
|---|---|---|
| `users.role` | varchar | `user_role` enum |
| `rooms.category` | varchar | `room_category` enum |
| `bookings.status` | varchar | `booking_status` enum |
| `bookings.booking_type` | varchar | `booking_type` enum |
| `reviews.status` | varchar | `review_status` enum |
| `gallery_images.category` | varchar | `gallery_category` enum |

## Keeping the ERDs current

When you add a new column or table:

1. Update the matching `.dbml` file
2. If a new table crosses diagram boundaries, add a stub to each affected diagram
3. Re-render on dbdiagram.io and update the exported images in your thesis appendix

The source of truth is always `database/migrations/` in the backend repo — the DBML is a documentation mirror.
