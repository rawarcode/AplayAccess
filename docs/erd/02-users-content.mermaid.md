# ERD · Users & Content (Mermaid / verb-labeled)

```mermaid
erDiagram
    USERS       ||--o{ REVIEWS                  : "writes"
    BOOKINGS    ||--o| REVIEWS                  : "receives"
    RESORTS     ||--o{ GALLERY_IMAGES           : "displays"
    USERS       ||--o{ ANNOUNCEMENTS            : "publishes"
    USERS       ||--o{ CONTACT_SUBMISSIONS      : "submits"
    USERS       ||--o{ NEWSLETTER_SUBSCRIPTIONS : "subscribes via"
    USERS       ||--o{ SETTINGS                 : "last edits"

    USERS {
        bigint id PK
        varchar name
        varchar email UK
        varchar password
        enum role "guest, front_desk, admin, owner"
        varchar google_id UK "nullable"
        varchar email_otp "nullable 6-digit"
        varchar phone
        varchar avatar
        boolean is_active "false after self-delete"
    }

    BOOKINGS {
        bigint id PK
        bigint user_id FK
        varchar status
    }

    REVIEWS {
        bigint id PK
        bigint booking_id FK
        bigint user_id FK
        int rating "1-5"
        text comment
        enum status "Pending, Approved, Rejected"
        boolean featured
    }

    RESORTS {
        bigint id PK
        varchar name
    }

    GALLERY_IMAGES {
        bigint id PK
        bigint resort_id FK
        varchar image_url
        varchar caption
        enum category "pool, rooms, dining, beach, events, others"
        int sort_order
        boolean is_featured
        boolean is_hidden
    }

    ANNOUNCEMENTS {
        bigint id PK
        varchar title
        text body
        varchar media_url
        boolean is_active
        boolean is_pinned
        timestamp published_at
        bigint created_by FK "nullable ON DELETE SET NULL"
    }

    CONTACT_SUBMISSIONS {
        bigint id PK
        bigint user_id FK "nullable — anonymous ok"
        varchar name
        varchar email
        varchar subject
        text message
    }

    NEWSLETTER_SUBSCRIPTIONS {
        bigint id PK
        bigint user_id FK "nullable — anonymous ok"
        varchar email UK
    }

    SETTINGS {
        bigint id PK
        varchar key UK
        text value
        varchar label
        enum type "integer, decimal, string"
        enum group "pricing, general"
        bigint updated_by FK "nullable"
    }
```

## Relationship glossary

| Parent → Child | Verb | Cardinality | Notes |
|---|---|---|---|
| USERS → REVIEWS | writes | 1:N | Composite unique `(user_id, booking_id)` — one review per stay |
| BOOKINGS → REVIEWS | receives | 1:0..1 | A booking has at most one review |
| RESORTS → GALLERY_IMAGES | displays | 1:N | |
| USERS → ANNOUNCEMENTS | publishes | 1:N | Owners only; NULL if creator deleted |
| USERS → CONTACT_SUBMISSIONS | submits | 1:N | Nullable — anonymous form allowed |
| USERS → NEWSLETTER_SUBSCRIPTIONS | subscribes via | 1:N | Nullable — anonymous signup allowed |
| USERS → SETTINGS | last edits | 1:N | Nullable — tracks most recent editor |
