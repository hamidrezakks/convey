# Convey Per-Channel Request Payloads & Examples Guide

This guide provides concrete, production-ready `curl` commands, JSON payload examples, multi-channel fallback rules, and envelope encryption visualizations for all 5 supported channels: **Email**, **SMS**, **Push**, **Chat**, and **Tool**.

---

## 1. 📧 Email Channel Example (Transactional & Rich HTML)

### Request (`POST /v1/messages`)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_live_secret_key" \
  -H "X-Idempotency-Key: email_welcome_usr_99812" \
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  -d '{
    "idempotencyKey": "email_welcome_usr_99812",
    "userId": "usr_99812",
    "team": "onboarding",
    "category": "transactional",
    "priority": "high",
    "recipients": {
      "email": "sarah.connor@example.com",
      "name": "Sarah Connor"
    },
    "channels": [
      {
        "channel": "email",
        "provider": "ses",
        "content": {
          "subject": "Welcome to Convey, Sarah!",
          "html": "<h1>Welcome aboard, Sarah!</h1><p>Your workspace is ready. Click below to get started.</p><a href=\"https://app.example.com/start\">Launch Workspace</a>",
          "text": "Welcome aboard, Sarah! Your workspace is ready: https://app.example.com/start",
          "from": "Convey Team <hello@convey.example.com>",
          "replyTo": "support@convey.example.com"
        }
      }
    ],
    "metadata": {
      "accountType": "enterprise",
      "signupSource": "web_direct"
    }
  }'
```

#### Response (`202 Accepted`):
```json
{
  "success": true,
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "status": "accepted",
  "acceptedAt": "2026-08-16T22:42:00.000Z",
  "channels": ["email"],
  "recipientsCount": 1
}
```

---

## 2. 📱 SMS Channel Example (Critical Security OTP)

### Request (`POST /v1/messages`)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_live_secret_key" \
  -H "X-Idempotency-Key: sms_otp_usr_44123" \
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
        "provider": "twilio",
        "content": {
          "text": "Your Convey verification code is 982143. Valid for 5 minutes. Do not share this code.",
          "from": "CONVEY"
        }
      }
    ]
  }'
```

---

## 3. 🔔 Push Notification Example (Mobile In-App Alerts)

### Request (`POST /v1/messages`)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_live_secret_key" \
  -H "X-Idempotency-Key: push_order_shipped_usr_7712" \
  -d '{
    "idempotencyKey": "push_order_shipped_usr_7712",
    "userId": "usr_7712",
    "team": "logistics",
    "category": "transactional",
    "priority": "normal",
    "recipients": {
      "fcmTokens": ["fcm_token_device_ios_98127391823"]
    },
    "channels": [
      {
        "channel": "push",
        "provider": "fcm",
        "content": {
          "title": "Package Out for Delivery 📦",
          "body": "Order #ORD-8812 is arriving today between 2:00 PM and 5:00 PM.",
          "badge": 1,
          "sound": "default",
          "imageUrl": "https://cdn.example.com/assets/delivery-truck.png",
          "data": {
            "orderId": "ORD-8812",
            "trackingUrl": "https://track.example.com/ORD-8812"
          }
        }
      }
    ]
  }'
```

---

## 4. 💬 Chat Channel Example (WhatsApp & Slack)

### 4.1 WhatsApp with 24h Session Cost Optimization
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_live_secret_key" \
  -H "X-Idempotency-Key: chat_payment_alert_usr_102" \
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
        "channel": "chat",
        "provider": "whatsapp-business",
        "content": {
          "template": "payment_receipt_v1",
          "templateBody": "Hi {{1}}, your payment of {{2}} for order {{3}} has been received!",
          "variables": {
            "1": "Bob",
            "2": "150.00 AED",
            "3": "ORD-99182"
          }
        }
      }
    ]
  }'
```
*(Note: If the customer messaged within the last 24h, Convey compiles the template into plain text and dispatches as `$0.00` plain text!)*

### 4.2 Slack Rich Block Kit Layout
```json
{
  "channel": "chat",
  "provider": "slack",
  "content": {
    "text": "Deployment Succeeded: API v2.4.0",
    "blocks": [
      {
        "type": "section",
        "text": { "type": "mrkdwn", "text": "*Deployment Succeeded* :rocket:\n*Release*: `v2.4.0` | *Environment*: `production-eu-west-1`" }
      }
    ]
  }
}
```

---

## 5. 🛠️ Tool & Alerting Channel Example (PagerDuty / Opsgenie)

### Request (`POST /v1/messages`)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_live_secret_key" \
  -H "X-Idempotency-Key: alert_database_p99_latency" \
  -d '{
    "idempotencyKey": "alert_database_p99_latency",
    "userId": "oncall_sre_team",
    "team": "infrastructure",
    "category": "alert",
    "priority": "critical",
    "recipients": {
      "email": "devops-oncall@example.com"
    },
    "channels": [
      {
        "channel": "tool",
        "provider": "pagerduty",
        "content": {
          "summary": "[CRITICAL] PostgreSQL primary P99 query latency > 500ms",
          "severity": "critical",
          "source": "monitoring-eu-west-1",
          "details": {
            "p99LatencyMs": 780,
            "activeConnections": 142,
            "cluster": "convey-pg-primary"
          }
        }
      }
    ]
  }'
```

---

## 6. Multi-Channel Waterfall Cascade with Quiet-Hours STO

```json
{
  "idempotencyKey": "security_alert_cascade_usr_55",
  "userId": "usr_55",
  "team": "security",
  "category": "security_alert",
  "priority": "critical",
  "recipients": {
    "email": "alice@example.com",
    "phone": "+14155552671",
    "whatsapp": "+14155552671",
    "fcmTokens": ["fcm_token_device_abc"]
  },
  "channels": [
    {
      "channel": "push",
      "content": { "title": "Security Alert", "body": "New login from Tokyo, Japan" }
    },
    {
      "channel": "chat",
      "content": { "template": "security_login_alert", "variables": { "location": "Tokyo, Japan" } }
    },
    {
      "channel": "sms",
      "content": { "text": "Convey Alert: New login from Tokyo, Japan. If this was not you, lock your account." }
    }
  ],
  "fallback": {
    "enabled": true,
    "strategy": "waterfall",
    "rules": [
      { "when": { "channel": "push", "event": "failed" }, "send": [{ "channel": "chat", "provider": "whatsapp-business" }] },
      { "when": { "channel": "chat", "event": "failed" }, "send": [{ "channel": "sms", "provider": "twilio" }] }
    ]
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "strategy": "hold_until_morning",
    "recipientTimezone": "America/Los_Angeles"
  }
}
```

---

## 7. Zero-Trust Envelope Encryption Visualization

Upon ingestion, Convey encrypts all PII and message content before database persistence:

```json
{
  "metadata": {
    "_encryptedEnvelope": {
      "version": 1,
      "algorithm": "aes-256-gcm",
      "iv": "3f8a91c2b5d4e6f8a9b0c1d2",
      "authTag": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
      "ciphertext": "e4f8a91079d8f76e5d9c8b7a6f5e4d3c2b1a0987654321fedcba9876543210..."
    }
  }
}
```
*Contact details and message bodies are never exposed in SQL storage.*
