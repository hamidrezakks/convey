# Multi-Channel Fallback Chains

Convey provides a declarative **Fallback Engine**. When a message fails to deliver or remains unread after a specified duration on the primary channel, Convey automatically triggers failover actions according to configured fallback rules (e.g. WhatsApp ➔ SMS ➔ Email).

---

## 1. Cascading Fallback (WhatsApp ➔ SMS ➔ Email)

### Use Case
Sending a high-priority delivery notification. First attempt via WhatsApp. If WhatsApp delivery fails or is not read within 300 seconds (5 minutes), fallback to SMS. If SMS fails, fallback to Email.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "fallback_delivery_ord_55201_v1",
    "userId": "usr_77102",
    "team": "logistics",
    "category": "delivery_notification",
    "country": "SA",
    "priority": "transactional",
    "recipients": {
      "whatsapp": "+966501234567",
      "phone": "+966501234567",
      "email": "user@example.sa"
    },
    "channels": [
      {
        "channel": "whatsapp",
        "content": {
          "text": "Your package #ORD-55201 is out for delivery with courier. Please be available at your address."
        }
      }
    ],
    "fallback": {
      "rules": [
        {
          "when": {
            "channel": "whatsapp",
            "event": "not_read",
            "afterSeconds": 300
          },
          "send": [
            {
              "channel": "sms",
              "content": {
                "text": "Urgent: Package #ORD-55201 out for delivery today. Courier arrives in 15 mins."
              }
            }
          ]
        },
        {
          "when": {
            "channel": "sms",
            "event": "failed"
          },
          "send": [
            {
              "channel": "email",
              "content": {
                "subject": "Delivery Notice: Package #ORD-55201 Out For Delivery",
                "text": "Your package #ORD-55201 is out for delivery today. Contact support if you need to reschedule."
              }
            }
          ]
        }
      ]
    }
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KK0L1M2N3P4Q5R6S7T8U9",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

---

## 🔍 Fallback State Machine Mechanics

```mermaid
flowchart TD
    A["POST /v1/messages"] --> B["Attempt WhatsApp"]
    B -->|Delivered & Read| C["Delivery Complete"]
    B -->|Failed OR Not Read after 300s| D["Trigger Fallback Rule 1"]
    D --> E["Attempt SMS"]
    E -->|Delivered| C
    E -->|Failed| F["Trigger Fallback Rule 2"]
    F --> G["Attempt Email"]
    G -->|Delivered| C
    G -->|Failed| H["Move to DLQ"]
```

1. **Trigger Events**:
   - `failed`: Provider returns hard delivery rejection or temporary retries exhausted.
   - `not_delivered`: Provider acknowledged send but no delivery receipt within `afterSeconds`.
   - `not_read`: Message delivered but no read receipt received within `afterSeconds`.
2. **Timer Scheduling**: Rules with `afterSeconds` schedule delayed BullMQ fallback jobs (`JobName.TRIGGER_FALLBACK`). If a `READ` or `DELIVERED` webhook arrives before the timer fires, the fallback job is cancelled.
