# Convey REST API Specification & Reference Manual

The Convey REST API provides sub-15ms synchronous message acceptance, high-throughput batching, real-time message status lookups, audit timelines, customer webhook subscriptions, suppression management, dead-letter queue (DLQ) operations, provider webhook ingestion, and Kubernetes/Prometheus observability probes.

---

## Authorization & Standard Headers

All API endpoints (except public tracking pixels, inbound provider webhooks, and health probes) require standard JSON headers and Bearer token authentication:

```http
Content-Type: application/json
Authorization: Bearer <api_key>
X-Idempotency-Key: <unique_client_key>  (Optional, recommended on all POST endpoints)
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01  (Optional, W3C TraceContext)
```

### Rate-Limiting Headers
Responses include standard rate-limiting metadata:
- `X-RateLimit-Limit`: Maximum requests permitted per window.
- `X-RateLimit-Remaining`: Remaining requests in current window.
- `X-RateLimit-Reset`: UNIX epoch timestamp when window resets.

---

## 1. Messaging Endpoints

### 1.1 Single Message Ingestion (`POST /v1/messages`)
Accepts a single multi-channel notification request into the transactional outbox pipeline.

#### Request Body (`SendMessageRequestSchema`)
```json
{
  "idempotencyKey": "order_conf_10928",
  "userId": "usr_99182",
  "team": "payments",
  "category": "transactional",
  "country": "AE",
  "priority": "critical",
  "scheduledAt": "2026-08-16T23:00:00.000Z",
  "expiresAt": "2026-08-17T00:00:00.000Z",
  "isSandbox": false,
  "recipients": {
    "email": "customer@example.com",
    "phone": "+971501234567",
    "whatsapp": "+971501234567",
    "fcmTokens": ["fcm_device_token_abc123"]
  },
  "channels": [
    {
      "channel": "whatsapp",
      "content": {
        "template": "payment_confirmed",
        "variables": { "amount": "250.00 AED", "orderId": "ORD-10928" }
      }
    },
    {
      "channel": "email",
      "content": {
        "subject": "Payment Confirmation - Order #ORD-10928",
        "html": "<h1>Thank you for your order!</h1><p>Your payment of 250.00 AED was successful.</p>",
        "text": "Your payment of 250.00 AED for order #ORD-10928 was successful."
      }
    }
  ],
  "fallback": {
    "enabled": true,
    "strategy": "waterfall",
    "rules": [
      {
        "when": { "channel": "whatsapp", "event": "failed" },
        "send": [{ "channel": "sms", "provider": "twilio" }]
      }
    ]
  },
  "metadata": {
    "orderId": "10928",
    "internalCustomerId": "cust_881273"
  }
}
```

#### Response (`202 Accepted`):
```json
{
  "success": true,
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "status": "accepted",
  "acceptedAt": "2026-08-16T22:42:00.000Z",
  "channels": ["whatsapp", "email"],
  "recipientsCount": 1
}
```

---

### 1.2 High-Throughput Bulk Message Ingestion (`POST /v1/messages/bulk`)
Accepts up to 5,000 individualized message items in a single HTTP payload.

#### Request Body (`BulkSendMessageRequestSchema`)
```json
{
  "team": "marketing",
  "batchName": "summer_promo_2026",
  "items": [
    {
      "idempotencyKey": "bulk_promo_usr_001",
      "userId": "usr_001",
      "recipients": { "phone": "+14155550001" },
      "channels": [
        { "channel": "sms", "content": { "text": "Flash Sale: 20% off today!" } }
      ]
    },
    {
      "idempotencyKey": "bulk_promo_usr_002",
      "userId": "usr_002",
      "recipients": { "phone": "+14155550002" },
      "channels": [
        { "channel": "sms", "content": { "text": "Flash Sale: 20% off today!" } }
      ]
    }
  ]
}
```

#### Response (`202 Accepted`):
```json
{
  "total": 2,
  "accepted": 2,
  "items": [
    { "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3", "state": "accepted", "idempotencyKey": "bulk_promo_usr_001" },
    { "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G4", "state": "accepted", "idempotencyKey": "bulk_promo_usr_002" }
  ]
}
```

---

### 1.3 Get Message Status (`GET /v1/messages/:messageId`)
Queries real-time aggregate status, per-channel status, and provider attempt history.

#### Query Parameters:
- `include`: Comma-separated relationships (`timeline`, `attempts`).

