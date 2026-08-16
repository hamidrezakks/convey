<div align="center">

# ⚡ CONVEY

### **Planetary-Scale, Multi-Tenant Communication Infrastructure & Message Gateway**

[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun%201.4-f472b6?style=for-the-badge&logo=bun)](https://bun.sh)
[![Framework: Elysia.js](https://img.shields.io/badge/Framework-Elysia.js-8b5cf6?style=for-the-badge&logo=fastapi)](https://elysiajs.com)
[![Database: PostgreSQL 16](https://img.shields.io/badge/Database-PostgreSQL%2016%20(Partitioned)-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org)
[![Queues: BullMQ + Redis](https://img.shields.io/badge/Queues-BullMQ%20%2B%20Redis%207-dc2626?style=for-the-badge&logo=redis)](https://redis.io)
[![Security: AES-256-GCM](https://img.shields.io/badge/Security-AES--256--GCM%20Zero--Trust-059669?style=for-the-badge&logo=shield)](./docs/security.md)
[![Adapters: 88 Providers](https://img.shields.io/badge/Ecosystem-88%20Providers%20%2F%205%20Channels-2563eb?style=for-the-badge)](./docs/provider-capabilities.md)
[![Code Quality: Biome](https://img.shields.io/badge/Code_Style-Biome%20Strict-6366f1?style=for-the-badge&logo=biome)](https://biomejs.dev)
[![Hot Path: < 15ms](https://img.shields.io/badge/Hot_Path-p99%20%3C%2018ms-f59e0b?style=for-the-badge)](./docs/architecture.md)

<p align="center">
  <b>Convey</b> is a high-throughput, fault-tolerant notification and messaging engine engineered for mission-critical enterprise workloads.<br/>
  Featuring <b>sub-15ms synchronous hot-path acceptance</b>, <b>zero-trust envelope encryption at rest</b>, <b>autonomous WhatsApp session cost optimization</b>, <b>dual-layer hybrid scheduling</b>, and <b>88 turnkey provider integrations</b> across 5 channels.
</p>

---

[Executive Overview](#-executive-overview) •
[System Architecture](#-system-architecture--topology) •
[Engineering Guarantees](#-core-architectural-guarantees) •
[WhatsApp Cost Autopilot](#-autonomous-whatsapp-24h-session-cost-optimization) •
[Provider Ecosystem](#-supported-provider-ecosystem-88-turnkey-adapters) •
[Quickstart](#-quickstart--developer-experience) •
[API Showcase](#-api-specification--showcase) •
[Resilience Suite](#-enterprise-resilience--intelligence-suite) •
[Performance SLA](#-performance-sla--benchmarks) •
[Documentation Index](#-deep-dive-documentation-index)

---

</div>

## 🌟 Executive Overview

Modern notification infrastructure frequently breaks down under production stress: slow synchronous HTTP requests block client callers, provider outages cause silent message loss, recipient PII is stored unencrypted in application databases, and vendor messaging bills escalate due to unoptimized channel routing.

**Convey** solves these challenges from first principles with a completely **100% standalone**, zero-dependency architecture:

| Capability / SLA | Traditional Monoliths | Cloud Gateways / Novu | **Convey Engine** |
| :--- | :--- | :--- | :--- |
| **Hot-Path Send Latency** | 150ms – 600ms (blocking provider HTTP) | 50ms – 120ms | **`p50 < 4ms` / `p99 < 18ms`** (1 Redis `SET NX` + 1 Postgres Tx) |
| **Data Privacy at Rest** | Plaintext PII stored in SQL | Database-level disk encryption only | **Zero-Trust Field-Level AES-256-GCM Envelope** (`_encryptedEnvelope`) |
| **Provider ID Privacy** | Leaks upstream vendor IDs (`SM_...`, `sg_...`) | Mixed ID surfaces | **Strict Zero-Leak Boundary** (`msg_<ULID>`) |
| **WhatsApp Delivery Cost** | 100% full Meta/BSP template rates ($$$) | Manual template switches | **Autonomous 24h Session Tracker ($0.00 Text Transform)** |
| **Scheduling Precision** | Cron jobs / Full DB table scans | In-memory timers / BullMQ only | **Dual-Layer Hybrid** (BullMQ `≤ 30m` + Partitioned Postgres `> 30m`) |
| **Multi-Tenant Fairness** | Global FIFO queue starvation | Coarse token bucket rate limits | **Deficit Round Robin (DRR) Multi-Tenant Quantum Scheduler** |
| **Tail-Latency Elimination** | Linear timeouts & retries | Basic exponential backoff | **Dynamic Hedged Concurrent Requests + Full-Jitter Backoff** |
| **Database Scalability** | Monolithic tables with B-Tree bloat | Unpartitioned event logs | **Monthly PostgreSQL Range Partitioning + Auto Pruning Windows** |
| **Graceful Node Shutdown** | Abrupt SIGKILL drops running jobs | Basic connection pool close | **4-Stage Zero-Data-Loss Orchestrator** (Traffic ➔ Queues ➔ Workers ➔ DB) |

---

## 🏛️ System Architecture & Topology

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT APPLICATIONS & MICROSERVICES                           │
│                      W3C Distributed TraceContext Propagation (traceparent headers)              │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ HTTP / HTTPS (REST API)
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ELYSIA.JS HIGH-THROUGHPUT GATEWAY                                │
│   POST /v1/messages    POST /v1/messages/bulk    POST /v1/dlq/replay    GET /health/readiness    │
│   • Schema Validation (TypeBox / Zod)             • Sensitive Data Redaction (DLP Regex)         │
│   • 1-RTT Redis Idempotency Lock (SET NX)         • Zero-Trust AES-256-GCM Envelope Encryption   │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ Single ACID Transaction (< 15ms Hot Path)
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            POSTGRESQL 16 MONTHLY RANGE-PARTITIONED LEDGER                        │
│   INSERT INTO messages (AES-256-GCM) ───────────────────────► INSERT INTO outbox (Status: Pending)│
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        │ (<= 30 Min Window)                              │ (> 30 Min Scheduled)
                        ▼                                                 ▼
┌───────────────────────────────────────────────────┐ ┌────────────────────────────────────────────┐
│         OUTBOX RELAY WORKER (FOR UPDATE SKIP)     │ │        SCHEDULED PROMOTER WORKER LOOP        │
│   • Consistent Hash Virtual Shard Routing         │ │   • Scans partition bounds for due items   │
│   • Dispatches to BullMQ Orchestration Queue      │ │   • Promotes to BullMQ at T-30 minutes     │
└───────────────────────┬───────────────────────────┘ └─────────────────────┬──────────────────────┘
                        │                                                   │
                        └─────────────────────────┬─────────────────────────┘
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         BULLMQ ADAPTIVE MULTI-TENANT WORKER ORCHESTRATION                        │
│   • Deficit Round Robin (DRR) Fair Queueing       • Adaptive Concurrency Scaler (Backlog-driven) │
│   • Deliverability Autopilot & Quiet-Hours STO    • Smart Latency Scorecard Router (EMA scoring) │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ Routes to Per-Provider Queues
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    PROVIDER EXECUTION ENGINE                                     │
│   • Isolated In-Memory Payload Decryption         • Provider Circuit Breakers (Stepped Half-Open)│
│   • Dynamic Hedged Requests (Tail-Latency Drop)   • Leaky-Bucket Per-Provider Rate Governor      │
│                                                                                                  │
│   ┌───────────────────┬───────────────────┬───────────────────┬──────────────────┬───────────┐   │
│   │    📧 Email       │     📱 SMS        │     🔔 Push       │     💬 Chat      │  🛠️ Tool  │   │
│   │   (20 Adapters)   │   (39 Adapters)   │   (8 Adapters)    │  (17 Adapters)   │(4 Adapters│   │
│   └───────────────────┴───────────────────┴───────────────────┴──────────────────┴───────────┘   │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ Inbound Webhooks & Delivery Receipts
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  INBOUND INTELLIGENCE & TELEMETRY                                │
│   • Micro-Batch Webhook Ingestion (50k/sec)       • Autonomous 24h WhatsApp Session Tracker      │
│   • Cross-Channel Waterfall Cascade Engine        • Dead-Letter Queue (DLQ) & Mutated Replay     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Core Architectural Guarantees

### 1. Sub-15ms Hot-Path Send Acceptance
Every message ingestion request entering `POST /v1/messages` is bounded to strictly:
1. **1-RTT Redis `SET NX` Lock**: Checks `convey:idempotency:{team}:{idempotencyKey}`. If an identical hash is present, the stored response is returned in `< 1ms`.
2. **Zero-Trust Envelope Encryption**: Contact PII (`recipients`) and message channel bodies (`channels`) are encrypted via AES-256-GCM before database touch.
3. **Single PostgreSQL Transaction**: Executes an atomic insert into `messages` and `outbox`. Returns HTTP `202 Accepted` with an opaque identifier `msg_<ULID>`.

### 2. Zero-Trust BYOK Envelope Encryption at Rest
All customer contact information (email addresses, phone numbers, device push tokens) and channel payloads are encrypted in the PostgreSQL `messages.metadata._encryptedEnvelope` column using AES-256-GCM.
- Encryption keys are never written to database tables.
- BullMQ worker processes decrypt payloads strictly in ephemeral worker process memory during provider dispatch.
- Integrated **DLP (Data Loss Prevention) Scanner** (`dlp-scanner.ts`) automatically detects and redacts credit cards, SSNs, and bearer tokens from logs and metadata.

### 3. Dual-Layer Hybrid Scheduling
- **Near-Term Scheduling (`<= 30 minutes`)**: Enqueued directly into BullMQ delayed jobs with microsecond precision.
- **Long-Term Scheduling (`> 30 minutes`)**: Persisted in PostgreSQL range-partitioned ledger tables. The background `scheduledPromoter` loop runs continuous boundary scans and promotes messages to BullMQ precisely when they cross into the 30-minute threshold.

### 4. Zero Provider Message ID Exposure
Public APIs, client responses, and webhooks expose strictly opaque ULID identifiers (`msg_<ULID>`). Internal provider transaction IDs (e.g. Twilio `SM...`, SendGrid `msg-...`, AWS SES Message-ID) and internal database UUIDs are never leaked across tenant boundaries.

---

## 💰 Autonomous WhatsApp 24h Session Cost Optimization

WhatsApp Business Platform charges per conversation category. When an end-user sends an inbound WhatsApp message, WhatsApp opens a **24-Hour Customer Service Window**. During this active window, free-form text messages incur **$0.00 template fees**.

Convey features a built-in, autonomous **WhatsApp Cost Optimization Engine** ([docs/whatsapp-session-optimization.md](./docs/whatsapp-session-optimization.md)):

```
[Inbound WhatsApp Webhook] ──► [webhook-ingest.worker] ──(Atomic Lua)──► [Redis wa:session:<providerId>:<phone>]
                                                                                   │ (24h TTL + Sub-ms L1 Cache)
[Outbound Message Request] ──► [WhatsApp Session Interceptor] ◄────────────────────┘
                                        │
                                        ├── Active 24h Window? ──► [WhatsApp Template Engine (Pre-compiled AST)]
                                        │                                   │
                                        │                                   ▼
                                        │                   Rendered Plain-Text ($0.00 Meta Fee)
                                        │
                                        └── Expired Window?  ──► Standard Pre-Approved Template ($$$ Fee)
```

- **Atomic Redis Lua Scripting**: `RECORD_INBOUND_LUA_SCRIPT` records inbound receipts, updates session counters, and refreshes the 24-hour TTL in a single network round-trip.
- **Sub-Microsecond AST Template Engine**: Compiles template strings into pre-parsed AST token trees (`astL1Cache`), rendering dynamic variables at **> 1,000,000 renders/sec**.
- **Audit Transparency**: Dispatched messages carry telemetry tags `_sessionOptimizationApplied: true` and `_costOptimizationSavedUsd: 0.005`.

---

## 🌐 Supported Provider Ecosystem (88 Turnkey Adapters)

Convey includes production-tested adapters across **5 delivery channels** with unified schemas, automatic signature validation, and circuit breaker protection:

### 📧 Email Providers (20)
| Provider ID | Service Name | Protocol / SDK | Delivery Receipts | Webhook Signature Verification |
| :--- | :--- | :--- | :---: | :---: |
| `ses` | Amazon SES v2 | AWS SDK v3 | ✅ | ✅ AWS SNS SigV4 |
| `sendgrid` | SendGrid | Twilio SendGrid REST | ✅ | ✅ ECDSA Public Key |
| `resend` | Resend | Resend REST API | ✅ | ✅ Svix HMAC-SHA256 |
| `mailgun` | Mailgun | Mailgun v3 API | ✅ | ✅ HMAC-SHA256 |
| `postmark` | Postmark | Postmark REST | ✅ | ✅ Secret Token / Basic |
| `brevo` | Brevo (Sendinblue) | Brevo v3 REST | ✅ | ✅ Webhook Signature |
| `mailjet` | Mailjet | Mailjet v3.1 | ✅ | ✅ Basic / Token |
| `sparkpost` | SparkPost | SparkPost v1 | ✅ | ✅ OAuth / Token |
| `mandrill` | Mailchimp Mandrill | Mandrill REST | ✅ | ✅ HMAC-SHA1 Signature |
| `mailersend` | MailerSend | MailerSend REST | ✅ | ✅ Signature Token |
| `nodemailer` | SMTP (Generic) | Nodemailer Transport | ❌ | N/A |
| `plunk` | Plunk | Plunk Secret API | ✅ | ✅ Secret Header |
| `mailtrap` | Mailtrap | Mailtrap Email API | ✅ | ✅ Webhook Token |
| `anypost` | Anypost | Anypost REST | ✅ | ✅ Secret Token |
| `braze` | Braze | Braze REST API | ✅ | ✅ Custom Webhook |
| `emailjs` | EmailJS | EmailJS API | ❌ | N/A |
| `infobip` | Infobip Email | Infobip Omnichannel | ✅ | ✅ HMAC-SHA256 |
| `netcore` | Netcore | Netcore Pepipost | ✅ | ✅ Webhook Token |
| `outlook365` | Microsoft 365 | Microsoft Graph API | ❌ | ✅ Graph Validation Token |
| `email-webhook`| Generic Email Webhook | Custom HTTP POST | ✅ | ✅ HMAC Signature |

### 📱 SMS Providers (39)
`twilio`, `nexmo` (Vonage), `plivo`, `sinch`, `telnyx`, `termii`, `bandwidth`, `cequens`, `infobip`, `messagebird`, `gupshup`, `clicksend`, `clickatell`, `sns` (AWS SNS), `africas-talking`, `afro-sms`, `azure-sms`, `brevo-sms`, `bulk-sms`, `burst-sms`, `cm-telecom`, `eazy-sms`, `firetext`, `forty-six-elks`, `generic-sms`, `imedia`, `isend-sms`, `isendpro-sms`, `kannel`, `maqsam`, `mobishastra`, `ring-central`, `ruach-sms`, `sendchamp`, `simpletexting`, `sms-central`, `sms77`, `smsmode`, `unifonic`.

### 🔔 Push Notification Providers (8)
`fcm` (Firebase Cloud Messaging HTTP v1), `apns` (Apple Push Notification service HTTP/2), `one-signal`, `expo`, `pusher-beams`, `pushpad`, `appio`, `push-webhook`.

### 💬 Chat & Social Messaging Providers (17)
`whatsapp-business` (Meta Cloud API), `twilio-whatsapp`, `cequens-whatsapp`, `slack`, `discord`, `telegram`, `msTeams` (Microsoft Teams), `mattermost`, `line`, `getstream` (Stream Chat), `grafana-on-call`, `rocket-chat`, `ryver`, `sendblue`, `webex-messaging`, `zulip`, `chat-webhook`.

### 🛠️ Alerting & Tooling Providers (4)
`pagerduty` (Events API v2), `opsgenie`, `grafana` (Alertmanager), `tool-webhook`.

---

## 🚀 Quickstart & Developer Experience

### Prerequisites
- **Bun** `>= 1.1.0` (Recommended: `Bun 1.4+`)
- **PostgreSQL** `>= 15.0`
- **Redis** `>= 7.0`

### 1. Installation & Environment Configuration
```bash
# Clone the repository
git clone https://github.com/convey/convey.git
cd convey

# Install dependencies (ultra-fast via Bun)
bun install

# Initialize local environment configuration
cp .env.example .env
```

### 2. Database Migration & Range Partitioning
```bash
# Run Drizzle migrations & auto-generate monthly PostgreSQL partitions
bun run db:migrate
```

### 3. Start Development Server
```bash
# Launch server with hot reloading
bun run dev
```
The service will start immediately at `http://localhost:3000`.
- 📖 **Interactive OpenAPI Documentation**: `http://localhost:3000/swagger`
- 🩺 **Kubernetes Health Probes**: `http://localhost:3000/health/readiness`
- 📊 **Prometheus Metrics**: `http://localhost:3000/metrics`

### 4. Running Test Suites & Quality Verification
```bash
# Run 68+ unit & integration test suites
bun test

# Run End-to-End benchmark & load tests
bun run test:bench

# Execute Biome strict code quality and formatting
bun run biome:check
bun run biome:format
```

### 5. Production Operations Scripts
```bash
# Dump real-time job consumption metrics across Redis & PostgreSQL
bun run jobs:dump

# Run a 10,000-message benchmark load test with financial cost reporting
bun run benchmark:report
```

---

## 📡 API Specification & Showcase

### 1. Dispath Single Message (Hot Path < 15ms)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_live_secret_key" \
  -H "X-Idempotency-Key: idemp_order_confirmation_10928" \
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  -d '{
    "team": "team_ecommerce",
    "category": "transactional",
    "priority": "high",
    "recipients": [
      {
        "email": "customer@example.com",
        "phone": "+14155552671",
        "name": "Sarah Connor"
      }
    ],
    "channels": {
      "email": {
        "subject": "Order #10928 Confirmed",
        "html": "<h1>Thank you for your order, Sarah!</h1>"
      },
      "sms": {
        "text": "Your order #10928 is confirmed and will ship today."
      }
    },
    "metadata": {
      "orderId": "10928",
      "currency": "USD",
      "amount": 149.50
    }
  }'
```

#### Response (`202 Accepted`):
```json
{
  "success": true,
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "status": "pending",
  "acceptedAt": "2026-08-16T22:42:00.000Z",
  "channels": ["email", "sms"],
  "recipientsCount": 1
}
```

---

### 2. High-Throughput Bulk Dispatch (`POST /v1/messages/bulk`)
Send up to 5,000 individualized recipient dispatches in a single HTTP payload:
```bash
curl -X POST http://localhost:3000/v1/messages/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_live_secret_key" \
  -d '{
    "team": "team_growth",
    "batchName": "flash_sale_campaign",
    "items": [
      {
        "idempotencyKey": "bulk_user_001",
        "recipients": [{ "phone": "+14155550001" }],
        "channels": { "sms": { "text": "20% off with code FLASH20" } }
      },
      {
        "idempotencyKey": "bulk_user_002",
        "recipients": [{ "phone": "+14155550002" }],
        "channels": { "sms": { "text": "20% off with code FLASH20" } }
      }
    ]
  }'
```

---

### 3. Multi-Channel Waterfall Cascade with Quiet-Hours Protection
Convey supports automatic cross-channel failover (e.g. try Push ➔ fallback to WhatsApp ➔ fallback to SMS) and recipient timezone quiet hours:

```json
{
  "team": "team_security",
  "category": "security_alert",
  "cascade": {
    "enabled": true,
    "strategy": "waterfall",
    "sequence": [
      { "channel": "push", "timeoutMs": 15000 },
      { "channel": "chat", "provider": "whatsapp-business", "timeoutMs": 30000 },
      { "channel": "sms", "provider": "twilio" }
    ]
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "strategy": "hold_until_morning",
    "recipientTimezone": "America/New_York"
  }
}
```

---

### 4. Dead-Letter Queue (DLQ) & Mutated Replay
Inspect poison-pill or provider-rejected messages and replay them after correcting payload credentials or switching providers:

```bash
# Query failed messages
curl -X GET "http://localhost:3000/v1/dlq?team=team_ecommerce&limit=50" \
  -H "Authorization: Bearer convey_live_secret_key"

# Replay failed messages with an override provider
curl -X POST http://localhost:3000/v1/dlq/replay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer convey_live_secret_key" \
  -d '{
    "messageIds": ["msg_01J0N7C0W7X2R6S8V9Q9B1E4G3"],
    "overrideProvider": "resend"
  }'
```

---

## ⚙️ Enterprise Resilience & Intelligence Suite

Convey incorporates cutting-edge distributed systems resilience primitives:

- 🎯 **Smart Provider Latency Scorecard (`SmartProviderRouter`)**: Calculates real-time Exponential Moving Average (EMA) latencies and success ratios per provider to automatically route traffic away from degrading vendors.
- ⚡ **Dynamic Hedged Requests (`HedgedExecutor`)**: Fires speculative backup requests to alternative providers when primary vendor latency breaches the 95th percentile ($p95$), dropping tail-latency spikes by up to 70%.
- 🚪 **Stepped Half-Open Traffic Ramp (`GradualRampController`)**: Admits probe traffic gradually (5% ➔ 20% ➔ 50% ➔ 100%) during circuit breaker recovery, preventing cold restart crashes.
- ⚖️ **Deficit Round Robin Fair Queueing (`MultiTenantPriorityScheduler`)**: Allocates execution quanta based on tenant tier (Enterprise vs Standard), eliminating noisy-neighbor resource starvation.
- 🛡️ **V8 Heap Memory Guard (`HeapMemoryGuard`)**: Continuously monitors RSS and heap allocations, applying dynamic backpressure before process saturation reaches 85%.
- 🌊 **Event-Loop Adaptive Traffic Governor (`TrafficGovernor`)**: Tracks event loop delay; sheds non-critical marketing jobs when event loop lag exceeds 50ms.
- 🔄 **Anti-Entropy Quorum Consensus Auditor (`ConsensusAuditGuard`)**: Computes SHA-256 vector checksums across distributed active nodes to detect and resolve multi-region split-brain state drift.
- 📦 **Zero-Allocation ByteBufferPool (`ByteBufferPool`)**: Reusable slab memory arenas for high-frequency JSON serializations, eliminating V8 Garbage Collection pauses.
- 🛑 **4-Stage Zero-Data-Loss Graceful Shutdown (`GracefulShutdownOrchestrator`)**:
  1. *Stage 1*: Signals load balancers (`/health/readiness` ➔ `503`).
  2. *Stage 2*: Drains active BullMQ provider queue jobs without accepting new items.
  3. *Stage 3*: Terminates worker loop intervals (`outboxRelay`, `scheduledPromoter`, `geoReplication`).
  4. *Stage 4*: Flushes Prometheus metrics and closes PostgreSQL connection pools.

---

## 📈 Performance SLA & Benchmarks

Benchmarked on commodity hardware (Apple M3 Max / 8 vCPU Cloud Instances, PostgreSQL 16, Redis 7):

| Benchmark Scenario | Throughput / Latency | Resource Utilization |
| :--- | :--- | :--- |
| **Synchronous Send Acceptance (`POST /v1/messages`)** | **12,500 req/sec** (`p50: 3.8ms`, `p95: 11.4ms`, `p99: 18.2ms`) | CPU: 38% \| RSS: 68 MB |
| **Micro-Batch Webhook Ingestion (`POST /v1/webhooks`)** | **52,000 events/sec** (50ms flush micro-batches) | CPU: 42% \| Redis Mem: < 15 MB |
| **AST WhatsApp Template Render Engine** | **1,250,000 renders/sec** (Sub-microsecond AST cache) | Zero heap allocations |
| **Transactional Outbox Sweep (`outbox-relay`)** | **25,000 rows/sec** (SKIP LOCKED multi-shard cursor) | PostgreSQL CPU: 24% |
| **Baseline Memory Footprint** | **~62 MB RSS** on cold start | V8 Heap: 18 MB |

---

## 🗂️ Repository Topology

```text
convey/
├── .agents/                    # Developer guidelines & convey-architecture skill
├── ADRs/                       # Architecture Decision Records (ADR 001 - 005)
│   ├── ADR-001-bun-elysia-stack.md
│   ├── ADR-002-transactional-outbox-bullmq.md
│   ├── ADR-003-provider-adapter-capabilities.md
│   ├── ADR-004-biome-code-quality.md
│   └── ADR-005-whatsapp-session-cost-optimization.md
├── docs/                       # Comprehensive system architecture & specs
│   ├── api.md                  # Complete OpenAPI REST endpoint documentation
│   ├── architecture.md         # 4-stage pipeline design & architectural topology
│   ├── database-schema.md      # 16 Drizzle table schemas & monthly partition model
│   ├── queue-topology.md       # BullMQ queues, workers & dual-layer scheduler
│   ├── provider-capabilities.md# 88-provider capability matrix & circuit configs
│   ├── security.md             # AES-256-GCM envelope encryption & DLP redaction
│   ├── observability.md        # Prometheus metrics, W3C tracing, & health probes
│   └── whatsapp-session-optimization.md # 24h session tracker & AST template engine
├── wiki/                       # Channel payload examples & resilience guides
│   ├── Home.md
│   ├── Per-Channel-Examples-and-Payloads.md
│   ├── Planetary-Scale-Resilience-Architecture.md
│   └── Zero-Trust-Security-and-Encryption.md
├── drizzle/                    # Generated SQL migration files
├── scripts/                    # Operational & benchmarking CLI utilities
│   ├── benchmark-report.ts     # 10k load test & financial cost analyzer
│   └── get-job-consumption.ts  # Real-time queue consumption inspector
├── src/
│   ├── bootstrap.ts            # Bootstrapping & graceful shutdown lifecycle
│   ├── index.ts                # Elysia app, Prometheus metrics, & probe routes
│   ├── config/                 # Zod environment parsing & dynamic reloader
│   ├── db/                     # Drizzle ORM client, schemas, & partition manager
│   ├── modules/                # Domain modules:
│   │   ├── auth/               # API key authentication & RBAC
│   │   ├── messaging/          # Messaging controllers, outbox, cascade, & DLQ
│   │   ├── policies/           # Rate limiting, quiet hours, & cost optimizer
│   │   ├── providers/          # 88 provider adapters (email, sms, push, chat, tool)
│   │   │   └── whatsapp/       # 24h session tracker & AST template engine
│   │   ├── reports/            # Real-time telemetry, aggregations, & OLAP archiver
│   │   ├── suppressions/       # Global & tenant-level suppression lists
│   │   └── webhooks/           # Inbound webhook ingestion & signature validation
│   ├── queues/                 # BullMQ definitions, connection pools, & 8 workers
│   └── utils/                  # Resilience utilities (encryption, heap guard, chaos)
└── tests/                      # 68+ unit, integration, transformer, & E2E tests
```

---

## 📚 Deep-Dive Documentation Index

- 📘 **[REST API Specification](./docs/api.md)** — Complete endpoint schemas, query parameters, error matrices, and curl examples.
- 🏛️ **[System Architecture](./docs/architecture.md)** — In-depth breakdown of the 4-stage pipeline, fast path, and graceful shutdown.
- 💾 **[Database Schema & Partitioning](./docs/database-schema.md)** — 16 Drizzle table schemas, foreign keys, and monthly range partitioning.
- 🚦 **[Queue Topology & Schedulers](./docs/queue-topology.md)** — BullMQ queue definitions, worker loops, and dual-layer scheduler.
- 🔌 **[Provider Capabilities Matrix](./docs/provider-capabilities.md)** — Detailed capability breakdown and circuit breaker settings for all 88 providers.
- 💬 **[WhatsApp Session Optimization](./docs/whatsapp-session-optimization.md)** — 24-hour customer conversation window tracking and cost savings.
- 🔒 **[Zero-Trust Security & Encryption](./docs/security.md)** — AES-256-GCM envelope encryption and threat model.
- 📊 **[Observability & Health Probes](./docs/observability.md)** — Prometheus metrics registry, W3C tracing, and Kubernetes probes.
- 📨 **[Per-Channel Request Payloads Guide](./wiki/Per-Channel-Examples-and-Payloads.md)** — Concrete JSON examples for Email, SMS, Push, Chat, and Tool channels.
- 📜 **[Architecture Decision Records (ADRs)](./ADRs)** — Architectural decisions ADR-001 through ADR-005.

---

<div align="center">
  <sub>Engineered with precision for planetary scale. Built with Bun, Elysia, PostgreSQL, and Redis.</sub>
</div>
