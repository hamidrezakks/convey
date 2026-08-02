# Convey Fallback & Failover State Machine

Convey implements dual-layer resilience strategy: **Same-Channel Provider Failover** and **Cross-Channel Message Fallback**.

---

## 1. Execution Flow & Evaluation Engine

```text
               ┌────────────────────────────────────────────────────────┐
               │              Primary Provider Execution                │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                  (Attempt Failed)
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │           Evaluate Same-Channel Failovers              │
               │   (Alternative enabled provider in same channel)       │
               └───────────────────────────┬────────────────────────────┘
                                           │
                       ┌───────────────────┴───────────────────┐
                       │                                       │
                  (Available)                             (Exhausted)
                       │                                       │
                       ▼                                       ▼
       ┌───────────────────────────────┐       ┌───────────────────────────────┐
       │ Retry with Backup Provider    │       │  Evaluate Cross-Channel Rules │
       │ (e.g. SES -> SendGrid)        │       │  (e.g. WhatsApp -> SMS)       │
       └───────────────────────────────┘       └───────────────┬───────────────┘
                                                               │
                                           ┌───────────────────┴───────────────────┐
                                           │                                       │
                                      (Rule Matches)                         (No Match)
                                           │                                       │
                                           ▼                                       ▼
                           ┌───────────────────────────────┐       ┌───────────────────────────────┐
                           │ Enqueue Fallback Channel Job  │       │ Transition Message to DLQ     │
                           └───────────────────────────────┘       └───────────────────────────────┘
```

---

## 2. Fallback Rule Specification

Fallback rules are specified directly in `POST /v1/messages` request payload:

```json
{
  "fallback": {
    "rules": [
      {
        "when": { "channel": "whatsapp", "event": "failed" },
        "send": [{ "channel": "sms" }]
      },
      {
        "when": { "channel": "sms", "event": "failed" },
        "send": [{ "channel": "email" }]
      }
    ]
  }
}
```

1. **Same-Channel Failover**: If `whatsapp-business` fails due to provider rate limit or error, `SmartRouter` attempts `twilio-whatsapp` or `cequens-whatsapp` before triggering cross-channel fallback.
2. **Cross-Channel Fallback**: If all WhatsApp providers fail or time out, `fallback-retry.worker.ts` matches rule `{ "when": { "channel": "whatsapp", "event": "failed" } }` and enqueues an SMS fallback attempt.
