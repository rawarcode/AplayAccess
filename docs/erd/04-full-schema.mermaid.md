# ERD · Full Schema (Mermaid / verb-labeled)

Every table, one diagram. Every table participates in at least one relationship — no floating entities.

```mermaid
erDiagram
    %% ── Booking & Payment domain ──
    USERS       ||--o{ BOOKINGS                 : "places"
    USERS       ||--o{ PROMO_CODES              : "authors"
    RESORTS     ||--o{ ROOMS                    : "contains"
    RESORTS     ||--o{ AMENITIES                : "offers"
    ROOMS       ||--o{ BOOKINGS                 : "is reserved in"
    BOOKINGS    ||--o{ BOOKING_AMENITIES        : "includes"
    ADDONS      ||--o{ BOOKING_AMENITIES        : "is purchased as"

    %% ── Users & Content domain ──
    USERS       ||--o{ REVIEWS                  : "writes"
    BOOKINGS    ||--o| REVIEWS                  : "receives"
    RESORTS     ||--o{ GALLERY_IMAGES           : "displays"
    USERS       ||--o{ ANNOUNCEMENTS            : "publishes"
    USERS       ||--o{ CONTACT_SUBMISSIONS      : "submits"
    USERS       ||--o{ NEWSLETTER_SUBSCRIPTIONS : "subscribes via"
    USERS       ||--o{ SETTINGS                 : "last edits"

    %% ── Activity & Messaging domain ──
    USERS       ||--o{ MESSAGES                 : "sends"
    RESORTS     ||--o{ MESSAGES                 : "hosts"
    MESSAGES    ||--o{ MESSAGES                 : "replies to"
    USERS       ||--o{ USER_NOTIFICATIONS       : "receives"
    USERS       ||--o{ ACTIVITY_LOGS            : "performs"
    USERS       ||--o{ AUTO_REPLY_RULES         : "configures"

    USERS {
        bigint id PK
        varchar name
        varchar email UK
        varchar password
        enum role "guest, front_desk, owner"
        varchar google_id UK
        varchar email_otp
        varchar phone
        varchar avatar
        boolean is_active
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
        bigint user_id FK
        bigint room_id FK
        uuid guest_token UK
        varchar guest_name
        varchar guest_email
        datetime check_in
        datetime check_out
        enum booking_type
        int guests
        decimal room_rate
        decimal paid_amount
        decimal total
        decimal entrance_fee
        enum status
    }

    BOOKING_AMENITIES {
        bigint id PK
        bigint booking_id FK
        bigint addon_id FK
        varchar name
        int qty
        int unit_price
        int total
    }

    AMENITIES {
        bigint id PK
        bigint resort_id FK
        varchar name
        varchar icon
    }

    ADDONS {
        bigint id PK
        varchar name UK
        int price
        boolean is_active
    }

    PROMO_CODES {
        bigint id PK
        varchar code UK
        enum type
        decimal value
        int max_uses
        boolean is_active
        bigint created_by FK
    }

    REVIEWS {
        bigint id PK
        bigint booking_id FK
        bigint user_id FK
        int rating
        text comment
        enum status
        boolean featured
    }

    GALLERY_IMAGES {
        bigint id PK
        bigint resort_id FK
        varchar image_url
        enum category
        boolean is_featured
    }

    ANNOUNCEMENTS {
        bigint id PK
        varchar title
        text body
        boolean is_active
        bigint created_by FK
    }

    CONTACT_SUBMISSIONS {
        bigint id PK
        bigint user_id FK
        varchar name
        varchar email
        varchar subject
        text message
    }

    NEWSLETTER_SUBSCRIPTIONS {
        bigint id PK
        bigint user_id FK
        varchar email UK
    }

    SETTINGS {
        bigint id PK
        varchar key UK
        text value
        enum type
        enum group
        bigint updated_by FK
    }

    MESSAGES {
        bigint id PK
        bigint user_id FK
        bigint resort_id FK
        bigint parent_id FK
        varchar subject
        text body
        enum sender_type
        boolean is_read
    }

    USER_NOTIFICATIONS {
        bigint id PK
        bigint user_id FK
        varchar type
        varchar title
        boolean is_read
    }

    ACTIVITY_LOGS {
        bigint id PK
        bigint user_id FK
        varchar user_name
        varchar category
        varchar action
        text description
        varchar subject_type
        bigint subject_id
    }

    AUTO_REPLY_RULES {
        bigint id PK
        varchar keyword
        text response
        enum match_type
        boolean is_active
        int priority
        bigint created_by FK
    }
```

## Full relationship glossary

| Parent → Child | Verb | Domain |
|---|---|---|
| USERS → BOOKINGS | places | Booking & Payment |
| USERS → PROMO_CODES | authors | Booking & Payment |
| USERS → REVIEWS | writes | Users & Content |
| USERS → ANNOUNCEMENTS | publishes | Users & Content |
| USERS → CONTACT_SUBMISSIONS | submits | Users & Content |
| USERS → NEWSLETTER_SUBSCRIPTIONS | subscribes via | Users & Content |
| USERS → SETTINGS | last edits | Users & Content |
| USERS → MESSAGES | sends | Activity & Messaging |
| USERS → USER_NOTIFICATIONS | receives | Activity & Messaging |
| USERS → ACTIVITY_LOGS | performs | Activity & Messaging |
| USERS → AUTO_REPLY_RULES | configures | Activity & Messaging |
| RESORTS → ROOMS | contains | Booking & Payment |
| RESORTS → AMENITIES | offers | Booking & Payment |
| RESORTS → GALLERY_IMAGES | displays | Users & Content |
| RESORTS → MESSAGES | hosts | Activity & Messaging |
| ROOMS → BOOKINGS | is reserved in | Booking & Payment |
| BOOKINGS → BOOKING_AMENITIES | includes | Booking & Payment |
| BOOKINGS → REVIEWS | receives | Users & Content |
| ADDONS → BOOKING_AMENITIES | is purchased as | Booking & Payment |
| MESSAGES → MESSAGES | replies to | Activity & Messaging |

**Every table participates** in at least one relationship. No orphans.