#### Response (`200 OK`):
```json
{
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "state": "delivered",
  "userId": "usr_99182",
  "team": "payments",
  "category": "transactional",
  "country": "AE",
  "createdAt": "2026-08-16T22:42:00.000Z",
  "completedAt": "2026-08-16T22:42:01.200Z",
  "channels": [
    {
      "channel": "whatsapp",
      "state": "delivered",
      "provider": "whatsapp-business",
      "attempts": 1,
      "deliveredAt": "2026-08-16T22:42:01.200Z"
    }
  ]
}
```

---

### 1.4 Get Message Audit Timeline (`GET /v1/messages/:messageId/timeline`)
Retrieves chronological append-only lifecycle events.

#### Response (`200 OK`):
```json
{
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "timeline": [
    { "type": "message.accepted", "occurredAt": "2026-08-16T22:42:00.000Z" },
    { "type": "provider.dispatch", "providerId": "whatsapp-business", "occurredAt": "2026-08-16T22:42:00.450Z" },
    { "type": "message.delivered", "providerId": "whatsapp-business", "occurredAt": "2026-08-16T22:42:01.200Z" },
    { "type": "message.read", "occurredAt": "2026-08-16T22:45:30.000Z" }
  ]
}
```

---

### 1.5 Query User Message History (`GET /v1/messages/user/:userId`)
Queries message history for a specific recipient user.

#### Query Parameters:
- `limit` *(default: 50)*: Number of records.
- `offset` *(default: 0)*: Pagination offset.
- `team` *(optional)*: Tenant boundary filter.

---

### 1.6 Ingest Client Receipts (`POST /v1/receipts`)
Ingests delivery and read confirmations directly from client mobile applications or SDKs.

#### Request Body (`ClientReceiptSchema`):
```json
{
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "receiptType": "read",
  "timestamp": "2026-08-16T22:45:30.000Z",
  "deviceId": "device_ios_98234",
  "metadata": { "batteryLevel": 0.85, "network": "WiFi" }
}
```

#### Response (`202 Accepted`):
```json
{ "status": "accepted" }
```

---

## 2. Batches & Campaigns Endpoints

### 2.1 Create Batch Dispatch Context (`POST /v1/batches`)
```json
{
  "team": "marketing",
  "name": "q3_reactivation",
  "totalItems": 10000,
  "metadata": { "campaignId": "camp_reactivate_2026" }
}
```

### 2.2 Control Batch Execution
- `GET /v1/batches`: List team batches.
- `GET /v1/batches/:batchId`: Query batch status, progress percentage, and success/failure counts.
- `POST /v1/batches/:batchId/pause`: Pauses processing of remaining queue jobs.
- `POST /v1/batches/:batchId/resume`: Resumes paused batch execution.
- `POST /v1/batches/:batchId/cancel`: Cancels all pending messages in batch.

---

## 3. Dead-Letter Queue (DLQ) Operations

### 3.1 List DLQ Failed Messages (`GET /v1/dlq`)
#### Query Parameters:
- `team` *(optional)*: Filter by tenant.
- `limit` *(default: 50, max: 200)*.
- `offset` *(default: 0)*.

#### Response (`200 OK`):
```json
{
  "total": 1,
  "messages": [
    {
      "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
      "team": "payments",
      "userId": "usr_99182",
      "failedAt": "2026-08-16T22:42:15.000Z",
      "lastError": {
        "code": "PROVIDER_TIMEOUT",
        "category": "transient",
        "message": "Gateway timed out waiting for upstream response",
        "providerId": "twilio",
        "attemptNo": 3
      }
    }
  ]
}
```

### 3.2 Replay Failed Messages (`POST /v1/dlq/replay`)
Resets message state to `accepted` and re-inserts into transactional outbox with optional provider override.

```json
{
  "messageIds": ["msg_01J0N7C0W7X2R6S8V9Q9B1E4G3"],
  "overrideProvider": "resend"
}
```

### 3.3 Purge DLQ Messages (`POST /v1/dlq/purge`)
Permanently cleans up terminal DLQ messages.

```json
{
  "team": "payments",
  "olderThan": "2026-08-01T00:00:00.000Z"
}
```

---

## 4. Suppression List Management

Convey maintains high-speed normalized SHA-256 hashed suppression lists to prevent compliance violations (CAN-SPAM, GDPR) and provider reputation penalties.

### 4.1 Add Suppression (`POST /v1/suppressions`)
```json
{
  "team": "payments",
  "recipient": "unsubscribed_user@example.com",
  "channel": "email",
  "reason": "unsubscribe",
  "metadata": { "source": "preference_center" }
}
```

### 4.2 Query & Check Suppressions
- `GET /v1/suppressions`: List suppressions with pagination.
- `GET /v1/suppressions/check?recipient=alice@example.com&channel=email`: Returns `{ "suppressed": true, "reason": "bounce" }`.
- `DELETE /v1/suppressions/:id`: Removes suppression entry.

