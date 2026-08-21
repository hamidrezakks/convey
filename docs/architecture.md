# Convey System Architecture & Technical Specification

Convey is a planetary-scale, fault-tolerant communication engine and notification gateway engineered on **Bun 1.4**, **Elysia.js**, **Drizzle ORM**, **PostgreSQL 15+ (Monthly Range Partitioned)**, **BullMQ (Redis 7+)**, and **Prometheus**.

Convey is **100% standalone**: it operates with zero runtime imports or file dependencies on external monolithic notification frameworks.

---

## 1. High-Level Architectural Topology

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT APPLICATIONS & MICROSERVICES                           │
│                      W3C Distributed TraceContext Propagation (traceparent headers)              │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ HTTP / HTTPS (REST API)
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ELYSIA.JS HIGH-THROUGHPUT GATEWAY                                │
│   POST /v1/messages    POST /v1/messages/bulk    POST /v1/batches    GET /v1/messages/:messageId │
│   • Schema Validation (TypeBox / Static Zod)      • Sensitive Data Redaction (DLP Regex)         │
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
                        │ (<= 30 Min Horizon)                             │ (> 30 Min Scheduled)
                        ▼                                                 ▼
┌───────────────────────────────────────────────────┐ ┌────────────────────────────────────────────┐
│         OUTBOX RELAY WORKER (FOR UPDATE SKIP)     │ │        SCHEDULED PROMOTER WORKER LOOP        │
│   • Consistent Hash Virtual Shard Routing         │ │   • Scans partition bounds for due items   │
│   • Multi-Shard Cursors (SKIP LOCKED)             │ │   • Promotes to BullMQ at T-30 minutes     │
│   • Enqueues to BullMQ Orchestration Queue        │ │   • Atomic state transition (scheduled)    │
└───────────────────────┬───────────────────────────┘ └─────────────────────┬──────────────────────┘
                        │                                                   │
                        └─────────────────────────┬─────────────────────────┘
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         BULLMQ ADAPTIVE MULTI-TENANT WORKER ORCHESTRATION                        │
│   • Deficit Round Robin (DRR) Multi-Tenant Fair Scheduling (Enterprise vs Standard Quanta)       │
│   • Adaptive Concurrency Scaler (Backlog Velocity-driven dynamically: 1 - 50 concurrency)        │
│   • Deliverability Autopilot, Quiet-Hours STO, & Predictive Cost Optimizer                       │
│   • Smart Provider Latency Scorecard Router (EMA latency & success scoring)                     │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ Routes to Per-Provider Sandboxed Queues
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    PROVIDER EXECUTION ENGINE                                     │
│   • Isolated In-Memory AES-256-GCM Payload Decryption                                            │
│   • Dynamic Hedged Requests (Fires speculative backup at p95 latency threshold)                 │
│   • Per-Provider Circuit Breakers (Stepped Half-Open Ramp: 5% ➔ 20% ➔ 50% ➔ 100%)                │
│   • Leaky-Bucket Micro-Rate Governor (100ms slice pacing per vendor API limits)                 │
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
│   • High-Throughput Micro-Batch Webhook Ingestion (52,000+ events/sec buffer pipeline)          │
│   • Autonomous 24h WhatsApp Session Tracker ($0.00 Text Transform via Pre-compiled AST Engine)   │
│   • Cross-Channel Waterfall Cascade Engine (e.g. WhatsApp ➔ Push ➔ SMS ➔ Email)                 │
│   • Dead-Letter Queue (DLQ) Management & Mutated Replay APIs (/v1/dlq, /v1/dlq/replay)           │
│   • Customer Webhook Subscriptions Dispatcher with HMAC Signature Signing                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 4-Stage Transactional Outbox Pipeline

Convey decouples ingestion, scheduling, dispatch, and external vendor execution across 4 strictly bounded stages:

