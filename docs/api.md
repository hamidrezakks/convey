# Convey REST API Specification & Master Reference Manual

The Convey REST API provides sub-15ms synchronous message acceptance, high-throughput bulk dispatch, real-time message status lookups, audit timelines, customer webhook subscriptions, suppression management, dead-letter queue (DLQ) operations, provider webhook ingestion, admin mission control management, and Kubernetes/Prometheus observability probes.

---

## Authorization & Standard Headers

All tenant API endpoints require standard JSON headers and Bearer token authentication (when `CONVEY_REQUIRE_AUTH=true`):

```http
Content-Type: application/json
Authorization: Bearer <api_key>
X-Idempotency-Key: <unique_client_key>  (Optional, recommended on all POST endpoints)
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01  (Optional, W3C TraceContext)
```

### Rate-Limiting & Telemetry Headers
Every response includes standard rate-limiting and tracing metadata:
- `traceparent`: W3C Distributed TraceContext header.
- `X-RateLimit-Limit`: Maximum requests permitted per window.
- `X-RateLimit-Remaining`: Remaining requests in current window.
- `X-RateLimit-Reset`: UNIX epoch timestamp when window resets.

---

## 1. Messaging Endpoints (`/v1/messages`)

### 1.1 Ingest Single Message (`POST /v1/messages`)
Accepts a multi-channel notification request into the transactional outbox pipeline within **`< 15ms`**.

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

