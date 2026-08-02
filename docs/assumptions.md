# Convey Operational Assumptions & Boundaries

This document lists operational assumptions and system boundaries governing Convey's runtime deployment.

---

## 1. Environment & Technical Stack

- **Runtime Environment**: Executed natively on **Bun >= 1.1.0** (Recommended: Bun 1.4).
- **Database**: PostgreSQL >= 15.0 with support for declarative range partitioning.
- **Cache & Message Broker**: Redis >= 7.0 (Standalone or Redis Cluster with hash tag support `{convey}`).
- **Standalone Codebase**: `convey/` has zero runtime imports or file dependencies on external monorepo directories.

---

## 2. Multi-Tenant Operational Boundaries

- **Team Boundaries**: Authentication, idempotency keys, rate limits, and budget ledgers are strictly scoped per tenant team (`team`).
- **Scheduling Horizon**: BullMQ delayed jobs are used for schedules <= 30 minutes; long-term schedules rely on PostgreSQL persistence.
- **Provider Credentials**: Provider configurations are resolved dynamically from PostgreSQL or environment variables with automatic in-memory hot-reloading.
