# Convey Per-Channel Examples & Request Payloads Guide

This guide provides comprehensive `curl` commands, JSON payload examples, multi-channel fallback rules, and envelope encryption visualizations for all 5 supported channels in Convey: **Email**, **SMS**, **Push**, **Chat**, and **Tool**.

---

## 1. Email Channel Example

### Request (`POST /v1/messages`)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_test_key" \
  -d '{
    "idempotencyKey": "email_welcome_usr_99812",
    "userId": "usr_99812",
    "team": "onboarding",
    "category": "transactional",
    "priority": "high",
    "recipients": {
      "email": "alice@example.com"
    },
    "channels": [
      {
        "channel": "email",
        "content": {
          "subject": "Welcome to Our Platform, Alice!",
          "html": "<h1>Welcome Alice!</h1><p>We are thrilled to have you onboard.</p>",
          "text": "Welcome Alice! We are thrilled to have you onboard."
        }
      }
    ]
  }'
```

---

## 2. SMS Channel Example

### Request (`POST /v1/messages`)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_test_key" \
  -d '{
    "idempotencyKey": "sms_otp_usr_44123",
    "userId": "usr_44123",
    "team": "security",
    "category": "transactional",
    "priority": "critical",
    "recipients": {
      "phone": "+971501234567"
    },
    "channels": [
      {
        "channel": "sms",
        "content": {
          "text": "Your login OTP code is 982143. Expires in 5 minutes."
        }
      }
    ]
  }'
```

---

## 3. Push Notification Example

### Request (`POST /v1/messages`)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_test_key" \
  -d '{
    "idempotencyKey": "push_order_shipped_usr_7712",
    "userId": "usr_7712",
    "team": "logistics",
    "category": "transactional",
    "priority": "normal",
    "recipients": {
      "fcmTokens": ["fcm_token_98123719823"]
    },
    "channels": [
      {
        "channel": "push",
        "content": {
          "title": "Package Out for Delivery",
          "body": "Your order #ORD-8812 is arriving today between 2 PM and 5 PM.",
          "badge": 1,
          "data": { "orderId": "ORD-8812", "trackingUrl": "https://track.example.com/ORD-8812" }
        }
      }
    ]
  }'
```

---

## 4. Chat & Instant Messaging Example (WhatsApp & Slack)

### Request (`POST /v1/messages`)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_test_key" \
  -d '{
    "idempotencyKey": "chat_payment_alert_usr_102",
    "userId": "usr_102",
    "team": "payments",
    "category": "transactional",
    "priority": "critical",
    "recipients": {
      "whatsapp": "+971501234567"
    },
    "channels": [
      {
        "channel": "whatsapp",
        "content": {
          "template": "payment_receipt_v1",
          "variables": { "customer": "Bob", "amount": "150.00 AED" }
        }
      }
    ],
    "fallback": {
      "rules": [
        {
          "when": { "channel": "whatsapp", "event": "failed" },
          "send": [{ "channel": "sms" }]
        }
      ]
    }
  }'
```

---

## 5. Tool & Alerting Channel Example (PagerDuty / Opsgenie)

### Request (`POST /v1/messages`)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_test_key" \
  -d '{
    "idempotencyKey": "alert_database_latency_high",
    "userId": "oncall_devops_team",
    "team": "infrastructure",
    "category": "alert",
    "priority": "critical",
    "recipients": {
      "email": "devops-oncall@example.com"
    },
    "channels": [
      {
        "channel": "tool",
        "content": {
          "summary": "[CRITICAL] PostgreSQL P99 query latency > 500ms",
          "severity": "critical",
          "source": "monitoring-eu-west-1",
          "details": { "p99_ms": 780, "db_cluster": "convey-pg-primary" }
        }
      }
    ]
  }'
```

---

## 6. Zero-Trust Envelope Encryption Visualization

When any of the payloads above are submitted to `POST /v1/messages`, Convey automatically packs and encrypts contact info and channel content into an AES-256-GCM envelope stored in PostgreSQL `messages.metadata._encryptedEnvelope`:

```json
{
  "metadata": {
    "_encryptedEnvelope": {
      "version": 1,
      "iv": "3f8a91c2b5d4e6f8a9b0c1d2",
      "authTag": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
      "ciphertext": "78a9c0d1e2f3456789a0b1c2d3e4f567..."
    }
  }
}
```

Plaintext phone numbers, emails, push tokens, and message text are **never** stored in PostgreSQL storage tables. Queue workers decrypt the payload in worker memory during provider dispatch.
