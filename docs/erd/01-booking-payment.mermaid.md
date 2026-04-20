# ERD · Booking & Payment (Mermaid / verb-labeled)

Paste into any Markdown viewer that supports Mermaid (GitHub, VS Code, Notion, Obsidian) — renders inline. For a strict Chen-notation drawing with diamond shapes, use this as a reference and redraw in draw.io / Lucidchart.

```mermaid
erDiagram
    USERS       ||--o{ BOOKINGS        : "places"
    USERS       ||--o{ PROMO_CODES     : "authors"
    RESORTS     ||--o{ ROOMS           : "contains"
    RESORTS     ||--o{ AMENITIES       : "offers"
    ROOMS       ||--o{ BOOKINGS        : "is reserved in"
    BOOKINGS    ||--o{ BOOKING_AMENITIES : "includes"
    ADDONS      ||--o{ BOOKING_AMENITIES : "is purchased as"

    USERS {
        bigint id PK
        varchar name
        varchar email UK
        enum role "guest, front_desk, admin, owner"
    }

    RESORTS {
        bigint id PK
        varchar name
        text description
        varchar address
        varchar phone
        varchar email
        decimal rating
    }

    AMENITIES {
        bigint id PK
        bigint resort_id FK
        varchar name
        varchar icon
        text description
    }

    ROOMS {
        bigint id PK
        bigint resort_id FK
        varchar name
        enum category "room, cottage, pavilion"
        int day_rate
        int overnight_rate
        int rate_24hr
        int capacity
        int quantity
        enum availability_status
    }

    BOOKINGS {
        bigint id PK
        bigint user_id FK "nullable for guest-token"
        bigint room_id FK
        uuid guest_token UK
        varchar guest_name
        varchar guest_email
        datetime check_in
        datetime check_out
        enum booking_type "day, night, 24hr, 24hr-pm"
        int guests
        decimal room_rate
        decimal reservation_fee
        decimal paid_amount
        decimal discount
        decimal total
        decimal entrance_fee
        varchar promo_code "snapshot, not FK"
        boolean fully_paid
        enum status "Pending, Confirmed, Checked In, Completed, Cancelled"
    }

    BOOKING_AMENITIES {
        bigint id PK
        bigint booking_id FK
        bigint addon_id FK "nullable ON DELETE SET NULL"
        varchar name "snapshot"
        int qty
        int unit_price "snapshot"
        int total
    }

    ADDONS {
        bigint id PK
        varchar name UK
        int price
        int max_qty
        boolean per_booking
        boolean is_active
    }

    PROMO_CODES {
        bigint id PK
        varchar code UK
        enum type "percentage, fixed"
        decimal value
        int max_uses
        int uses_count
        datetime expires_at
        boolean is_active
        bigint created_by FK
    }
```

## Relationship glossary

| Parent → Child | Verb | Cardinality | Notes |
|---|---|---|---|
| USERS → BOOKINGS | places | 1:N | Nullable — guests (no account) have `user_id = NULL` |
| USERS → PROMO_CODES | authors | 1:N | Owners only create promos |
| RESORTS → ROOMS | contains | 1:N | Every room belongs to exactly one resort |
| RESORTS → AMENITIES | offers | 1:N | Facet amenities (pool, Wi-Fi) |
| ROOMS → BOOKINGS | is reserved in | 1:N | A room has many historical bookings |
| BOOKINGS → BOOKING_AMENITIES | includes | 1:N | Add-on line items per booking |
| ADDONS → BOOKING_AMENITIES | is purchased as | 1:N | Nullable — catalog deletes set FK to NULL, snapshot preserves the receipt |
