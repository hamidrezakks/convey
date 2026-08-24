import type { DocSection } from './quickstart';

export const apiReferenceDoc: DocSection = {
  id: 'api-reference',
  title: 'REST API Specification',
  description:
    'Complete OpenAPI 3.1 REST API specification for message ingestion, status telemetry, batch campaigns, DLQ replay, and compliance suppressions.',
  headings: [
    { id: 'auth-headers', title: 'Authentication & Required Headers', level: 2 },
    { id: 'post-messages-send', title: 'POST /v1/messages/send (Single Ingestion)', level: 2 },
    { id: 'post-messages-bulk', title: 'POST /v1/messages/bulk (Batch Ingestion)', level: 2 },
    { id: 'get-message-by-id', title: 'GET /v1/messages/:id (Telemetry & Trace)', level: 2 },
    { id: 'get-messages-list', title: 'GET /v1/messages (Cursor Pagination)', level: 2 },
    { id: 'post-batches', title: 'POST /v1/batches (Campaign Context)', level: 2 },
    { id: 'dlq-apis', title: 'GET & POST /v1/dlq (Dead Letter Queue & Replay)', level: 2 },
    { id: 'suppression-apis', title: 'GET & POST /v1/suppressions (Compliance Lists)', level: 2 },
    { id: 'health-metrics', title: 'GET /health & /metrics (Observability)', level: 2 },
  ],
  content: `
## Authentication & Required Headers

All requests to the Convey REST API must include the following headers:

\`\`\`http
Authorization: Bearer cv_live_9f8a3c1e2b4d5e6f
Content-Type: application/json
Idempotency-Key: <unique_idempotency_lease_key>
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
\`\`\`

| Header | Required | Format / Example | Description |
| :--- | :--- | :--- | :--- |
| **\`Authorization\`** | **Yes** | \`Bearer cv_live_...\` or \`Bearer cv_sandbox_...\` | API key authentication token |
| **\`Content-Type\`** | **Yes** | \`application/json\` | Payload MIME format |
| **\`Idempotency-Key\`**| Optional | \`ord_99218_dispatch_v1\` | Guarantees atomic 1-time send acceptance |
| **\`traceparent\`** | Optional | W3C Standard 55-char string | Distributed trace context propagation |

---

## POST /v1/messages/send (Single Ingestion)

Accepts an omnichannel transactional message for sub-15ms fast-path ingestion.

### Request Body Schema
\`\`\`json
{
  "channel": "sms", // "email" | "sms" | "whatsapp" | "push" | "chat" | "tool"
  "recipient": "+14155552671",
  "priority": "HIGH", // "CRITICAL" | "HIGH" | "DEFAULT" | "LOW"
  "content": {
    "subject": "Security Alert", // Required for email
    "body": "Your authentication security code is 849201. Valid for 10 minutes.",
    "templateId": "otp_sms_v1",
    "templateParams": {
      "code": "849201",
      "expiryMinutes": 10
    }
  },
  "routing": {
    "strategy": "SMART_SCORECARD", // "ROUND_ROBIN" | "PRIMARY_FALLBACK" | "SMART_SCORECARD" | "LEAST_COST"
    "primaryProvider": "twilio",
    "fallbackChain": ["vonage", "infobip", "telnyx"]
  },
  "metadata": {
    "userId": "usr_01JB581XYZ",
    "tenantTier": "ENTERPRISE"
  }
}
\`\`\`

### Response (\`202 Accepted\`)
\`\`\`json
{
  "status": "ACCEPTED",
  "publicId": "msg_01JB61Z89M3V1049AB77",
  "channel": "sms",
  "recipient": "+14155552671",
  "priority": "HIGH",
  "latencyMs": 3.4,
  "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "createdAt": "2026-08-24T16:00:00.000Z"
}
\`\`\`

---

## POST /v1/messages/bulk (Batch Ingestion)

Bulk ingests up to 1,000 messages in a single atomic HTTP request.

### Request Body Schema
\`\`\`json
{
  "messages": [
    {
      "channel": "email",
      "recipient": "alex.chen@enterprise.com",
      "priority": "DEFAULT",
      "content": {
        "subject": "Monthly Statement Available",
        "body": "Hi Alex, your statement for August 2026 is ready."
      }
    },
    {
      "channel": "email",
      "recipient": "sarah.connor@cyberdyne.io",
      "priority": "DEFAULT",
      "content": {
        "subject": "Monthly Statement Available",
        "body": "Hi Sarah, your statement for August 2026 is ready."
      }
    }
  ]
}
\`\`\`

### Response (\`202 Accepted\`)
\`\`\`json
{
  "acceptedCount": 2,
  "failedCount": 0,
  "publicIds": [
    "msg_01JB61Z89M3V1049AB78",
    "msg_01JB61Z89M3V1049AB79"
  ],
  "batchLatencyMs": 8.2
}
\`\`\`

---

## GET /v1/messages/:id (Telemetry & Trace)

Retrieves full delivery telemetry, audit history, and W3C trace waterfall spans for a given message.

### Request
\`\`\`bash
curl -X GET https://api.convey.internal/v1/messages/msg_01JB61Z89M3V1049AB77 \
  -H "Authorization: Bearer cv_live_9f8a3c1e2b4d5e6f"
\`\`\`

### Response (\`200 OK\`)
\`\`\`json
{
  "publicId": "msg_01JB61Z89M3V1049AB77",
  "channel": "sms",
  "recipient": "+14155552671",
  "status": "DELIVERED",
  "priority": "HIGH",
  "providerId": "twilio",
  "latencyMs": 142.5,
  "costUsd": 0.0075,
  "createdAt": "2026-08-24T16:00:00.000Z",
  "deliveredAt": "2026-08-24T16:00:00.142Z",
  "traceSpans": [
    {
      "id": "span_01",
      "name": "HTTP Ingestion (Elysia.js)",
      "serviceName": "api-gateway",
      "startTimeMs": 0,
      "durationMs": 3.4,
      "status": "OK"
    },
    {
      "id": "span_02",
      "name": "Postgres Outbox Commit",
      "serviceName": "database",
      "startTimeMs": 1.2,
      "durationMs": 2.1,
      "status": "OK"
    },
    {
      "id": "span_03",
      "name": "BullMQ Outbox Relay Shard 7",
      "serviceName": "outbox-worker",
      "startTimeMs": 15.0,
      "durationMs": 4.5,
      "status": "OK"
    },
    {
      "id": "span_04",
      "name": "Twilio Provider HTTP Wire Dispatch",
      "serviceName": "provider-dispatcher",
      "startTimeMs": 22.0,
      "durationMs": 120.5,
      "status": "OK"
    }
  ]
}
\`\`\`

---

## GET & POST /v1/dlq (Dead Letter Queue & Replay)

### Replaying Dead-Letter Messages with Blast-Radius Control
\`\`\`json
{
  "filter": {
    "failureCategory": "RATE_LIMIT_429",
    "providerId": "sendgrid",
    "startDate": "2026-08-24T00:00:00.000Z"
  },
  "mutation": {
    "overrideProviderId": "aws-ses",
    "rateLimitPerSec": 50
  }
}
\`\`\`
`,
};