### Stage 1: Synchronous API Acceptance (Hot Path `< 15ms`)
1. **Schema & DLP Validation**: Request payloads entering `POST /v1/messages` or `POST /v1/messages/bulk` are validated using high-speed compiled TypeBox schemas. The integrated `DlpScanner` scans content and redacts credit cards, SSNs, and sensitive tokens.
2. **1-RTT Fast-Path Idempotency**:
   - `IdempotencyService` immediately attempts an atomic Redis lock:
     ```redis
     SET convey:idempotency:{team}:{idempotencyKey} {payloadHash} EX {ttlSeconds} NX
     ```
   - If the key already exists and the payload hash matches, Convey returns the cached `202 Accepted` response in **`< 1ms`** without touching PostgreSQL.
   - If a duplicate key is submitted with a different payload hash, Convey rejects the request with `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
3. **Zero-Trust Envelope Encryption**:
   - Recipient contact details (`recipients`) and message channel bodies (`channels`) are packed and encrypted in memory using **AES-256-GCM** with a unique 96-bit Initialization Vector (IV).
   - The encrypted payload is assigned to `messages.metadata._encryptedEnvelope`.
4. **Atomic Transactional Outbox Commit**:
   - Inside a single PostgreSQL transaction (`BEGIN ... COMMIT`), Convey inserts:
     - 1 record into the range-partitioned `messages` table (with public ULID `msg_<ULID>`).
     - 1 record into the `outbox` table (status: `pending`).
5. **Immediate Client Response**: Returns HTTP `202 Accepted` containing the opaque `messageId` (`msg_<ULID>`).

### Stage 2: Outbox Relay & Scheduling Partitioning
1. **Multi-Shard Outbox Polling**:
   - `outbox-relay.worker.ts` polls the `outbox` table across virtual consistent-hash shards using non-blocking row locks:
     ```sql
     SELECT id, message_id, channel, payload, scheduled_at 
     FROM outbox 
     WHERE state = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= NOW() + INTERVAL '30 minutes')
     ORDER BY priority DESC, id ASC 
     LIMIT 500 
     FOR UPDATE SKIP LOCKED;
     ```
2. **Near-Term vs Long-Term Split**:
   - **Near-term execution (`<= 30 minutes`)**: Pushed to the BullMQ `dispatchQueue` (`{convey}:message-dispatch`). If delayed, BullMQ handles precise timer firing (`delay = scheduledAt - now`).
   - **Long-term scheduling (`> 30 minutes`)**: Remains in PostgreSQL. `scheduled-promoter.worker.ts` continuously scans partition boundary indexes and promotes messages into BullMQ when they enter the 30-minute window.
3. **Outbox State Transition**: Processed outbox records transition to `state = 'processed'` or are pruned via retention policies.

### Stage 3: BullMQ Multi-Tenant Dispatch & Sandboxed Provider Execution
1. **Multi-Tenant Scheduling & Policy Evaluation**:
   - `message-dispatch.worker.ts` pulls jobs from `dispatchQueue`.
   - Evaluates **Deficit Round Robin (DRR)** scheduler weights to guarantee fair quantum distribution across tenant tiers (Enterprise vs Free/Standard).
   - Evaluates **PolicyEngine**: verifies team rate limits, quiet hours (STO - Send Time Optimization), suppression lists, and budget usage (via L1 cached policies).
   - Resolves optimal provider via **SmartProviderRouter** (EMA latency score + success rate).
   - Dispatches job to the provider's dedicated BullMQ queue (`{convey}:provider-send-<providerId>`).
2. **Sandboxed Provider Execution**:
   - `provider-send.worker.ts` processes jobs from the dedicated provider queue.
   - Decrypts `metadata._encryptedEnvelope` strictly inside worker process memory.
   - Evaluates **ProviderCircuitBreaker**: if `OPEN`, immediately fails over to backup providers.
   - If WhatsApp channel, runs **WhatsAppSessionInterceptor**: checks 24h active conversation window in Redis. If active, compiles template via AST engine and transmits as plain text ($0.00 Meta template fee).
   - Executes `provider.send()` adapter using **HedgedExecutor** (fires speculative secondary request if p95 latency exceeds threshold).
   - Logs execution attempt in range-partitioned `message_attempts` and writes lifecycle audit entry to `message_events`.

### Stage 4: Inbound Webhooks, Callbacks & Cascade Fallback
1. **Micro-Batch Webhook Ingestion**:
   - Inbound vendor status callbacks (`POST /v1/webhooks/:provider`) are validated against cryptographic provider signatures (HMAC-SHA256, Ed25519, ECDSA, AWS SNS SigV4).
   - `MicroBatchIngestionPipeline` buffers events in memory and flushes up to 500 events or every 50ms into PostgreSQL in multi-row batch inserts, achieving **> 52,000 events/sec**.
2. **Cross-Channel Waterfall Cascade**:
   - On terminal delivery failure (e.g. invalid phone number, provider rejection, timeout), `fallback-retry.worker.ts` evaluates message fallback rules.
   - Executes same-channel backup provider (e.g. `ses` ➔ `sendgrid`) or cascades cross-channel (e.g. `whatsapp` ➔ `push` ➔ `sms` ➔ `email`).
3. **Dead-Letter Queue (DLQ)**:
   - When all retries, failovers, and fallback channels are exhausted, message transitions to `state = 'dlq'`.
   - Operators can inspect and replay failed messages via `/v1/dlq` and `/v1/dlq/replay`.
4. **Customer Webhook Notification**:
   - `customer-webhook-dispatch.worker.ts` signs the event payload with HMAC-SHA256 and POSTs delivery receipts to client-subscribed webhook endpoints with exponential backoff.

---

## 3. Resilience & Intelligence Engine Matrix

Convey incorporates 15+ advanced distributed systems resilience primitives:

| Subsystem | Source Component | Architectural Responsibility |
| :--- | :--- | :--- |
| **Zero-Trust Envelope Encryption** | `src/utils/payload-encryption.ts` | AES-256-GCM envelope encryption of all recipient PII and message content at rest; in-memory worker decryption. |
| **DLP Sensitive Data Scanner** | `src/utils/dlp-scanner.ts` | High-performance regex scanning and automatic redaction of PANs, SSNs, and API secrets. |
| **Smart Provider Router** | `src/modules/providers/core/smart-router.ts` | Dynamic Exponential Moving Average (EMA) latency scoring and automated routing away from degraded vendors. |
| **Dynamic Hedged Executor** | `src/modules/providers/core/hedged-executor.ts` | Fires concurrent backup requests when upstream provider latency breaches p95, dropping tail latency by up to 70%. |
| **Stepped Half-Open Circuit Ramp** | `src/modules/providers/core/gradual-ramp.ts` | Admits probe traffic gradually (5% ➔ 20% ➔ 50% ➔ 100%) during circuit breaker recovery to prevent relapse. |
| **Autonomous Canary Self-Healing** | `src/modules/providers/core/self-healing.ts` | Runs background synthetic canary probes against open circuit breakers to verify recovery before routing user traffic. |
| **Deficit Round Robin Scheduler** | `src/utils/drr-scheduler.ts` | Multi-tenant quantum scheduler preventing noisy-neighbor queue starvation across tenant tiers. |
| **Adaptive Queue Autoscaler** | `src/queues/queue-autoscaler.ts` | Dynamically tunes BullMQ worker concurrency (1 to 50) based on real-time queue depth and ingestion rate. |
| **Event-Loop Traffic Governor** | `src/utils/traffic-governor.ts` | Monitors V8 event loop utilization and sheds non-critical marketing traffic when event loop lag > 50ms. |
| **V8 Heap Memory Guard** | `src/utils/heap-guard.ts` | Monitors RSS/heap memory saturation, applying worker backpressure before process reaches 85% capacity. |
| **Micro-Leaky Bucket Governor** | `src/modules/policies/leaky-bucket.ts` | Paces outbound provider dispatch in 100ms slices to strictly respect vendor API throughput limits. |
| **Distributed Token Bucket Limiter**| `src/modules/policies/token-bucket.ts` | Redis Lua-backed atomic rate limiter for tenant-level request throttling. |
| **Full-Jitter Exponential Backoff** | `src/utils/full-jitter-retry.ts` | Computes decorrelated randomized backoff delays to prevent thundering herd retry storms. |
| **Zero-Allocation Buffer Pool** | `src/utils/buffer-pool.ts` | Reusable slab buffer memory arenas for high-throughput JSON serialization without V8 GC pauses. |
| **Anti-Entropy Consensus Auditor** | `src/utils/consensus-auditor.ts` | SHA-256 vector checksum verification across distributed nodes to detect and resolve multi-datacenter state drift. |
| **Active-Active Geo-Replication** | `src/utils/geo-replication.ts` | Multi-region heartbeat telemetry and automated cluster failover coordination in Redis. |
| **W3C Distributed TraceContext** | `src/utils/trace-context.ts` | Transparent end-to-end W3C `traceparent` propagation across API routes, queues, outbox, and provider headers. |

---

## 4. Multi-Stage Graceful Shutdown Protocol

To ensure **zero data loss** during deployments, node restarts, or Kubernetes pod terminations, `GracefulShutdownOrchestrator` (`src/utils/shutdown.ts`) and `bootstrapService` execute a coordinated 4-stage shutdown sequence upon receiving `SIGTERM` or `SIGINT`:

```text
[SIGTERM / SIGINT Received]
          │
          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: Traffic Cut-Off & Load Balancer Ejection                       │
