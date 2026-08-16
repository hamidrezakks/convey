# Convey Developer & Architecture Wiki

Welcome to the **Convey Engineering Wiki**. Convey is a planetary-scale, fault-tolerant communication engine and notification gateway engineered on **Bun 1.4**, **Elysia.js**, **Drizzle ORM**, **PostgreSQL 15+ (Range Partitioned)**, **BullMQ (Redis 7+)**, and **Prometheus**.

---

## 🧭 Core Developer Guides

- 📨 **[Per-Channel Request Payloads & Examples](./Per-Channel-Examples-and-Payloads.md)**: Concrete JSON payload examples, multi-channel waterfall fallback rules, dynamic template variables, and envelope encryption visualizations across Email, SMS, Push, Chat, and Tool channels.
- 🌐 **[Planetary-Scale Resilience Architecture](./Planetary-Scale-Resilience-Architecture.md)**: Multi-region active-active geo-replication, chaos injection testing, anti-entropy quorum consensus auditing, and operational CLI benchmark tools (`bun run benchmark:report`, `bun run jobs:dump`).
- 🔒 **[Zero-Trust Security & Envelope Encryption](./Zero-Trust-Security-and-Encryption.md)**: In-depth technical specification of AES-256-GCM envelope payload encryption at rest, key lifecycle management, DLP regex scanning, API key hashing, and regulatory compliance (GDPR/HIPAA).

---

## 📚 Deep-Dive System Specifications

| Specification Document | Focus Area |
| :--- | :--- |
| **[Root README](../README.md)** | Executive overview, architecture topology, quickstart, and benchmark SLA tables. |
| **[System Architecture](../docs/architecture.md)** | 4-stage transactional outbox pipeline, fast path, and 4-stage graceful shutdown. |
| **[REST API Reference](../docs/api.md)** | Complete OpenAPI 3.1 endpoint reference, JSON schemas, headers, and error taxonomy. |
| **[Database Schema & Partitioning](../docs/database-schema.md)** | 16 Drizzle table schemas, composite primary keys, and monthly declarative range partitions. |
| **[Queue Topology & Workers](../docs/queue-topology.md)** | BullMQ queues, 8 background worker loops, Deficit Round Robin scheduling, and Redis hash tags. |
| **[Provider Capabilities Matrix](../docs/provider-capabilities.md)** | Capability matrix and circuit breaker configurations for all 88 integrated providers. |
| **[WhatsApp Session Cost Optimization](../docs/whatsapp-session-optimization.md)** | Meta 24h customer conversation window tracking, AST tokenizer, and $0.00 plain text transformations. |
| **[Fallback & Failover State Machine](../docs/fallback-state-machine.md)** | Same-channel provider failover and cross-channel waterfall cascade decision trees. |
| **[Message State Machine](../docs/message-state-machine.md)** | Complete 8-state transition matrix and lifecycle event rules. |
| **[Zero-Trust Security Model](../docs/security.md)** | Cryptographic envelope encryption and threat model. |
| **[Observability & Distributed Tracing](../docs/observability.md)** | Prometheus metrics catalog, W3C traceparent propagation, and structured Pino logging. |
| **[Horizontal Scaling Guide](../docs/scaling.md)** | High-availability deployment, micro-batching pipelines, and capacity planning. |
| **[Novu vs Convey Assessment](../docs/novu-assessment.md)** | Senior engineering comparative analysis and performance benchmarks. |

---

## ⚡ Quick Operational Commands

```bash
# Start local development server with hot-reloading
bun run dev

# Run automated unit, integration, and E2E test suites (886 tests)
bun test

# Execute Biome strict code quality and formatting checks
bun run biome:check
bun run biome:format

# Run 10,000-message benchmark load test with financial cost reporting
bun run benchmark:report

# Inspect real-time queue consumption across Redis and PostgreSQL
bun run jobs:dump
```
