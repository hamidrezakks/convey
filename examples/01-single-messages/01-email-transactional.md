# Email Transactional & Template Dispatches

Convey provides complete email dispatch support across multiple providers (e.g., SendGrid, Mandrill, Mailgun, Amazon SES). It supports raw HTML body content, plain text fallbacks, and server-side component/template rendering with dynamic localized props.

---

## 1. Raw HTML & Text Email Dispatch

### Use Case
Sending transactional emails such as security alerts, password resets, or account verification notices with custom HTML markup and plain text alternatives.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -H "x-convey-sandbox: true" \
  -d '{
    "idempotencyKey": "email_pw_reset_usr_88321_v1",
    "userId": "usr_88321",
    "team": "engineering",
    "category": "security_alert",
    "country": "US",
    "priority": "critical",
    "recipients": {
      "email": "user@example.com"
    },
    "channels": [
      {
        "channel": "email",
        "content": {
          "subject": "Reset your password",
          "html": "<div><h1>Password Reset Request</h1><p>Click <a href=\"https://app.example.com/reset?token=xyz123\">here</a> to reset your password. Valid for 15 minutes.</p></div>",
          "text": "Password Reset Request: Visit https://app.example.com/reset?token=xyz123 to reset your password. Valid for 15 minutes."
        }
      }
    ],
    "metadata": {
      "ipAddress": "192.168.1.50",
      "userAgent": "Mozilla/5.0"
    }
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5K8X9Y0Z1A2B3C4D5E6F7G8",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

---

## 2. Server-Side Template & Component Rendering Email

### Use Case
Sending standardized order confirmations or receipts using registered template components with dynamic props and locale settings.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "order_receipt_ord_99410_v1",
    "userId": "usr_1024",
    "team": "ecommerce",
    "category": "order_confirmation",
    "country": "DE",
    "priority": "transactional",
    "recipients": {
      "email": "kunde@example.de"
    },
    "channels": [
      {
        "channel": "email",
        "content": {
          "subject": "Bestätigung Ihrer Bestellung #99410",
          "render": {
            "template": "order-confirmation-v2",
            "version": "2.1.0",
            "locale": "de-DE",
            "props": {
              "customerName": "Hans Müller",
              "orderId": "ORD-99410",
              "totalAmount": 149.99,
              "currency": "EUR",
              "items": [
                { "name": "Wireless Headphones", "quantity": 1, "price": 149.99 }
              ]
            }
          }
        }
      }
    ],
    "metadata": {
      "storefront": "de_official"
    }
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5K9A1B2C3D4E5F6G7H8J9K0",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:05.000Z"
}
```

---

## 🔍 Detailed Explanation

1. **Fast-Path Acceptance**: The API handler performs a single Redis `SET NX` idempotency reservation check, writes the record into the `messages` table and `outbox` table within **1 Postgres transaction**, and returns `202 Accepted` immediately (in under 5 milliseconds).
2. **Asynchronous Outbox Dispatch**: The `outbox-relay.worker.ts` process picks up pending outbox records using `FOR UPDATE SKIP LOCKED` and enqueues them into BullMQ queue `message-dispatch`.
3. **Provider Selection & Failover**: The `provider-send.worker.ts` resolves the optimal email provider (e.g., SendGrid primary, Mandrill secondary) based on dynamic health scorecards and attempts delivery.
4. **AES-256 Envelope Encryption**: Recipient emails and channel payloads are encrypted transparently at rest in the `messages.metadata._encryptedEnvelope` column.
