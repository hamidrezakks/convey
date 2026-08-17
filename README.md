<div align="center">

# ⚡ CONVEY

### **Planetary-Scale, Multi-Tenant Communication Infrastructure & Message Gateway**

[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun%201.4-f472b6?style=for-the-badge&logo=bun)](https://bun.sh)
[![Framework: Elysia.js](https://img.shields.io/badge/Framework-Elysia.js-8b5cf6?style=for-the-badge&logo=fastapi)](https://elysiajs.com)
[![Web Console: React 19 + Base UI](https://img.shields.io/badge/Web_UI-React%2019%20%2B%20Base%20UI-38bdf8?style=for-the-badge&logo=react)](./docs/web-ui-mission-control.md)
[![Database: PostgreSQL 16](https://img.shields.io/badge/Database-PostgreSQL%2016%20(Partitioned)-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org)
[![Queues: BullMQ + Redis](https://img.shields.io/badge/Queues-BullMQ%20%2B%20Redis%207-dc2626?style=for-the-badge&logo=redis)](https://redis.io)
[![Security: AES-256-GCM](https://img.shields.io/badge/Security-AES--256--GCM%20Zero--Trust-059669?style=for-the-badge&logo=shield)](./docs/security.md)
[![Adapters: 88 Providers](https://img.shields.io/badge/Ecosystem-88%20Providers%20%2F%205%20Channels-2563eb?style=for-the-badge)](./docs/provider-capabilities.md)
[![Code Quality: Biome](https://img.shields.io/badge/Code_Style-Biome%20Strict-6366f1?style=for-the-badge&logo=biome)](https://biomejs.dev)

<p align="center">
  <b>Convey</b> is a high-throughput, fault-tolerant notification engine and planetary telemetry mission control console engineered for mission-critical enterprise workloads.<br/>
  Featuring <b>sub-15ms synchronous hot-path acceptance</b>, <b>zero-trust envelope encryption at rest</b>, <b>autonomous WhatsApp session cost optimization</b>, <b>dual-layer hybrid scheduling</b>, <b>React 19 + Base UI Mission Control</b>, and <b>88 turnkey provider integrations</b> across 5 channels.
</p>

---

[Executive Overview](#-executive-overview) •
[Mission Control Web-UI](#-planetary-mission-control-web-ui) •
[System Architecture](#-system-architecture--topology) •
[Engineering Guarantees](#-core-architectural-guarantees) •
[WhatsApp Cost Autopilot](#-autonomous-whatsapp-24h-session-cost-optimization) •
[Provider Ecosystem](#-supported-provider-ecosystem-88-turnkey-adapters) •
[Quickstart](#-quickstart--developer-experience) •
[API Showcase](#-api-specification--showcase) •
[Documentation Index](#-deep-dive-documentation-index)

---

</div>

## 🌟 Executive Overview

Modern notification infrastructure frequently breaks down under production stress: slow synchronous HTTP requests block client callers, provider outages cause silent message loss, recipient PII is stored unencrypted in application databases, and vendor messaging bills escalate due to unoptimized channel routing.

**Convey** solves these challenges from first principles with a completely **100% standalone**, zero-dependency architecture:

| Capability / SLA | Traditional Monoliths | Cloud Gateways / Novu | **Convey Engine** |
| :--- | :--- | :--- | :--- |
| **Hot-Path Send Latency** | 150ms – 600ms (blocking provider HTTP) | 50ms – 120ms | **`p50 < 4ms` / `p99 < 18ms`** (1 Redis `SET NX` + 1 Postgres Tx) |
| **Admin & Telemetry Console** | Basic static tables | Commercial Cloud SaaS only | **React 19 + Base UI Mission Control (`@convey/web`)** |
| **Data Privacy at Rest** | Plaintext PII stored in SQL | Database-level disk encryption only | **Zero-Trust Field-Level AES-256-GCM Envelope** (`_encryptedEnvelope`) |
| **Provider ID Privacy** | Leaks upstream vendor IDs (`SM_...`, `sg_...`) | Mixed ID surfaces | **Strict Zero-Leak Boundary** (`msg_<ULID>`) |
| **WhatsApp Delivery Cost** | 100% full Meta/BSP template rates ($$$) | Manual template switches | **Autonomous 24h Session Tracker ($0.00 Text Transform)** |
| **Scheduling Precision** | Cron jobs / Full DB table scans | In-memory timers / BullMQ only | **Dual-Layer Hybrid** (BullMQ `≤ 30m` + Partitioned Postgres `> 30m`) |
| **Multi-Tenant Fairness** | Global FIFO queue starvation | Coarse token bucket rate limits | **Deficit Round Robin (DRR) Multi-Tenant Quantum Scheduler** |
| **Tail-Latency Elimination** | Linear timeouts & retries | Basic exponential backoff | **Dynamic Hedged Concurrent Requests + Full-Jitter Backoff** |
| **Database Scalability** | Monolithic tables with B-Tree bloat | Unpartitioned event logs | **Monthly PostgreSQL Range Partitioning + Auto Pruning Windows** |

---

## 🎛️ Planetary Mission Control Web-UI

Convey includes a **Staff-level React 19 + Base UI Mission Control Console** (`apps/web`):

- 🛰️ **Planetary Telemetry Ops Center**: Real-time RPS throughput, P95 latency sparklines, BullMQ queue depths, and V8 Heap Memory Guard.
- 🔬 **Universal Message Explorer & W3C Tracing**: Interactive Gantt trace waterfall (`TraceWaterfall`) visualizer from HTTP ingestion to provider wire delivery.
- 🎚️ **Provider Matrix & Circuit Breaker Cockpit**: Live circuit states (`CLOSED`, `HALF-OPEN`, `OPEN`), stepped half-open traffic ramps (5% ➔ 20% ➔ 50% ➔ 100%), and 1-click synthetic canary probes.
- 💣 **Dead-Letter Queue & Blast-Radius Simulator**: Failure cluster breakdown, dry-run simulation of cost and risk, and zero-data-loss batch replay.
- 🛡️ **Deliverability Autopilot & Suppression Guard**: SPF/DKIM/DMARC alignment scorecards, IP warmup curves, and suppression management.
- ⚖️ **DRR Policy Studio**: Deficit Weighted Round Robin SLA weights (`Enterprise: 200`, `Pro: 50`, `Free: 10`) and distributed token-bucket ingress controls.
- ✍️ **Omnichannel Composer**: Side-by-side WYSIWYG studio with realistic frames for Email (Desktop/Mobile), SMS (GSM-7 counter), WhatsApp (Action CTAs), Slack, Push, and Webhook dispatch.
- ⚡ **Global Search (`⌘K`)**: Instant modal navigation across messages, providers, queues, and settings.

📖 **[Read the complete Web-UI Console Guide](./docs/web-ui-mission-control.md)**.

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
│   POST /v1/messages    POST /v1/messages/bulk    POST /v1/admin/...     GET /health/readiness    │
│   • Schema Validation (TypeBox / Zod)             • Sensitive Data Redaction (DLP Regex)         │
│   • 1-RTT Redis Idempotency Lock (SET NX)         • Zero-Trust AES-256-GCM Envelope Encryption   │
│   • L1 In-Memory Policy Cache (5,000ms TTL)       • Adaptive Event-Loop Traffic Governor         │
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
│   • Micro-Batch Webhook Ingestion (52,000/sec)   • Autonomous 24h WhatsApp Session Tracker      │
│   • Cross-Channel Waterfall Cascade Engine        • Dead-Letter Queue (DLQ) & Mutated Replay     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

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

# Install dependencies across all monorepo packages (ultra-fast via Bun)
bun install

# Initialize local environment configuration
cp .env.example .env
```

### 2. Database Migration & Range Partitioning
```bash
# Run Drizzle migrations & auto-generate monthly PostgreSQL partitions
bun run db:migrate
```

### 3. Launch Development Monorepo
```bash
# Concurrently launches @convey/server (port 3000) and @convey/web (port 5173)
bun run dev
```

- 🎛️ **Web-UI Mission Control**: `http://localhost:5173`
- 📖 **Interactive OpenAPI Spec**: `http://localhost:3000/swagger`
- 🩺 **Kubernetes Health Probes**: `http://localhost:3000/health/readiness`
- 📊 **Prometheus Metrics**: `http://localhost:3000/metrics`

### 4. Running Test Suites & Quality Verification
```bash
# Run all 914 tests across the entire monorepo (895 backend + 19 web frontend)
bun test

# Run Web-UI test suite only
bun run test:web

# Run Biome strict code quality and formatting
bun run biome:check
bun run biome:format
```

---

## 🗂️ Monorepo Structure

```text
convey/
├── apps/
│   ├── server/                 # @convey/server (Elysia API, BullMQ Workers, 88 Adapters)
│   │   ├── src/
│   │   │   ├── modules/admin/  # Admin REST & telemetry endpoints
│   │   │   ├── modules/messaging/
│   │   │   ├── modules/providers/
│   │   │   └── ...
│   │   └── tests/              # 895 tests (Unit, Integration, E2E, Benchmarks)
│   │
│   └── web/                    # @convey/web (React 19, Base UI, Tailwind, Obsidian Theme)
│       ├── src/
│       │   ├── components/     # UI primitives, layout, waterfall, omnichannel preview
│       │   ├── pages/          # 10 Mission Control Views
│       │   └── lib/            # API client & formatting utilities
│       └── tests/              # 19 Web tests (Happy-DOM, testing-library)
│
├── packages/
│   └── shared/                 # @convey/shared (Domain types, enums, DTOs)
│       └── src/index.ts
│
├── ADRs/                       # Architecture Decision Records (ADR 001 - 005)
├── docs/                       # Comprehensive documentation & architecture specs
│   ├── web-ui-mission-control.md # Complete manual for the Web-UI Console
│   ├── api.md
│   ├── architecture.md
│   ├── database-schema.md
│   ├── queue-topology.md
│   └── ...
```

---

## 📚 Deep-Dive Documentation Index

- 🎛️ **[Web-UI Mission Control Manual](./docs/web-ui-mission-control.md)** — Complete guide for the React 19 + Base UI console.
- 📘 **[REST API Specification](./docs/api.md)** — Complete endpoint schemas, query parameters, error matrices, and curl examples.
- 🏛️ **[System Architecture](./docs/architecture.md)** — In-depth breakdown of the 4-stage pipeline, fast path, and graceful shutdown.
- 💾 **[Database Schema & Partitioning](./docs/database-schema.md)** — 16 Drizzle table schemas, foreign keys, and monthly range partitioning.
- 🚦 **[Queue Topology & Schedulers](./docs/queue-topology.md)** — BullMQ queue definitions, worker loops, and dual-layer scheduler.
- 🔌 **[Provider Capabilities Matrix](./docs/provider-capabilities.md)** — Detailed capability breakdown and circuit breaker settings for all 88 providers.
- 💬 **[WhatsApp Session Optimization](./docs/whatsapp-session-optimization.md)** — 24-hour customer conversation window tracking and cost savings.
- 🔒 **[Zero-Trust Security & Encryption](./docs/security.md)** — AES-256-GCM envelope encryption and threat model.
- 📊 **[Observability & Health Probes](./docs/observability.md)** — Prometheus metrics registry, W3C tracing, and Kubernetes probes.
- ⚡ **[Performance Benchmarks & SLAs](./docs/benchmarks.md)** — Micro-engine benchmarks, HTTP API ingestion throughput, and high-concurrency verification.
- 📈 **[Horizontal Scaling Guide](./docs/scaling.md)** — High availability, micro-batching pipelines, and capacity planning.

---

<div align="center">
  <sub>Engineered with precision for planetary scale. Built with Bun, Elysia, React 19, Base UI, PostgreSQL, and Redis.</sub>
</div>
