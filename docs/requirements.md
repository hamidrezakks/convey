# Convey Requirements & SLA Metrics Specification

This document details the functional, non-functional, and SLA requirements for the Convey Communication Service.

---

## 1. Functional Requirements

- **Multi-Channel Dispatch**: Must support 5 channels (Email, SMS, Push, Chat, Tool) across 88 integrated providers.
- **Strict Idempotency**: `idempotencyKey` + `team` guarantee. Duplicate submissions must return cached response without duplicate provider sends.
- **Zero Provider Message ID Exposure**: External API clients must only see opaque ULIDs (`msg_<ULID>`).
- **Zero-Trust Encryption**: Contact details and channel message bodies must be AES-256-GCM encrypted at rest.
- **Resilience & Fallbacks**: Support same-channel provider failover and cross-channel fallback rules.
- **Dead-Letter Queue Management**: Provide REST APIs to query failed messages and trigger bulk re-enqueuing.

---

## 2. Performance SLA & Non-Functional Requirements

- **Hot-Path Acceptance Latency**: `< 15ms` for synchronous send acceptance (`POST /v1/messages`).
- **Ingestion Throughput Target**: `> 10,000` messages/sec accepted and committed to transactional outbox.
- **Webhook Ingestion Velocity**: `> 50,000` delivery receipts/sec via micro-batching.
- **Availability Target**: 99.99% system uptime with graceful multi-stage shutdown and multi-region quorum consensus auditing.
