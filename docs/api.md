# Convey REST API Documentation

The Convey REST API provides durably queued message acceptance, real-time message status lookups, dead-letter queue (DLQ) auditing, provider webhooks ingestion, client receipt processing, tracking pixel ingestion, and system health & observability probes.

---

## Authorization & Headers

All core API endpoints require standard JSON headers and Bearer token authentication:

```http
Content-Type: application/json
Authorization: Bearer <api_key>
```

---

## 1. Send Single Message (`POST /v1/messages`)

Durably accepts a logical message request and returns immediately with `202 Accepted` (or `200 OK` if returning an existing idempotent response).

### Request Body Schema (`SendMessageRequestSchema`)

```json
{
  "idempotencyKey": "checkout_98372_payment_success_v1",
  "userId": "usr_123456",
  "team": "payments",
  "category": "transactional",
  "country": "AE",
  "campaignId": "payment-success-2026-08",
  "priority": "critical",
  "scheduledAt": "2026-08-12T10:00:00.000Z",
  "expiresAt": "2026-08-12T10:30:00.000Z",
  "recipients": {
    "email": "user@example.com",
    "phone": "+971501234567",
    "whatsapp": "+971501234567",
    "fcmTokens": ["fcm_token_98234"]
  },
  "channels": [
    {
      "channel": "whatsapp",
      "content": {
        "template": "payment_success",
        "variables": { "amount": "250.00 AED", "orderId": "ORD-99182" }
      }
    },
    {
      "channel": "email",
      "content": {
        "subject": "Payment Confirmation - Order #ORD-99182",
        "html": "<h1>Payment Received</h1><p>Thank you for your purchase.</p>"
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
  },
  "metadata": { "paymentId": "pay_89273" }
}
```

### Zero-Trust Envelope Encryption at Rest
Upon receipt, Convey packs and encrypts both recipient contact details (**`recipients` PII**) and channel body contents (**`channels` payloads**) into an AES-256-GCM encrypted envelope stored inside PostgreSQL `messages.metadata._encryptedEnvelope`:

```json
{
  "metadata": {
    "paymentId": "pay_89273",
    "_encryptedEnvelope": {
      "version": 1,
      "iv": "3f8a91c2b5d4e6f8a9b0c1d2",
      "authTag": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
      "ciphertext": "e4f8a91079d8f76e5d...b2c3d4e5f67890"
    }
  }
}
```

### Response (`202 Accepted`)
```json
{
  "messageId": "msg_01JYQ81NE7XK47PAV6MQR2P9NK",
  "state": "accepted",
  "createdAt": "2026-08-12T02:09:59.000Z"
}
```

---

## 2. Send Bulk Messages (`POST /v1/messages/bulk`)

Batch accepts multiple messages in a single request. Enforces individual message validation, zero-trust envelope encryption, and atomic batch outbox insertion.

### Request Body Schema (`BulkSendMessageRequestSchema`)

```json
{
  "messages": [
    {
      "idempotencyKey": "bulk_batch_001_usr_1",
      "userId": "usr_101",
      "team": "marketing",
      "category": "promotional",
      "recipients": { "email": "alice@example.com" },
      "channels": [
        {
          "channel": "email",
          "content": { "subject": "Weekly Newsletter", "html": "<p>Hello Alice</p>" }
        }
      ]
    },
    {
      "idempotencyKey": "bulk_batch_001_usr_2",
      "userId": "usr_102",
      "team": "marketing",
      "category": "promotional",
      "recipients": { "email": "bob@example.com" },
      "channels": [
        {
          "channel": "email",
          "content": { "subject": "Weekly Newsletter", "html": "<p>Hello Bob</p>" }
        }
      ]
    }
  ]
}
```

### Response (`202 Accepted`)
```json
{
  "total": 2,
  "items": [
    {
      "messageId": "msg_01JYQ81NE7XK47PAV6MQR2P9NK",
      "state": "accepted",
      "createdAt": "2026-08-12T02:09:59.000Z"
    },
    {
      "messageId": "msg_01JYQ81NE7XK47PAV6MQR2P9NL",
      "state": "accepted",
      "createdAt": "2026-08-12T02:09:59.000Z"
    }
  ]
}
```

---

## 3. Get Message Status (`GET /v1/messages/:messageId`)

Queries the real-time aggregate status, per-channel execution status, provider attempts, and optional audit event timeline.

### Query Parameters
- `include=timeline` *(optional)*: Includes full chronological audit event timeline.

### Response (`200 OK`)
```json
{
  "messageId": "msg_01JYQ81NE7XK47PAV6MQR2P9NK",
  "state": "delivered",
  "userId": "usr_123456",
  "team": "payments",
  "category": "transactional",
  "country": "AE",
  "createdAt": "2026-08-12T02:09:59.000Z",
  "channels": [
    {
      "channel": "whatsapp",
      "state": "delivered",
      "providerAttempts": 1,
      "provider": "whatsapp-business",
      "deliveredAt": "2026-08-12T02:10:00.120Z"
    }
  ],
  "timeline": [
    {
      "type": "message.accepted",
      "occurredAt": "2026-08-12T02:09:59.000Z"
    },
    {
      "type": "provider.dispatch",
      "providerId": "whatsapp-business",
      "occurredAt": "2026-08-12T02:09:59.500Z"
    },
    {
      "type": "message.delivered",
      "providerId": "whatsapp-business",
      "occurredAt": "2026-08-12T02:10:00.120Z"
    }
  ]
}
```

