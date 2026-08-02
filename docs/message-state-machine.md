# Convey Message State Machine

This document details the lifecycle state transitions of a logical message inside Convey.

---

## 1. Lifecycle State Machine Diagram

```text
               ┌──────────┐
               │ Accepted │ (POST /v1/messages accepted, stored in DB & outbox)
               └────┬─────┘
                    │
       ┌────────────┴────────────┐
       │                         │
       ▼                         ▼
 ┌───────────┐             ┌───────────┐
 │ Scheduled │             │  Queued   │ (Relayed to BullMQ worker queue)
 └─────┬─────┘             └─────┬─────┘
       │ (promoted when due)     │
       └────────────┬────────────┘
                    │
                    ▼
              ┌───────────┐
              │  Sending  │ (Provider HTTP request initiated)
              └─────┬─────┘
                    │
       ┌────────────┴────────────┐
       │                         │
       ▼                         ▼
 ┌───────────┐             ┌───────────┐
 │ Delivered │             │  Failed   │
 └───────────┘             └─────┬─────┘
                                 │
                   ┌─────────────┴─────────────┐
                   │                           │
                   ▼                           ▼
        ┌──────────────────┐               ┌───────┐
        │Fallback Triggered│               │  DLQ  │ (Exhausted all retries/fallbacks)
        └──────────────────┘               └───────┘
```

---

## 2. State Definitions

- **`accepted`**: Validated and stored in PostgreSQL `messages` and `outbox` tables (HTTP 202 returned).
- **`scheduled`**: Delayed message scheduled for execution > 30 minutes in the future.
- **`queued`**: Enqueued in BullMQ provider send queue.
- **`sending`**: Active provider adapter send execution in progress.
- **`delivered`**: Confirmed delivered by provider or inbound webhook callback.
- **`failed`**: Execution attempt failed.
- **`fallback_triggered`**: Primary channel failed, secondary fallback channel triggered.
- **`dlq`**: All attempts, retries, and fallbacks exhausted. Message resides in Dead-Letter Queue for REST API audit/replay.
