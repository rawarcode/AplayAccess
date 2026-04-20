# ERD · Activity & Messaging (Mermaid / verb-labeled)

```mermaid
erDiagram
    USERS      ||--o{ MESSAGES            : "sends"
    RESORTS    ||--o{ MESSAGES            : "hosts"
    MESSAGES   ||--o{ MESSAGES            : "replies to"
    USERS      ||--o{ USER_NOTIFICATIONS  : "receives"
    USERS      ||--o{ ACTIVITY_LOGS       : "performs"
    USERS      ||--o{ AUTO_REPLY_RULES    : "configures"

    USERS {
        bigint id PK
        varchar name
        varchar role
    }

    RESORTS {
        bigint id PK
        varchar name
    }

    MESSAGES {
        bigint id PK
        bigint user_id FK
        bigint resort_id FK
        bigint parent_id FK "self-ref, nullable for starters"
        varchar subject
        text body
        enum sender_type "guest, resort"
        boolean is_read
    }

    USER_NOTIFICATIONS {
        bigint id PK
        bigint user_id FK
        varchar type "booking_confirmed, payment_collected, message_received, ..."
        varchar title
        varchar body
        boolean is_read
    }

    ACTIVITY_LOGS {
        bigint id PK
        bigint user_id FK "nullable — survives user delete"
        varchar user_name "snapshot"
        varchar user_role "snapshot"
        varchar category "booking, room, user, promo, settings, content, review, system"
        varchar action
        text description
        varchar subject_type "polymorphic — no FK"
        bigint subject_id "polymorphic — no FK"
        varchar ip_address
    }

    AUTO_REPLY_RULES {
        bigint id PK
        varchar keyword
        text response
        enum match_type "contains, exact, starts_with"
        boolean is_active
        int priority
        bigint created_by FK "nullable ON DELETE SET NULL"
    }
```

## Relationship glossary

| Parent → Child | Verb | Cardinality | Notes |
|---|---|---|---|
| USERS → MESSAGES | sends | 1:N | `sender_type` (enum) tells us if the message is from the guest or the resort |
| RESORTS → MESSAGES | hosts | 1:N | Conversation thread belongs to a resort |
| MESSAGES → MESSAGES | replies to | 1:N | Self-referential: `parent_id` points at the thread starter |
| USERS → USER_NOTIFICATIONS | receives | 1:N | In-app alerts (booking updates, new replies) |
| USERS → ACTIVITY_LOGS | performs | 1:N | Audit trail; preserves the log even after user is deleted |
| USERS → AUTO_REPLY_RULES | configures | 1:N | Owners only author chatbot rules |

> **Polymorphic caveat**: `activity_logs.subject_type` + `subject_id` form a polymorphic link to any model (Booking, Room, PromoCode, etc.). No FK constraint — resolved at application level.
