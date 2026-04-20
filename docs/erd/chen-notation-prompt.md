# AI Prompt — Chen-Notation ERD for Aplaya Beach Resort

Copy everything between the fences below and paste into Claude / ChatGPT / Gemini / any diagram-generating AI.

---

````
Build a complete Chen-notation Entity Relationship Diagram for the Aplaya Beach Resort booking system.

**STRICT CHEN NOTATION REQUIREMENTS** — use these symbols exactly:

- **Entities**: rectangles with the entity name in uppercase inside
- **Relationships**: diamonds with a verb (e.g. "PLACES", "CONTAINS") inside, connected to the two entities they link
- **Attributes**: ovals connected to their owning entity with a simple line
- **Primary keys**: attribute name UNDERLINED inside its oval
- **Foreign keys**: labeled with "(FK)" in the oval
- **Multi-valued attributes**: double-lined ovals
- **Derived attributes**: dashed-outline ovals
- **Cardinality**: written on the line between the entity and the relationship diamond, using (min, max) notation:
  - `(1,1)` = exactly one (mandatory)
  - `(0,1)` = zero or one (optional, max 1)
  - `(0,N)` = zero or more (optional, unlimited)
  - `(1,N)` = one or more (mandatory, unlimited)

Output format: produce a clean diagram as an SVG / PNG / draw.io file / Mermaid erDiagram equivalent (as best approximation) / ASCII art — whichever your capability allows. Prefer SVG for editability.

---

**18 ENTITIES with their key attributes** (list the attributes shown; you can add a few more from context where sensible):

1. **USERS**
   - id (PK), name, email (unique), password, role {guest | front_desk | owner}, google_id (unique, nullable), email_otp, email_otp_expires_at, phone, avatar, is_active

2. **RESORTS**
   - id (PK), name, description, address, phone, email, image, rating

3. **ROOMS**
   - id (PK), resort_id (FK), name, category {room | cottage | pavilion}, description, day_rate, overnight_rate, rate_24hr, allowed_booking_types (multi-valued), capacity, capacity_label, quantity, availability_status {available | renovation | maintenance | reserved | closed}

4. **BOOKINGS**
   - id (PK), user_id (FK, nullable), guest_name, guest_email, guest_phone, guest_token (unique), room_id (FK), check_in, check_out, checked_in_at, checked_out_at, booking_type {day | night | 24hr | 24hr-pm}, guests, children, room_rate, reservation_fee, paid_amount, discount, total, entrance_fee, entrance_rate_per_head, promo_code, payment_method, paymongo_link_id, paid_at, fully_paid, special_requests, status {Pending | Confirmed | Checked In | Completed | Cancelled}

5. **BOOKING_AMENITIES** (weak entity — existence depends on BOOKINGS)
   - id (PK), booking_id (FK), addon_id (FK, nullable), name, qty, unit_price, total

6. **AMENITIES**
   - id (PK), resort_id (FK), name, icon, description

7. **ADDONS**
   - id (PK), name (unique), icon, description, price, max_qty, per_booking, is_active

8. **PROMO_CODES**
   - id (PK), code (unique), type {percentage | fixed}, value, max_uses, uses_count, expires_at, is_active, created_by (FK)

9. **REVIEWS**
   - id (PK), booking_id (FK), user_id (FK), rating (1-5), comment, status {Pending | Approved | Rejected}, featured
   - composite unique on (user_id, booking_id)

10. **GALLERY_IMAGES**
    - id (PK), resort_id (FK), image_url, caption, category {pool | rooms | dining | beach | events | others}, sort_order, is_featured, is_hidden

11. **ANNOUNCEMENTS**
    - id (PK), title, body, media_url, is_active, is_pinned, published_at, created_by (FK, nullable)

12. **CONTACT_SUBMISSIONS**
    - id (PK), user_id (FK, nullable), name, email, subject, message

13. **NEWSLETTER_SUBSCRIPTIONS**
    - id (PK), user_id (FK, nullable), email (unique)

14. **SETTINGS**
    - id (PK), key (unique), value, label, type {integer | decimal | string}, group {pricing | general}, updated_by (FK, nullable)

15. **MESSAGES**
    - id (PK), user_id (FK), resort_id (FK), parent_id (FK, self-reference, nullable), subject, body, sender_type {guest | resort}, is_read

16. **USER_NOTIFICATIONS**
    - id (PK), user_id (FK), type, title, body, is_read

17. **ACTIVITY_LOGS**
    - id (PK), user_id (FK, nullable), user_name, user_role, category, action, description, subject_type (polymorphic), subject_id (polymorphic), ip_address

18. **AUTO_REPLY_RULES**
    - id (PK), keyword, response, match_type {contains | exact | starts_with}, is_active, priority, created_by (FK, nullable)

---

