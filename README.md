# Convey Communication Service

> High-performance, resilient, multi-tenant communication infrastructure service built on **Bun 1.4**, **Elysia.js**, **Drizzle ORM**, **PostgreSQL**, **BullMQ (Redis)**, **Biome**, and **Prometheus**.

`convey/` is **100% standalone** and operates with zero runtime dependencies on external monorepo packages.

---

## Key Features & Guarantees

- **Zero Provider Message ID Exposure**: Public REST APIs expose opaque ULID identifiers (`msg_<ULID>`) and hide internal provider message IDs.
- **Idempotency Guarantee**: Scoped by team boundary (`idempotencyKey` + `team`). Submitting the same key + payload returns the original `202 Accepted` response.
- **Sub-15ms Hot-Path Acceptance**: Synchronous send acceptance is bounded strictly to **1 Redis `SET NX` + 1 PostgreSQL transaction** (`INSERT messages` + `INSERT outbox`).
- **Dual-Layer Multi-Tenant Scheduling**: Near-term execution (`<= 30 minutes`) uses BullMQ delayed jobs; long-term scheduling (`> 30 minutes`) uses PostgreSQL with an automated `scheduledPromoter` worker loop.
- **Zero-Trust Envelope Encryption at Rest**: Recipient contact PII (emails, phone numbers, push tokens) AND message channel bodies are encrypted into PostgreSQL `messages.metadata._encryptedEnvelope` using AES-256-GCM. BullMQ workers decrypt payloads in worker memory during provider dispatch.
- **88 Integrated Providers across 5 Channels**: Email (20), SMS (39), Push (8), Chat (17), and Tool (4).
- **Multi-Stage Graceful Shutdown**: Intercepts `SIGTERM`/`SIGINT`, sets readiness to false, drains BullMQ queues, stops worker loops, and cleanly closes DB connection pools.

---

## Architectural Topology

```text
                               ┌────────────────────────────────────────────────────────┐
                               │                    Elysia.js REST                      │
                               │   POST /v1/messages     GET /v1/messages/:messageId    │
                               │   POST /v1/messages/bulk GET /v1/dlq                   │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │             Atomic Redis Reservation (SET NX)          │
                               │            Single PostgreSQL Transaction               │
                               │   INSERT messages ─── INSERT outbox (Zero-Trust GCM)  │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │       BullMQ Adaptive Autoscaled Worker Queues         │
                               │ outbox-relay ➔ message-dispatch ➔ provider-send       │
                               │                        ↳ fallback-retry                │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │                Provider Adapter Engine                 │
                               │  Email (20) | SMS (39) | Push (8) | Chat (17) | Tool (4)  │
                               └───────────────────────────┴────────────────────────────┘
```

---

## Quickstart & CLI Commands

### Prerequisites
- **Bun** `>= 1.1.0` (Recommended: Bun 1.4)
- **PostgreSQL** `>= 15.0`
- **Redis** `>= 7.0`

### Installation & Setup

```bash
# Install dependencies
bun install

# Configure environment variables
cp .env.example .env

# Run database migrations & ensure monthly partitions
bun run db:migrate

# Start development server with hot reloading
bun run dev

# Run unit & integration tests
bun test

# Run Biome code quality check and formatters
bun run biome:check
bun run biome:format
```

### Operational Scripts

```bash
# Generate real-time job consumption report across Redis & Postgres
bun run jobs:dump

# Run 10,000 message benchmark load test & output financial/throughput report
bun run benchmark:report
```

---

## Environment Variables Reference

Configure system parameters in `.env`:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | `number` | `3000` | HTTP API server port |
| `NODE_ENV` | `string` | `development` | Environment mode (`development`, `test`, `production`) |
| `POSTGRES_DB` | `string` | `db-convey` | PostgreSQL database name (overrides `DATABASE_URL` path if specified) |
| `DATABASE_URL` | `string` | `postgres://...` | PostgreSQL connection string |
| `REDIS_URL` | `string` | `redis://localhost:6379` | Redis connection URL |
| `LOG_LEVEL` | `string` | `info` | Structured logging verbosity (`trace`, `debug`, `info`, `warn`, `error`) |
| `BULLMQ_SCHEDULING_HORIZON_SECONDS` | `number` | `1800` | Threshold (30 mins) for BullMQ vs PostgreSQL delayed scheduling |


---

## Directory Structure

