# Aplaya Beach Resort — Entity Relationship Diagrams

Two parallel sets of diagrams, same schema:

- **DBML** — physical / relational view. Crow's-foot cardinality, no verb labels. Renders at <https://dbdiagram.io>.
- **Mermaid** — verb-labeled view closer to a Chen-style **conceptual** ERD. Renders inline in any Markdown viewer (GitHub, VS Code, Notion, Obsidian).

Pick whichever your capstone panel prefers — or include both (DBML for the physical appendix, Mermaid in the conceptual chapter).

## Files

| File | Format | Scope | Tables |
|---|---|---|---|
| `01-booking-payment.dbml` | DBML | Rooms, bookings, add-ons, promos | 8 |
| `02-users-content.dbml` | DBML | Accounts, reviews, site content | 7 |
| `03-activity-messaging.dbml` | DBML | Messages, notifications, audit, chatbot | 4 |
| `01-booking-payment.mermaid.md` | Mermaid | Same as DBML 01, verb-labeled | 8 |
| `02-users-content.mermaid.md` | Mermaid | Same as DBML 02, verb-labeled | 7 |
| `03-activity-messaging.mermaid.md` | Mermaid | Same as DBML 03, verb-labeled | 4 |
| `04-full-schema.mermaid.md` | Mermaid | **All tables on one page, no orphans** | 18 |

Every table is accounted for. Every table participates in at least one relationship.

## How to render

### DBML → polished PNG/PDF

1. Open <https://dbdiagram.io/d>
2. Paste one `.dbml` file's contents into the left editor
3. Canvas redraws automatically — drag tables to arrange
4. Top-right menu → Export → PDF / PNG / SVG

### Mermaid → inline Markdown

1. Open any `.mermaid.md` file on GitHub / VS Code / Notion / Obsidian — the diagram renders automatically
2. For a standalone export: paste the code block into <https://mermaid.live> → Actions → download PNG / SVG

### Strict Chen notation (diamond-shaped relationship symbols)

Mermaid's `erDiagram` is a verb-labeled crow's-foot hybrid — it's as close to Chen as pure-text tooling gets, and most capstone panels accept it. If your panel requires textbook Chen (diamonds and ovals):

1. Use `04-full-schema.mermaid.md` as the relationship reference (entity → verb → entity mapping is in the glossary table)
2. Redraw in **draw.io** or **Lucidchart** using Chen-notation stencils:
   - Entities → rectangles
   - Attributes → ovals connected to entities
   - Relationships → diamonds with verb labels, connected to participating entities with cardinality marks (`1`, `N`, `M`)
3. This is a manual step — no text-based tool produces strict Chen automatically

## Detail level

**Hybrid** per original spec:

- ✅ Primary keys (`id`)
- ✅ Foreign keys with target
- ✅ Business columns (rates, totals, payment state)
- ✅ Named composite / unique indexes
- ✅ Enum values spelled out
- ❌ `created_at` / `updated_at` / `deleted_at` — scaffolding, omitted
- ❌ `remember_token` / `email_verified_at` — Laravel auth scaffolding, omitted
- ❌ Single-column performance-only indexes

## Schema additions made for the ERD

To give every table a relationship (no orphan entities), five new foreign keys were added via migrations dated **2026-04-21**. All are nullable with `ON DELETE SET NULL` — existing data is preserved:

| Column | Table | References | Purpose |
|---|---|---|---|
| `addon_id` | `booking_amenities` | `addons.id` | Link purchases back to the catalog (was name-only) |
| `user_id` | `contact_submissions` | `users.id` | Attribute form submissions from authed guests |
| `user_id` | `newsletter_subscriptions` | `users.id` | Attribute subscriptions from authed guests |
| `updated_by` | `settings` | `users.id` | Track last owner to edit each setting |
| `created_by` | `auto_reply_rules` | `users.id` | Attribute chatbot rule authorship |

Snapshot columns on `booking_amenities` (`name`, `unit_price`) are preserved alongside `addon_id` — a catalog rename or delete can't corrupt a historical receipt.

## Cross-reference notes (relationships that exist by convention, not by FK)

### `bookings.promo_code` is a string, not a foreign key

When a guest applies a promo, the code string is copied onto the booking. Deleting a promo leaves past bookings' `promo_code` field intact. Intentional: the promo was valid at booking time, its historical record should survive.

### `activity_logs.subject_type` + `subject_id` are polymorphic by convention

Columns exist and are populated with `class_basename()` strings (`"Booking"`, not `"App\Models\Booking"`). The `ActivityLog` model does **not** declare a `morphTo()` relationship — `subject_id` is queried manually where needed. No FK constraint.

### Deleted users are anonymized, not removed

When a guest self-deletes:

- `name` → `"Deleted User"`
- `email` → `deleted_<id>@removed.local`
- `google_id` → `NULL`
- `phone` / `avatar` → `NULL`
- `is_active` → `false`

The row stays for financial history. Staff UIs render the pseudo-email as `"(account deleted)"` via `fmtGuestEmail()` in the frontend.

### Free-form strings modeled as enums in the ERD

A few columns store their values as `varchar` though the backend treats them like enums. In both DBML and Mermaid they're modeled as enums for readability:

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

1. Update the matching `.dbml` AND `.mermaid.md` files
2. If a new table crosses a themed diagram boundary, add it to `04-full-schema.mermaid.md` too
3. Re-render and update exported images in the thesis appendix

The source of truth is `database/migrations/` in the backend repo — the ERD files are a documentation mirror.
