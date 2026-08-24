import type { DocSection } from './quickstart';

export const architectureDoc: DocSection = {
  id: 'architecture',
  title: 'Architecture & Core Guarantees',
  description:
    'Deep-dive into Convey’s distributed systems engineering, transactional outbox pattern, monthly range partitioning, zero-trust encryption, and multi-tenant DRR scheduler.',
  headings: [
    { id: 'system-topology', title: 'System Topology & Core Dataflow', level: 2 },
    { id: 'transactional-outbox', title: '1. Transactional Outbox Pattern', level: 2 },
    { id: 'range-partitioning', title: '2. Monthly PostgreSQL Range Partitioning', level: 2 },
    { id: 'zero-leakage', title: '3. Zero Provider ID & PII Leakage', level: 2 },
    { id: 'zero-trust-encryption', title: '4. Zero-Trust AES-256-GCM Envelope Encryption', level: 2 },
    { id: 'drr-scheduler', title: '5. Deficit Round Robin (DRR) Multi-Tenant Scheduler', level: 2 },
    { id: 'circuit-breakers', title: '6. Stepped Half-Open Circuit Breakers & Hedging', level: 2 },
    { id: 'whatsapp-autopilot', title: '7. Autonomous WhatsApp 24h Session Optimization', level: 2 },
    { id: 'distributed-tracing', title: '8. W3C Distributed Tracing', level: 2 },
  ],
  content: `
## System Topology & Core Dataflow

Convey is architected from first principles to decouple synchronous client message ingestion from asynchronous provider delivery:

\`\`\`text
Client Application (traceparent)
       │
       ▼ [1. Synchronous Hot-Path Ingestion < 15ms]
Elysia.js Gateway (1-RTT Redis SET NX Idempotency + DLP Redaction)
       │
       ▼ [Single PostgreSQL ACID Transaction]
INSERT INTO messages (AES-256-GCM) ──► INSERT INTO outbox (Status: PENDING)
       │
       ▼ [2. Asynchronous Outbox Relay]
SIMD Murmur32v3 Virtual Shard Poller (FOR UPDATE SKIP LOCKED)
       │
       ▼ [3. BullMQ Distributed Queue]
Deficit Round Robin (DRR) Quantum Fair Scheduler
       │
       ▼ [4. Provider Execution Engine]
Hedged Speculative Dispatch + Stepped Half-Open Circuit Breaker (5% -> 20% -> 50% -> 100%)
       │
       ▼ [5. Delivery Wire]
Twilio / SendGrid / AWS SES / Meta WhatsApp / FCM / APNs / Slack
\`\`\`

---

## 1. Transactional Outbox Pattern

In high-scale messaging architectures, the **dual-write problem** (writing to a database and publishing to a message broker simultaneously) creates race conditions and message loss during process crashes.

Convey eliminates dual writes by executing **1 ACID database transaction** per message ingestion:
1. \`INSERT INTO messages\`: Stores the immutable record with field-level encryption.
2. \`INSERT INTO outbox\`: Enqueues an outbox row with \`status = 'PENDING'\` and the virtual shard index.

The **Outbox Relay Worker** polls the \`outbox\` table using:
\`\`\`sql
SELECT * FROM outbox 
WHERE shard_id = $1 AND status = 'PENDING'
ORDER BY created_at ASC 
LIMIT 100 
FOR UPDATE SKIP LOCKED;
\`\`\`

### Key Benefits
- **Zero Message Loss**: Even if the API server crashes immediately after returning \`202 ACCEPTED\`, the message is committed in the outbox ledger.
- **Lock-Free Concurrency**: \`FOR UPDATE SKIP LOCKED\` allows dozens of worker threads to process outbox records simultaneously without row-lock contention.

---

## 2. Monthly PostgreSQL Range Partitioning

As message volumes scale to millions of rows per day, unpartitioned PostgreSQL tables suffer from B-Tree index bloat and expensive vacuuming cycles.

Convey partitions all high-volume tables (\`messages\`, \`outbox\`, \`message_attempts\`, \`message_events\`, \`budget_ledger\`) by month:

\`\`\`sql
CREATE TABLE messages (
    id UUID NOT NULL,
    public_id VARCHAR(32) NOT NULL,
    team_id UUID NOT NULL,
    channel VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly partition instance
CREATE TABLE messages_y2026m08 PARTITION OF messages
    FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');
\`\`\`

### Automated Partition Pruning
Convey encodes the timestamp in opaque public ULIDs (\`msg_<ULID>\`). When querying by ID, Convey extracts the creation timestamp and injects strict partition bounds (\`gte(createdAt, windowStart)\`, \`lte(createdAt, windowEnd)\`), enabling PostgreSQL to perform instantaneous **partition pruning** and eliminate full-table scans.

---

## 3. Zero Provider ID & PII Leakage

Exposing upstream vendor IDs (e.g. Twilio \`SM_...\` or SendGrid \`sg_...\`) creates tight coupling and security risks for client applications.

Convey enforces a strict **Zero-Leak Boundary**:
- All public identifiers are opaque 128-bit ULIDs prefixed with entity types: \`msg_01JB61Z89M3V1049AB77\`, \`batch_01JB62...\`, \`sup_01JB63...\`.
- Internal database UUIDs and vendor-specific wire IDs are never exposed in public JSON response schemas.

---

## 4. Zero-Trust AES-256-GCM Envelope Encryption

Recipient contact handles (phone numbers, email addresses) and message content are sensitive PII.

Convey applies field-level **AES-256-GCM envelope encryption** before persisting to PostgreSQL:
- A unique 96-bit Initialization Vector (IV) and 128-bit authentication tag are generated per message.
- Sensitive fields (\`recipient\`, \`body\`, \`templateParams\`) are packed into an encrypted envelope:
\`\`\`json
{
  "_encryptedEnvelope": {
    "ciphertext": "8f3b2a1c...",
    "iv": "9d4e5f...",
    "tag": "1a2b3c...",
    "keyVersion": 1
  }
}
\`\`\`
- Decryption occurs strictly in-memory inside the isolated BullMQ provider dispatch worker just prior to wire transmission.

---

## 5. Deficit Round Robin (DRR) Multi-Tenant Scheduler

In shared multi-tenant environments, a Free tier tenant blasting millions of marketing notifications must never starve critical Enterprise OTP messages.

Convey implements a **Deficit Weighted Round Robin (DRR)** scheduler in BullMQ:
- **Enterprise Tier**: Quantum = 200 (Highest priority allocation)
- **Pro Tier**: Quantum = 50
- **Free Tier**: Quantum = 10

$$\\text{Deficit}_i = \\text{Deficit}_i + \\text{Quantum}_i$$

Convey guarantees a **Jain's Fairness Index** $JFI \\ge 0.95$ under 100x traffic skew:
$$J(x_1, x_2, \\dots, x_n) = \\frac{\\left( \\sum_{i=1}^n x_i \\right)^2}{n \\sum_{i=1}^n x_i^2}$$

---

## 6. Stepped Half-Open Circuit Breakers & Hedging

When downstream providers (e.g. SendGrid or Twilio) degrade, failing fast prevents thread pool exhaustion.

### Stepped Probe Admission
When a circuit breaker enters the \`HALF_OPEN\` state, Convey ramps probe traffic in calibrated steps:
$$\\\\text{Traffic Admission: } 5\\\\% \\\\longrightarrow 20\\\\% \\\\longrightarrow 50\\\\% \\\\longrightarrow 100\\\\%$$

If error rates exceed 10% during any step, the circuit trips back to \`OPEN\` immediately, preserving cluster stability.

### Dynamic Hedged Parallel Requests
For critical SLA messages, if a primary provider request does not acknowledge within the p95 latency window ($T_{hedge} = 250\\\\text{ms}$), Convey speculatively fires a concurrent hedged request to a secondary fallback provider. The first response cancels the pending sibling.

---

## 7. Autonomous WhatsApp 24h Session Optimization

Meta charges significant per-message template fees ($0.03 to $0.08) for business-initiated WhatsApp messages. However, when a customer replies or initiates contact, a **24-hour free customer service window** opens, allowing $0.00 plain text messages.

Convey’s **WhatsApp Session Autopilot**:
1. Monitors inbound customer webhooks to record the timestamp of customer interaction in Redis.
2. When an outbound template message is dispatched, Convey checks if the recipient's 24-hour window is active.
3. If active, Convey **automatically compiles the template variables into a plain-text message** and sends it via the standard session endpoint at **$0.00 fee**!
4. If expired, Convey seamlessly falls back to the approved Meta HSM template.

---

## 8. W3C Distributed Tracing

Every request ingested by Convey extracts or initializes a standard **W3C TraceContext** (\`traceparent\`):

\`\`\`text
version-traceid-parentid-traceflags
00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
\`\`\`

The trace context is propagated across:
- Ingestion HTTP middleware
- PostgreSQL outbox record
- BullMQ queue job payload
- Provider wire headers
- Outgoing webhook delivery receipts

This allows end-to-end distributed tracing in Datadog, Jaeger, OpenTelemetry, and Convey’s **Trace Waterfall Gantt visualizer**.
`,
};
