# Scheduled Messaging & Workload Division

Convey handles scheduled dispatches through a hybrid dual-tier architecture:
- **Near-term execution (`scheduledAt <= 30 minutes`)**: Handled directly by BullMQ delayed queues with millisecond accuracy.
- **Long-term scheduling (`scheduledAt > 30 minutes`)**: Stored in PostgreSQL partitioned tables (`messages.scheduled_at`). Promoted to BullMQ queues by the `scheduled-promoter.worker.ts` background process when entering the 30-minute window.

---

## 1. Near-Term Scheduled Dispatch (<30 Minutes)

### Use Case
Scheduling an automated webinar reminder to be dispatched in 15 minutes.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "sched_webinar_usr_10203_15m",
    "userId": "usr_10203",
    "team": "events",
    "category": "webinar_reminder",
    "country": "US",
    "priority": "normal",
    "scheduledAt": "2026-08-13T18:40:00.000Z",
    "recipients": {
      "email": "attendee@example.com"
    },
    "channels": [
      {
        "channel": "email",
        "content": {
          "subject": "Webinar starting in 15 minutes!",
          "text": "Your webinar 'Scaling Microservices with Bun & Elysia' starts at 6:40 PM. Join link: https://meet.example.com/xyz"
        }
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KL1M2N3P4Q5R6S7T8U9V0",
  "state": "scheduled",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

---

## 2. Long-Term Scheduled Dispatch (>30 Minutes)

### Use Case
Scheduling an automated subscription renewal reminder to be dispatched 7 days in the future.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "sched_sub_renewal_usr_99201_7d",
    "userId": "usr_99201",
    "team": "billing",
    "category": "subscription_renewal",
    "country": "US",
    "priority": "normal",
    "scheduledAt": "2026-08-20T10:00:00.000Z",
    "recipients": {
      "email": "subscriber@example.com"
    },
    "channels": [
      {
        "channel": "email",
        "content": {
          "subject": "Your annual subscription renews in 7 days",
          "text": "Your Acme Pro subscription will automatically renew on Aug 20, 2026 for $199/year. Manage your billing settings at https://app.example.com/billing."
        }
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KM2N3P4Q5R6S7T8U9V0W1",
  "state": "scheduled",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

---

## 🔍 Internal Workload Division

```
               POST /v1/messages (with scheduledAt)
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
    scheduledAt <= 30m                  scheduledAt > 30m
  (Direct BullMQ Delayed Queue)      (PostgreSQL Scheduled State)
            │                                   │
            │                         (Wait in DB Partitions)
            │                                   │
            │                      `scheduled-promoter.worker`
            │                     (Promotes when window <= 30m)
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
                       Message Dispatch
```