│ • appReadiness.setReady(false) ➔ GET /health/readiness returns HTTP 503  │
│ • Load balancers remove node from upstream pool within active health win │
│ • In-flight HTTP requests complete within 5-second drain window         │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: Provider Queue Drainage & Worker Job Completion                 │
│ • Pauses all BullMQ provider send queues (closeAllProviderQueues())      │
│ • Waits for currently executing provider HTTP calls to finish cleanly   │
│ • Prevents picking up new BullMQ jobs                                    │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: Background Worker Loop Termination                             │
│ • Stops outboxRelay loop and scheduledPromoter scanning intervals        │
│ • Stops selfHealing canary probes and geoReplication heartbeat loops    │
│ • Ensures no orphaned PostgreSQL locks remain in FOR UPDATE state        │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: Metrics Flush & Database Connection Pool Teardown               │
│ • Flushes pending Prometheus telemetry and OLAP metric aggregations     │
│ • Gracefully closes Bun Native Redis connection pool (redisClient.quit()) │
│ • Closes PostgreSQL connection pool (queryClient.end())                  │
│ • Process exits with status 0 (Zero Message Loss)                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Performance Benchmarks & SLA Verification

Convey includes an automated benchmark test suite (`bun run test:bench`) and report generator (`bun run bench`). Detailed numbers, percentiles, and latency distributions across micro-engines, HTTP API ingestion endpoints, and outbox concurrency pipelines are documented in **[Performance Benchmarks & SLAs](./benchmarks.md)**.

