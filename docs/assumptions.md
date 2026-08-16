# Convey Operational Assumptions & System Boundaries

This document articulates the baseline architectural assumptions, infrastructure prerequisites, tenant isolation models, and environmental boundaries governing Convey's runtime operations.

---

## 1. Runtime Environment & Technology Stack

- **Execution Runtime**: Native **Bun >= 1.1.0** (Recommended: Bun 1.4+). Convey relies on Bun's ultra-fast native HTTP server, high-speed SQLite/crypto bindings, and instant startup execution.
- **Relational Database**: **PostgreSQL >= 15.0** (Recommended: PostgreSQL 16) with support for declarative time-range partitioning (`PARTITION BY RANGE`).
- **Distributed Cache & Broker**: **Redis >= 7.0** (Standalone, Sentinel, or Redis Cluster). Must support Redis Hash Tags (`{convey}`) for atomic multi-key Lua scripts.
- **Codebase Independence**: `convey/` is **100% standalone**. It maintains zero runtime dependencies, monorepo links, or shared package imports from external monoliths.

---

## 2. Infrastructure & Network Topology Assumptions

- **Low-Latency Private Interconnect**: Sub-millisecond network round-trip time (`RTT < 1ms`) is assumed between Convey compute nodes, the PostgreSQL primary instance, and Redis cluster nodes.
- **NTP Time Synchronization**: All Convey cluster nodes and database servers must synchronize system clocks via Network Time Protocol (NTP). Monotonic clock skew must not exceed 20ms to ensure deterministic ULID ordering (`msg_<ULID>`) and partition window computations.
- **TLS 1.3 Termination**: Ingress Layer 7 load balancers (ALB, Cloudflare, Envoy, NGINX) terminate TLS 1.3 and forward client requests over trusted internal networks with standard proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`, `traceparent`).
- **Outbound Vendor Connectivity**: Worker nodes require outbound HTTPS (port 443) network egress to external provider endpoints (AWS SES, Twilio, Meta Graph API, Firebase Cloud Messaging, SendGrid, etc.).

---

## 3. Multi-Tenant Operational Boundaries

- **Tenant Isolation**: All database operations, Redis cache keys (`convey:idempotency:{team}:...`), rate limit counters, financial budget ledgers, and DLQ queries are partitioned by tenant team boundary (`team`).
- **Key Management**: Master payload encryption keys (`CONVEY_ENCRYPTION_KEY`) must be 256-bit hex strings securely provisioned via environment variables or secret management services (AWS KMS, HashiCorp Vault, Google Secret Manager).
- **Scheduling Horizon Boundary**: The BullMQ scheduling horizon is strictly fixed at 30 minutes (`BULLMQ_SCHEDULING_HORIZON_SECONDS = 1800`). Near-term delayed jobs reside in Redis; long-term scheduled jobs reside in PostgreSQL.
- **Zero Provider ID Exposure Boundary**: Internal provider identifiers and vendor tracking tokens are strictly confined to internal database attempt logs and are never surfaced in public REST responses or client webhooks.