```text
convey/
├── .agents/          # Developer & agent guidelines
├── ADRs/             # Architecture Decision Records (ADR 001 - 004)
├── docs/             # Technical specifications & system design docs
├── wiki/             # Per-channel examples, security, and resilience guides
├── drizzle/          # Generated database migration files
├── scripts/          # Benchmark and job consumption CLI utilities
├── src/
│   ├── bootstrap.ts  # Service startup & graceful shutdown orchestrator
│   ├── index.ts      # Elysia application setup, Prometheus metrics, & probes
│   ├── config/       # Environment parsing & live config reloading
│   ├── db/           # Drizzle ORM client, schemas (12 tables), & partition manager
│   ├── modules/      # Domain modules (auth, messaging, providers, webhooks, policies, reports)
│   ├── queues/       # BullMQ definitions, connection pools, & 7 background workers
│   └── utils/        # Zero-trust encryption, adaptive concurrency, heap guard, chaos engine
└── tests/            # Unit, integration, provider transformers, and E2E benchmark tests
```

---

## Supported Provider Integrations (88 Total)

### 📧 Email Providers (20)
`ses`, `sendgrid`, `resend`, `mailgun`, `postmark`, `brevo`, `mailjet`, `sparkpost`, `mandrill`, `mailersend`, `nodemailer`, `plunk`, `mailtrap`, `anypost`, `braze`, `emailjs`, `infobip`, `netcore`, `outlook365`, `email-webhook`.

### 📱 SMS Providers (39)
`twilio`, `nexmo` (Vonage), `plivo`, `sinch`, `telnyx`, `termii`, `bandwidth`, `cequens`, `infobip`, `messagebird`, `gupshup`, `clicksend`, `clickatell`, `sns`, `africas-talking`, `afro-sms`, `azure-sms`, `brevo-sms`, `bulk-sms`, `burst-sms`, `cm-telecom`, `eazy-sms`, `firetext`, `forty-six-elks`, `generic-sms`, `imedia`, `isend-sms`, `isendpro-sms`, `kannel`, `maqsam`, `mobishastra`, `ring-central`, `ruach-sms`, `sendchamp`, `simpletexting`, `sms-central`, `sms77`, `smsmode`, `unifonic`.

### 🔔 Push Providers (8)
`fcm`, `apns`, `one-signal`, `expo`, `pusher-beams`, `pushpad`, `appio`, `push-webhook`.

### 💬 Chat & Messaging Providers (17)
`whatsapp-business`, `twilio-whatsapp`, `cequens-whatsapp`, `slack`, `discord`, `telegram`, `msTeams`, `mattermost`, `line`, `getstream`, `grafana-on-call`, `rocket-chat`, `ryver`, `sendblue`, `webex-messaging`, `zulip`, `chat-webhook`.

### 🛠️ Tool & Alerting Providers (4)
`pagerduty`, `opsgenie`, `grafana`, `tool-webhook`.

---

## Documentation Index

- **[REST API Specification](file:///Users/hamidrezakk/qlub/hobby/convey/docs/api.md)**: Endpoints, schemas, error codes, and curl examples.
- **[System Architecture](file:///Users/hamidrezakk/qlub/hobby/convey/docs/architecture.md)**: Processing pipeline, zero-trust encryption, and resilience modules.
- **[Database Schema & Partitioning](file:///Users/hamidrezakk/qlub/hobby/convey/docs/database-schema.md)**: 12 table schemas, time-range partitioning, and review answers.
- **[Queue Topology](file:///Users/hamidrezakk/qlub/hobby/convey/docs/queue-topology.md)**: BullMQ queues, worker loops, and dual-layer scheduler.
- **[Provider Capabilities Matrix](file:///Users/hamidrezakk/qlub/hobby/convey/docs/provider-capabilities.md)**: Provider schemas, adapters, and circuit breaker settings.
- **[Observability & Probes](file:///Users/hamidrezakk/qlub/hobby/convey/docs/observability.md)**: Prometheus metrics, health probes, and trace context propagation.
- **[Zero-Trust Security](file:///Users/hamidrezakk/qlub/hobby/convey/docs/security.md)**: AES-256-GCM envelope encryption at rest.
- **[Per-Channel Request Payloads Guide](file:///Users/hamidrezakk/qlub/hobby/convey/wiki/Per-Channel-Examples-and-Payloads.md)**: Examples for all 5 channel types.
- **[Architecture Decision Records](file:///Users/hamidrezakk/qlub/hobby/convey/ADRs)**: Technical decisions ADR-001 through ADR-004.
