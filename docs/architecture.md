# Convey Architecture Overview

Convey is a high-performance, resilient multi-tenant communication service built on **Bun 1.4**, **Elysia.js**, **Drizzle ORM**, **PostgreSQL**, **BullMQ (Redis)**, **Biome**, and **Prometheus**.

`convey/` is **100% standalone** with zero runtime dependencies on external packages.

---

## 1. System Architecture Topology

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
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │         Planetary-Scale Resilience & Intelligence      │
                               │ Zero-Trust Envelope AES-256-GCM Payload Encryption      │
                               │ Adaptive BullMQ Queue Partition Autoscaler             │
                               │ Anti-Entropy Quorum Consensus Auditor                  │
                               │ Predictive Unit-Cost Router & Budget Optimizer          │
                               │ Stepped Half-Open Circuit Traffic Ramp Controller       │
                               │ High-Throughput Micro-Batch Webhook Ingestion          │
                               └───────────────────────────┴────────────────────────────┘
```

---

## 2. The 4-Stage Transactional Outbox Pipeline

Convey uses a 4-stage pipeline to guarantee zero-data-loss execution, strict idempotency, high throughput, and zero provider ID exposure:

### Stage 1: Synchronous API Acceptance (Hot Path < 15ms)
1. **Redis `SET NX` Idempotency Reservation**: Checks `convey:idempotency:{team}:{idempotencyKey}`. If present with matching hash, returns stored response instantly.
2. **Zero-Trust Envelope Encryption**: Encrypts contact details (`recipients`) and content bodies (`channels`) into AES-256-GCM ciphertext inside `metadata._encryptedEnvelope`.
3. **Single PostgreSQL Transaction**: Inserts 1 row into `messages` and 1 row into `outbox`. Returns `202 Accepted` with ULID `msg_<ULID>`.

### Stage 2: Outbox Relay Worker (`outbox-relay.worker.ts`)
1. Polls pending rows in `outbox` table using `FOR UPDATE SKIP LOCKED`.
2. For immediate execution (`scheduledAt` <= now or <= 30 mins), pushes job to BullMQ `dispatchQueue`.
3. For long-term scheduled messages (> 30 mins), leaves row in PostgreSQL for `scheduledPromoter.worker.ts` to pick up when due.

### Stage 3: BullMQ Dispatch & Provider Send Workers (`message-dispatch.worker.ts` & `provider-send.worker.ts`)
1. `message-dispatch.worker.ts` resolves provider selection via `SmartRouter`, evaluates policy engines (`PolicyEngine`, `CostOptimizer`), and routes to per-provider BullMQ queues (`bull:provider-send-<providerId>`).
2. `provider-send.worker.ts` decrypts envelope payload in memory, checks `ProviderCircuitBreaker`, executes provider adapter, logs `message_attempts`, and updates `messages.state`.

### Stage 4: Webhooks, Callbacks & Fallback Execution (`webhook-ingest.worker.ts` & `fallback-retry.worker.ts`)
1. Inbound webhooks (`POST /v1/webhooks/:provider`) are micro-batched into `webhookIngestQueue`.
2. On transient failure, `fallback-retry.worker.ts` triggers same-channel failover (alternative provider) or cross-channel fallback (e.g. WhatsApp ➔ SMS) according to defined rules.

---

## 3. Resilience & Intelligence Utilities

- **Zero-Trust Envelope Encryption (`PayloadEncryptionManager`)**: AES-256-GCM envelope encryption ensures PII and payload bodies are never stored in plaintext.
- **Adaptive Queue Autoscaler (`QueueAutoscaler`)**: Dynamically adjusts BullMQ worker concurrency based on queue backlog depth and ingestion velocity.
- **Anti-Entropy Quorum Consensus Auditor (`ConsensusAuditGuard`)**: Computes SHA-256 state checksums across active multi-region nodes to detect and reconcile split-brain state drift.
- **Predictive Unit-Cost Router (`CostOptimizationEngine`)**: Evaluates real-time unit costs across providers and channels to optimize delivery cost while staying within team budget limits.
- **Stepped Half-Open Ramp Controller (`GradualRampController`)**: Controls traffic throughput (5% ➔ 20% ➔ 50% ➔ 100%) during provider circuit breaker recovery.
- **Micro-Batch Webhook Ingestion (`MicroBatchIngestionPipeline`)**: Flushes inbound webhook receipts in micro-batches (50ms or 500 records) for multi-row PostgreSQL insertion.
- **Heap Guard (`HeapGuard`)**: Monitors node process memory usage, throttling background processing if memory usage approaches process limits.
- **Chaos Engine (`ChaosEngine`)**: Injects artificial delays, network errors, and provider outages during test scenarios.

---

## 4. Multi-Stage Graceful Shutdown Protocol

The `bootstrapService` orchestrator and `shutdownOrchestrator` implement a 4-stage graceful shutdown protocol:

1. **Stage 1 (Stop Traffic)**: Marks readiness status `false` (`appReadiness.setReady(false)`). Load balancers route incoming requests away from the node (`/health/readiness` returns 503).
2. **Stage 2 (Drain Queues)**: Pauses and drains active BullMQ provider queues (`closeAllProviderQueues()`).
3. **Stage 3 (Stop Workers)**: Terminates background loop intervals (`outboxRelay`, `scheduledPromoter`, `providerSelfHealing`, `geoReplicationManager`).
4. **Stage 4 (Close Connections)**: Flushes metrics and closes PostgreSQL pool connections (`queryClient.end()`).