**20 RELATIONSHIPS** (each must be drawn as a diamond with the verb inside, connecting the two entities with cardinality labels on each line):

1. USERS ─(0,N)── **PLACES** ──(0,1)─ BOOKINGS
2. USERS ─(0,N)── **WRITES** ──(1,1)─ REVIEWS
3. USERS ─(0,N)── **SENDS** ──(1,1)─ MESSAGES
4. USERS ─(0,N)── **RECEIVES** ──(1,1)─ USER_NOTIFICATIONS
5. USERS ─(0,N)── **PERFORMS** ──(0,1)─ ACTIVITY_LOGS
6. USERS ─(0,N)── **PUBLISHES** ──(0,1)─ ANNOUNCEMENTS
7. USERS ─(0,N)── **SUBMITS** ──(0,1)─ CONTACT_SUBMISSIONS
8. USERS ─(0,N)── **SUBSCRIBES VIA** ──(0,1)─ NEWSLETTER_SUBSCRIPTIONS
9. USERS ─(0,N)── **LAST EDITS** ──(0,1)─ SETTINGS
10. USERS ─(0,N)── **AUTHORS** ──(1,1)─ PROMO_CODES
11. USERS ─(0,N)── **CONFIGURES** ──(0,1)─ AUTO_REPLY_RULES
12. RESORTS ─(0,N)── **CONTAINS** ──(1,1)─ ROOMS
13. RESORTS ─(0,N)── **OFFERS** ──(1,1)─ AMENITIES
14. RESORTS ─(0,N)── **DISPLAYS** ──(1,1)─ GALLERY_IMAGES
15. RESORTS ─(0,N)── **HOSTS** ──(1,1)─ MESSAGES
16. ROOMS ─(0,N)── **IS RESERVED IN** ──(1,1)─ BOOKINGS
17. BOOKINGS ─(0,N)── **INCLUDES** ──(1,1)─ BOOKING_AMENITIES
18. BOOKINGS ─(0,1)── **RECEIVES** ──(1,1)─ REVIEWS
19. ADDONS ─(0,N)── **IS PURCHASED AS** ──(0,1)─ BOOKING_AMENITIES
20. MESSAGES ─(0,N)── **REPLIES TO** ──(0,1)─ MESSAGES (self-referential — draw the diamond with both ends connected to MESSAGES)

---

**ADDITIONAL RULES**:

- Group entities by domain for visual clarity (optional but preferred):
  - *Central hub*: USERS, RESORTS
  - *Booking & Payment*: ROOMS, BOOKINGS, BOOKING_AMENITIES, AMENITIES, ADDONS, PROMO_CODES
  - *Users & Content*: REVIEWS, GALLERY_IMAGES, ANNOUNCEMENTS, CONTACT_SUBMISSIONS, NEWSLETTER_SUBSCRIPTIONS, SETTINGS
  - *Activity & Messaging*: MESSAGES, USER_NOTIFICATIONS, ACTIVITY_LOGS, AUTO_REPLY_RULES

- Color-code entity groups (subtle, not loud):
  - Hub entities: salmon / light coral
  - Booking & Payment: light green
  - Users & Content: light blue
  - Activity & Messaging: light yellow

- BOOKING_AMENITIES is a WEAK ENTITY — use a double-lined rectangle and connect with a double-lined relationship diamond to BOOKINGS.

- Every entity must participate in at least one relationship — no orphan entities.

- Labels should be crisp and readable at A3 / Letter print size.

Deliverable: a clean, single-page Chen ERD suitable for academic capstone documentation. Include a small legend explaining the cardinality notation and color key.
````

---

## How to use the prompt

1. Copy the entire code block above (inside the four-backtick fences)
2. Paste into your tool of choice:
   - **Claude / ChatGPT**: paste directly, ask it to generate the SVG or a visual description
   - **draw.io + AI**: paste as a description for draw.io's AI helper
   - **Lucidchart**: similar
   - **Mermaid Live** (`mermaid.live`): ask the AI to convert it to `erDiagram` syntax (less strict Chen but close)
   - **A real designer / you by hand**: use it as a build spec

## Why this prompt works

- **Explicit symbol requirements** — the AI won't guess what "Chen" means, it gets exact shapes.
- **Every entity listed with attributes** — no tool can invent tables you don't describe.
- **Every relationship spelled out with verb + cardinality** — the hardest part of an ERD is getting relationships right; this removes ambiguity.
- **Groupings + color hints** — optional but give the AI a layout scaffold so it doesn't scatter entities randomly.
- **Weak entity call-out** (BOOKING_AMENITIES) — Chen-specific notation that matters for academic grading.
- **"No orphan entities" rule** — avoids the floating-box issue from your earlier DBML render.

If you paste this into an image-generating AI (Claude artifacts, Midjourney, etc.) you'll get better results asking for an **SVG output** than a PNG — vector is editable afterwards.
