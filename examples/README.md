# Convey API Examples & Use Cases Guide

Welcome to the **Convey Communication Service Examples** guide. This repository contains complete, production-ready `curl` requests, detailed JSON response payloads, technical workflow explanations, and edge-case examples for using Convey.

Convey is a high-performance, resilient, multi-tenant communication service built with **Bun**, **Elysia**, **Drizzle ORM**, **PostgreSQL**, and **BullMQ**. It powers planetary-scale email, SMS, WhatsApp, Push (FCM/APNs), Telegram, and Slack messaging with automatic provider failover, 1-RTT idempotency guarantees, zero-cost WhatsApp session optimization, micro-batch ingestion, and partitioned message auditing.

---

## 🛠 Prerequisites & Authentication

### Base URL
By default, the Convey HTTP service runs on port `3000`:
```bash
http://localhost:3000
```

### Authentication Headers
Convey supports two standard authentication mechanisms:
1. **Bearer Token Header**:
   ```http
   Authorization: Bearer <YOUR_API_KEY>
   ```
2. **API Key Header**:
   ```http
   x-api-key: <YOUR_API_KEY>
   ```

> **Note**: In development/testing environments when `CONVEY_REQUIRE_AUTH` is set to `false`, unauthenticated requests fallback to tenant `default-tenant` and team `default-team`.

### Sandbox (Test) Mode
To dispatch messages in **Sandbox Mode** (simulated delivery without invoking real downstream providers like Twilio, SendGrid, or Cequens):
- Pass an API key prefixed with `sk_test_` (e.g., `Authorization: Bearer sk_test_12345`), OR
- Pass the header `x-convey-sandbox: true`:
```http
x-convey-sandbox: true
```

### W3C Distributed Tracing
Convey natively supports W3C `traceparent` context propagation across HTTP requests, Outbox processing, BullMQ jobs, provider dispatches, and webhook receipts:
```http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

---

## 📁 Examples Directory Map

Explore the examples organized by topic:

| Directory / Module | Description | Key Features & Endpoints |
| :--- | :--- | :--- |
| [**`01-single-messages/`**](./01-single-messages/) | Single message dispatches across all channels | Email (HTML/Text/Render), SMS OTP, WhatsApp (Session/Template), Push (FCM/APNs), Slack, Telegram |
| [**`02-advanced-routing/`**](./02-advanced-routing/) | Smart delivery, failovers, and test modes | Multi-channel fallback chains, scheduled dispatches (<30m vs >30m), 1-RTT Redis idempotency, sandbox mode |
| [**`03-bulk-and-batches/`**](./03-bulk-and-batches/) | High-throughput batch dispatches | Micro-batching (`/v1/messages/bulk`), Batch lifecycle management (`/v1/batches`), pause, resume, cancel |
| [**`04-status-timeline-and-dlq/`**](./04-status-timeline-and-dlq/) | Message auditing & dead-letter queue | Status query (`/v1/messages/:id`), full event timeline audit (`/timeline`), DLQ listing & instant replay (`/v1/dlq`) |
| [**`05-suppressions-and-webhooks/`**](./05-suppressions-and-webhooks/) | Compliance, webhooks, and receipts | Compliance suppression lists (`/v1/suppressions`), outgoing webhooks (`/v1/webhook-subscriptions`), open tracking, client receipts |
| [**`06-health-and-observability/`**](./06-health-and-observability/) | Operational monitoring | Health checks (`/health`, `/health/readiness`, `/health/liveness`), circuit breaker status, Prometheus metrics (`/metrics`) |

---

## ⚡ Quick Test Command

Verify your local Convey instance is running:

```bash
curl -i -X GET http://localhost:3000/health/readiness
```

**Expected Response (`200 OK`)**:
```json
{
  "ready": true,
  "uptime": 124.52,
  "checks": {
    "db": "connected",
    "redis": "connected",
    "partitions": { "checkedAt": "2026-08-13T18:00:00.000Z", "valid": true }
  },
  "circuitBreakers": {
    "counts": { "closed": 5, "open": 0, "halfOpen": 0 },
    "statuses": []
  },
  "providers": {
    "configuredCount": 5,
    "byChannel": {
      "email": 2,
      "sms": 1,
      "whatsapp": 1,
      "telegram": 1
    }
  },
  "workers": { "active": true, "count": 6 },
  "timestamp": "2026-08-13T18:25:00.000Z"
}
```