#### Request Body (`BulkSendMessageRequestSchema`):
```json
{
  "messages": [
    {
      "idempotencyKey": "bulk_promo_usr_001",
      "userId": "usr_001",
      "team": "marketing",
      "category": "promotional",
      "recipients": { "phone": "+14155550001" },
      "channels": [
        { "channel": "sms", "content": { "text": "Flash Sale: 20% off today!" } }
      ]
    },
    {
      "idempotencyKey": "bulk_promo_usr_002",
      "userId": "usr_002",
      "team": "marketing",
      "category": "promotional",
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
  "items": [
    { "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3", "status": "accepted", "idempotencyKey": "bulk_promo_usr_001" },
    { "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G4", "status": "accepted", "idempotencyKey": "bulk_promo_usr_002" }
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

## 2. Batches & Campaigns Endpoints (`/v1/batches`)

### 2.1 Initialize Batch Context (`POST /v1/batches`)
```json
{
  "totalCount": 10000,
  "metadata": { "campaignId": "camp_reactivate_2026", "campaignName": "Summer Promo" }
}
```
**Response (`201 Created`)**: Returns `{ "success": true, "batch": { "id": "batch_01J0N...", ... } }`.

### 2.2 List & Control Batches
- `GET /v1/batches`: List team batches with live Redis stats.
- `GET /v1/batches/:batchId`: Query batch completion %, throughput msg/sec, and ETA.
- `POST /v1/batches/:batchId/pause`: Pauses processing of remaining queue jobs in batch.
- `POST /v1/batches/:batchId/resume`: Resumes paused batch execution.
- `POST /v1/batches/:batchId/cancel`: Cancels all pending messages in batch.

---

## 3. Dead-Letter Queue (DLQ) Operations (`/v1/dlq`)

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
Resets message state to `accepted` and re-inserts into transactional outbox.
```json
{
  "messageIds": ["msg_01J0N7C0W7X2R6S8V9Q9B1E4G3"]
}
```

### 3.3 Mutated DLQ Replay (`POST /v1/dlq/replay-mutated`)
Replays messages with modified payload or provider override.
```json
{
  "messageIds": ["msg_01J0N7C0W7X2R6S8V9Q9B1E4G3"],
  "overrideProvider": "resend",
  "payloadPatch": { "content": { "subject": "Updated Subject" } }
}
```

---

## 4. Sandbox Mode API (`/v1/sandbox`)

### 4.1 Inspect Sandbox Messages (`GET /v1/sandbox/messages`)
Queries messages dispatched with `isSandbox: true`. External provider APIs are never called; payloads are recorded in memory/database for end-to-end integration testing.

### 4.2 Purge Sandbox Messages (`DELETE /v1/sandbox/messages`)
Clears all mock sandbox records for the authenticated team.

---

## 5. Suppression List Management (`/v1/suppressions`)

Convey maintains high-speed normalized SHA-256 hashed suppression lists to prevent compliance violations (CAN-SPAM, GDPR) and protect provider sender reputation.

### 5.1 Add Single Suppression (`POST /v1/suppressions`)
```json
{
  "identifier": "unsubscribed_user@example.com",
  "identifierType": "email",
  "reason": "unsubscribe",
  "channel": "email",
  "category": "marketing"
}
```

### 5.2 Bulk Add Suppressions (`POST /v1/suppressions/bulk`)
```json
{
  "items": [
    { "identifier": "bounce1@example.com", "reason": "hard_bounce", "channel": "email" },
    { "identifier": "+14155550199", "reason": "spam_complaint", "channel": "sms" }
  ]
}
```

### 5.3 Query & Remove Suppressions
- `GET /v1/suppressions`: List suppressions with filters (`limit`, `offset`, `channel`, `reason`, `search`).
- `DELETE /v1/suppressions/:id`: Permanently removes suppression record.

---

## 6. Customer Webhook Subscriptions (`/v1/webhook-subscriptions`)

Clients can subscribe to real-time message delivery events signed with HMAC-SHA256 (`X-Convey-Signature`).

### 6.1 Create Webhook Subscription (`POST /v1/webhook-subscriptions`)
```json
{
  "url": "https://api.merchant.com/webhooks/convey",
  "events": ["message.delivered", "message.failed", "message.opened", "message.read"],
  "secret": "whsec_981273918273918273"
}
```

### 6.2 Subscription Management
- `GET /v1/webhook-subscriptions`: List active subscriptions.
- `DELETE /v1/webhook-subscriptions/:id`: Delete subscription.
- `POST /v1/webhook-subscriptions/:id/test`: Trigger a synthetic test ping event.

---

## 7. Inbound Provider Webhooks & Tracking (`/v1/webhooks`, `/v1/t`)

### 7.1 Provider Webhook Ingestion (`POST /v1/webhooks/:provider`)
Ingests delivery receipts, bounces, complaints, and inbound chat messages from 88 upstream providers with automatic cryptographic signature validation.

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

### 7.2 WhatsApp Dedicated Status Update Webhook (`POST /v1/webhooks/whatsapp/status` or `/v1/webhooks/:provider/status`)
Dedicated webhook endpoint for WhatsApp delivery and read receipts (`delivered`, `read`, `failed`). Progresses message attempt timestamps, transitions message state in PostgreSQL, triggers cascade step cancellation, and logs telemetry.

### 7.3 WhatsApp Dedicated Incoming Message Webhook (`POST /v1/webhooks/whatsapp/incoming` or `/v1/webhooks/:provider/incoming`)
Dedicated webhook endpoint for customer-initiated WhatsApp inbound messages.
- **Directly drives the 24-Hour Cost Optimization Engine**: Atomically sets/refreshes the 24-hour service window in Redis (`wa:session:<providerId>:<phone>`).
- Automatically intercepts future outbound messages to send plain-text session messages at **$0.00 Meta template fee** instead of paid templates ($0.015+ saved per message).
- Automatically handles compliance keyword suppressions (`STOP`, `UNSUBSCRIBE`, `START`).
- Dispatches `inbound.message_received` events to customer webhook subscribers.

### 7.4 Meta / WhatsApp Webhook Handshake Verification (`GET /v1/webhooks/:provider*`)
Responds to Meta WhatsApp Cloud API / Facebook Developer verification requests:
- Validates `hub.mode=subscribe` and `hub.verify_token`.
- Returns raw `hub.challenge` string with HTTP `200 OK` (or `403 Forbidden` on invalid tokens).
- Supported on `/v1/webhooks/:provider`, `/v1/webhooks/:provider/status`, and `/v1/webhooks/:provider/incoming`.

### 7.5 Email Open Tracking Pixel (`GET /v1/t/:token`)
Zero-footprint 1x1 transparent GIF endpoint for email open telemetry.
- Returns `image/gif` with `Cache-Control: no-cache, no-store, must-revalidate`.

---

## 8. Admin & Mission Control Endpoints (`/v1/admin`)

These endpoints power the Staff-level React 19 + Base UI Mission Control console and DevOps automation.

### 8.1 Telemetry & Overview
- `GET /v1/admin/overview`: Summary KPIs, 24h volume, delivery rate, channel distribution, and p95 latency sparklines.
- `GET /v1/admin/telemetry/live`: Live telemetry snapshot including V8 heap memory saturation, event-loop lag, and BullMQ queue depths.

### 8.2 Message Explorer & Trace Waterfall
- `GET /v1/admin/messages`: Search and filter messages by channel, status, date range, sandbox mode, and text search.
- `GET /v1/admin/messages/:id`: Message details with full W3C Gantt trace waterfall from HTTP ingestion to provider wire delivery.
- `GET /v1/admin/audit-logs`: Query immutable administrative audit trail logs.

### 8.3 Provider Matrix & Circuit Breaker Cockpit
- `GET /v1/admin/providers`: List all 88 providers with live circuit breaker states (`CLOSED`, `HALF_OPEN`, `OPEN`), failure counts, and latency percentiles.
- `POST /v1/admin/providers/:providerId/circuit`: Manual circuit breaker override.
  ```json
  { "action": "FORCE_HALF_OPEN", "rampPercentage": 20 }
  ```
- `POST /v1/admin/providers/:providerId/canary`: Trigger an on-demand synthetic canary probe against a provider.

### 8.4 DLQ Replay Simulator
- `POST /v1/admin/dlq/replay`: Execute or dry-run DLQ batch replay.
  ```json
  { "dryRun": true }
  ```

### 8.5 Provider Setup & Registration Studio
- `GET /v1/admin/providers/catalog`: Full 88-provider catalog with required env vars, labels, and schemas.
- `GET /v1/admin/providers/configured`: List active configured providers from database and memory.
- `POST /v1/admin/providers/register`: Register or update provider credentials and configuration in PostgreSQL with instant Redis PubSub hot-reloading.
- `DELETE /v1/admin/providers/configured/:id`: Remove configured provider.
- `POST /v1/admin/providers/test-connection`: Validate provider credentials against upstream vendor API.
- `POST /v1/admin/providers/seed-all`: Seed all 88 providers with default test credentials.
- `GET /v1/admin/providers/env-export`: Export sample `.env` formatted variables for all providers.

---

## 9. System Health & Observability Probes

### 9.1 Comprehensive Health Status (`GET /health`)
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

### 9.2 Kubernetes Probes
- **Readiness Probe (`GET /health/readiness`)**: Returns `200 OK` when ready; returns `503 Service Unavailable` during startup or graceful shutdown.
- **Liveness Probe (`GET /health/liveness`)**: Returns `200 OK` while process event loop is responsive.

### 9.3 Prometheus Metrics (`GET /metrics`)
Exposes all system metrics in standard Prometheus text format (`convey_http_requests_total`, `convey_messages_accepted_total`, `convey_whatsapp_session_cost_saved_usd_total`, etc.).

### 9.4 OpenAPI Swagger UI (`GET /swagger`)
Interactive OpenAPI 3.1 documentation and live API playground.

---

## 10. Error Code Taxonomy & HTTP Status Matrix

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
