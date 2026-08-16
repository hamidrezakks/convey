# Convey Developer & Architecture Wiki

Welcome to the **Convey Wiki**. Convey is a high-performance, resilient multi-tenant communication service built on **Bun 1.4**, **Elysia.js**, **Drizzle ORM**, **PostgreSQL**, **BullMQ (Redis)**, **Biome**, and **Prometheus**.

---

## Navigation & Core Guides

- **[Per-Channel Request Payloads & Examples](./Per-Channel-Examples-and-Payloads.md)**: Request JSON schemas, multi-channel fallback rules, template variables, and envelope encryption examples across Email, SMS, Push, Chat, and Tool channels.
- **[Planetary-Scale Resilience Architecture](./Planetary-Scale-Resilience-Architecture.md)**: Multi-region active-active geo-replication, chaos engine testing, consensus auditing, and benchmark execution scripts (`bun run benchmark:report`, `bun run jobs:dump`).
- **[Zero-Trust Security & Envelope Encryption](./Zero-Trust-Security-and-Encryption.md)**: In-depth specification of AES-256-GCM envelope payload encryption at rest, key management, API key authentication, and log redaction.

---

## Quick Reference Links

- **[Root README](../README.md)**
- **[REST API Specification](../docs/api.md)**
- **[System Architecture Diagram & 4-Stage Pipeline](../docs/architecture.md)**
- **[Database Schema & Partitioning](../docs/database-schema.md)**
- **[Queue Topology & BullMQ Workers](../docs/queue-topology.md)**
- **[88 Provider Integrations Matrix](../docs/provider-capabilities.md)**
