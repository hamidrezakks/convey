# WhatsApp Session & HSM Template Dispatches

Convey includes a **Predictive WhatsApp Cost Optimization Engine**. Meta/WhatsApp charges per business-initiated HSM template conversation, but allows **free 24-hour customer service session messages** following an inbound customer message.

Convey automatically tracks active 24-hour service windows per user and downgrades paid template dispatches to zero-cost plain text session messages whenever an active window is present!

---

## 1. Zero-Cost WhatsApp Plain Text Session Message

### Use Case
Replying to a customer inquiry within an active 24-hour conversation window.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "wa_session_reply_usr_99102_ticket_404",
    "userId": "usr_99102",
    "team": "customer_support",
    "category": "support_chat",
    "country": "SA",
    "priority": "normal",
    "recipients": {
      "whatsapp": "+966501234567"
    },
    "channels": [
      {
        "channel": "whatsapp",
        "content": {
          "text": "Hello! Thank you for contacting support. Your ticket #404 has been resolved. Let us know if you need further help!"
        }
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KD4E5F6G7H8J9K0L1M2N3",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

---

## 2. WhatsApp HSM Paid Template Message

### Use Case
Initiating contact outside a 24-hour service window (e.g. shipping updates or appointment reminders) using pre-approved WhatsApp templates.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "wa_template_shipping_order_77192",
    "userId": "usr_99102",
    "team": "logistics",
    "category": "shipping_update",
    "country": "SA",
    "priority": "transactional",
    "recipients": {
      "whatsapp": "+966501234567"
    },
    "channels": [
      {
        "channel": "whatsapp",
        "content": {
          "template": "shipping_notification_v1",
          "language": "ar",
          "variables": {
            "1": "أحمد",
            "2": "SHP-77192",
            "3": "Aramex"
          }
        }
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KE5F6G7H8J9K0L1M2N3P4",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:15.000Z"
}
```

---

## 🔍 Cost Optimization Engine Architecture

1. **Inbound Webhook Interceptor**: When a customer sends a WhatsApp message to your business number, `webhooks.service.ts` updates the Redis key `wa:session:<phoneNumber>` with a 24-hour TTL (86,400 seconds).
2. **Dynamic Downgrade**: When dispatching an HSM template message, the WhatsApp provider adapter checks for an active session in Redis:
   - **Active Session Found**: Converts template variables into plain text body and sends via standard session API (Cost = **\$0.00**). Increases metric `convey_whatsapp_session_optimizations_total`.
   - **No Active Session**: Dispatches standard pre-approved Meta HSM template.