---

## 4. Dead-Letter Queue (DLQ) REST APIs

### Query Failed Messages (`GET /v1/dlq`)

Returns dead-letter queue messages that failed all attempts and fallbacks.

#### Query Parameters
- `team` *(optional)*: Filter by tenant team ID.
- `limit` *(optional, default 50)*: Number of records to return.
- `offset` *(optional, default 0)*: Offset for pagination.

```json
{
  "totalFailed": 1,
  "messages": [
    {
      "messageId": "msg_01JYQ8EY629Q04MCX7C2WHF5VD",
      "team": "orders",
      "userId": "usr_123456",
      "category": "transactional",
      "country": "US",
      "priority": "normal",
      "failedAt": "2026-08-11T22:30:00.000Z",
      "lastError": {
        "code": "PROVIDER_TIMEOUT",
        "category": "transient",
        "message": "Upstream provider connection timed out",
        "providerId": "twilio",
        "attemptNo": 3
      }
    }
  ]
}
```

### Replay Failed Messages (`POST /v1/dlq/replay`)

Resets selected failed messages back to `accepted` state and re-enqueues them to the dispatch outbox queue.

#### Request Body
```json
{
  "messageIds": ["msg_01JYQ8EY629Q04MCX7C2WHF5VD"]
}
```

#### Response (`200 OK`)
```json
{
  "replayedCount": 1,
  "messageIds": ["msg_01JYQ8EY629Q04MCX7C2WHF5VD"]
}
```

---

## 5. Webhooks, Open Tracking & Client Receipts

### Provider Inbound Webhook (`POST /v1/webhooks/:provider`)
Ingests delivery receipts, status webhooks, and bounce events from upstream providers (e.g. SendGrid, Mailgun, Twilio, Resend, Cequens, Slack).

#### Request Example (`POST /v1/webhooks/sendgrid`)
```json
[
  {
    "email": "user@example.com",
    "event": "delivered",
    "sg_message_id": "sg_msg_98127391",
    "timestamp": 1786500600
  }
]
```

#### Response (`200 OK` or `401 Unauthorized`)
```json
{
  "status": "accepted",
  "processedEvents": 1
}
```

### Open Tracking Pixel (`GET /v1/t/:token`)
Asynchronously ingests email open events via an embedded tracking pixel. Returns a `200 OK` binary `image/gif` (transparent 1x1 GIF).

```http
GET /v1/t/eyJtc2dJZCI6Im1zZ18wMUpZUS... HTTP/1.1
Host: api.convey.com
```

### Client Receipts Ingestion (`POST /v1/receipts`)
Ingests delivery/read receipts directly from client applications or mobile SDKs.

#### Request Body Schema (`ClientReceiptSchema`)
```json
{
  "messageId": "msg_01JYQ81NE7XK47PAV6MQR2P9NK",
  "receiptType": "delivered",
  "timestamp": "2026-08-12T02:10:05.000Z",
  "deviceId": "device_ios_98234",
  "metadata": { "network": "5G" }
}
```

#### Response (`202 Accepted`)
```json
{
  "status": "accepted"
}
```

---

## 6. Health & Observability Probes

### Overall System Health (`GET /health`)
Evaluates database connectivity, Redis ping, system readiness, active partitions, circuit breaker counts, and configured provider status.

#### Response (`200 OK` or `503 Service Unavailable`)
```json
{
  "status": "ok",
  "ready": true,
  "uptime": 3600.45,
  "db": "connected",
  "redis": "connected",
  "partitions": "ready",
  "circuitBreakers": { "closed": 88, "open": 0, "halfOpen": 0 },
  "configuredProvidersCount": 88,
  "configuredProvidersByChannel": {
    "email": ["ses", "sendgrid", "resend"],
    "sms": ["twilio", "nexmo", "cequens"]
  },
  "timestamp": "2026-08-12T02:10:00.000Z"
}
```

### Kubernetes Readiness Probe (`GET /health/readiness`)
Used by load balancers and Kubernetes readiness probes. Returns `200 OK` when the service is fully ready to accept incoming traffic, or `503 Service Unavailable` during startup or graceful shutdown.

### Kubernetes Liveness Probe (`GET /health/liveness`)
Used by Kubernetes liveness probes. Returns `200 OK` if the process main loop is responsive.

### Prometheus Metrics (`GET /metrics`)
Exposes standard Prometheus metrics including `convey_http_requests_total`, `convey_http_request_duration_seconds`, queue depth gauges, and process metrics.

---

## 7. Error Code Taxonomy

| Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | `400` | Invalid request payload or missing required fields |
| `IDEMPOTENCY_CONFLICT` | `409` | Same idempotency key submitted with a different payload |
| `NOT_FOUND` | `404` | Requested message ID or resource does not exist |
| `UNAUTHORIZED` | `401` | Invalid or missing API key or webhook signature |
| `NO_PROVIDER_CONFIGURED` | `503` | No enabled provider available for requested channel |
| `PROVIDER_TIMEOUT` | `504` | Upstream provider connection timed out |
| `RATE_LIMIT_EXCEEDED` | `429` | Tenant rate limit or token bucket quota exceeded |