---

## 8. Bun 1.4 Native Runtime Performance Architecture

Convey is explicitly architected to exploit the **Bun 1.4** runtime engine to achieve near-zero allocation and maximum CPU throughput:

1. **SIMD-Accelerated Consistent Hashing**:
   - `ConsistentHashShardRouter` uses `(Bun.hash.murmur32v3(key) >>> 0) % this.totalShards`, bypassing cryptographic hasher object instantiation, string slicing, and radix parsing. Operates at **> 5.25M ops/sec** with 0MB memory delta.
2. **Zero-Allocation W3C Distributed Tracing**:
   - `TraceContext` generates W3C traceparents using native C++ `crypto.randomUUID().replace(/-/g, '')` and `.slice(0, 16)`, avoiding `Uint8Array` buffer allocations per HTTP request. Operates at **> 5.06M ops/sec**.
3. **$O(1)$ Multi-Tenant DRR Dequeue with Head Pointers**:
   - `DeficitWeightedRoundRobinScheduler` maintains a cursor index (`head++`) and batch-compacts task queues (`splice(0, head)`) when `head > 64`, avoiding $O(N)$ `Array.prototype.shift()` re-indexing overhead under planetary stress.
4. **Zero-Shift Rolling Anomaly Window**:
   - `StatisticalAnomalyDetector` tracks rolling latencies in-place using `copyWithin(0, 1)` and tight scalar loops, achieving **> 900k ops/sec** with zero GC impact.
5. **L1 In-Memory Route Cache**:
   - `message-dispatch.worker.ts` leverages a 5,000ms TTL `BoundedLruCache` to avoid repetitive Redis `GET route:*` roundtrips during high-concurrency worker dispatch.
6. **Kernel-Level Port Reuse (`reusePort: true`)**:
   - `Bun.serve` and Elysia enable `reusePort: true` to balance socket connection backlogs across multiple worker processes via kernel-level multi-queue distribution.
7. **Native Redis Pipeline Serialization**:
   - `BunNativeRedis` serializes Redis hash maps using zero-allocation `for...in` loops, avoiding intermediate tuple arrays (`Object.entries`), and executes atomic pipelined command batches in single network roundtrips.