---

## 5. Customer Webhook Subscriptions

Clients can subscribe to real-time message delivery events signed with HMAC-SHA256.

### 5.1 Create Webhook Subscription (`POST /v1/webhooks/subscriptions`)
```json
{
  "team": "payments",
  "targetUrl": "https://api.merchant.com/webhooks/convey",
  "secret": "whsec_981273918273918273",
  "events": ["message.delivered", "message.failed", "message.opened", "message.read"]
}
```

### 5.2 Subscription Management
- `GET /v1/webhooks/subscriptions`: List active subscriptions.
- `GET /v1/webhooks/subscriptions/:id`: Get subscription details and delivery statistics.
- `PATCH /v1/webhooks/subscriptions/:id`: Update URL, events, or active status.
- `DELETE /v1/webhooks/subscriptions/:id`: Delete subscription.

---

## 6. Provider Webhooks & Tracking

### 6.1 Provider Inbound Webhook (`POST /v1/webhooks/:provider`)
Ingests delivery receipts, bounces, complaints, and inbound chat messages from 88 upstream providers with automatic signature validation.

```bash
curl -X POST http://localhost:3000/v1/webhooks/sendgrid \
  -H "Content-Type: application/json" \
  -H "X-Twilio-Email-Event-Webhook-Signature: ..." \
  -H "X-Twilio-Email-Event-Webhook-Timestamp: ..." \
  -d '[
    {
      "email": "user@example.com",
      "event": "delivered",
      "sg_message_id": "sg_10928312.filter",
      "timestamp": 1786500600
    }
  ]'
```

### 6.2 Email Open Tracking Pixel (`GET /v1/t/:token`)
Zero-footprint 1x1 transparent GIF endpoint for email open telemetry.
- Returns `image/gif` with `Cache-Control: no-cache, no-store, must-revalidate`.

---

## 7. Sandbox Mode API

### 7.1 Inspect Sandbox Messages (`GET /v1/sandbox/messages`)
Queries messages dispatched with `isSandbox: true`. External provider APIs are never called; payloads are recorded in memory/database for end-to-end integration testing.

### 7.2 Purge Sandbox Messages (`DELETE /v1/sandbox/messages`)
Clears all mock sandbox records.

---

## 8. System Health & Observability Probes

### 8.1 Comprehensive Health Status (`GET /health`)
Evaluates database connection, Redis ping, active monthly partitions, circuit breaker status for all 88 providers, and memory footprint.

#### Response (`200 OK`):
```json
{
  "status": "ok",
  "ready": true,
  "uptime": 86400.25,
  "db": "connected",
  "redis": "connected",
  "partitions": "ready",
  "circuitBreakers": { "closed": 88, "open": 0, "halfOpen": 0 },
  "configuredProvidersCount": 88,
  "timestamp": "2026-08-16T22:42:00.000Z"
}
```

### 8.2 Kubernetes Probes
- **Readiness Probe (`GET /health/readiness`)**: Returns `200 OK` when ready; returns `503 Service Unavailable` during startup or graceful shutdown.
- **Liveness Probe (`GET /health/liveness`)**: Returns `200 OK` while process event loop is responsive.

### 8.3 Prometheus Metrics (`GET /metrics`)
Exposes all system metrics in standard Prometheus text format.

### 8.4 OpenAPI Swagger UI (`GET /swagger`)
Interactive OpenAPI 3.1 documentation and live API playground.

---

## 9. Error Code Taxonomy & HTTP Status Matrix

| Error Code | HTTP Status | Root Cause & Resolution |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | `400` | Malformed JSON schema or missing required fields. Inspect `details` array in error response. |
| `IDEMPOTENCY_CONFLICT` | `409` | Same `X-Idempotency-Key` submitted with a different payload hash. Check client retry logic. |
| `UNAUTHORIZED` | `401` | Missing or invalid Bearer API key or failed webhook signature verification. |
| `FORBIDDEN` | `403` | API key lacks permission for requested team or operation. |
| `NOT_FOUND` | `404` | Message ID, batch ID, or subscription ID does not exist in partition window. |
| `RATE_LIMIT_EXCEEDED` | `429` | Tenant request rate limit exceeded. Back off using `X-RateLimit-Reset`. |
| `SUPPRESSED_RECIPIENT` | `422` | Recipient is on suppression list (bounced/unsubscribed). |
| `NO_PROVIDER_CONFIGURED`| `503` | No enabled provider available for requested channel. |
| `PROVIDER_TIMEOUT` | `504` | Upstream provider connection timed out. |
| `INTERNAL_ERROR` | `500` | Unhandled server exception. Transaction rolled back safely. |
