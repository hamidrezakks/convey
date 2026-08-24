---
name: convey-architecture
description: Comprehensive technical guidelines, architectural standards, and performance patterns for the Convey communication service using Bun 1.4, Elysia, Drizzle ORM, PostgreSQL, and BullMQ.
---

# Convey Architecture & Performance Guide

Use this skill when designing, building, or refactoring features, provider adapters, queue workers, or API endpoints in Convey.

## 1. Standalone Architecture & Boundaries
- `convey/` is **100% standalone**. Never import from `../novu` or introduce runtime dependencies on Novu.
- Code style: Must strictly pass `bun run biome:check` and `bun run biome:format`.
- Public Privacy: Expose opaque public IDs (`msg_<ULID>`). Never leak internal database UUIDs, provider message IDs, or BullMQ job IDs to callers.

## 2. Queue Topology & Work Division
- **Near-term execution (`<= 30 minutes`)**: Handled by BullMQ queues (`outbox-relay` ➔ `message-dispatch` ➔ `provider-send`).
- **Long-term scheduling (`> 30 minutes`)**: Stored in PostgreSQL (`messages.scheduled_at`). Promoted to BullMQ by `scheduled-promoter.worker.ts` when entering the 30-minute window.
- **Transactional Outbox Pattern**: Send endpoints write to `messages` + `outbox` in 1 Postgres transaction. `outbox-relay.worker.ts` polls `outbox` using `FOR UPDATE SKIP LOCKED` and enqueues to BullMQ.

## 3. Database Performance & Range Partitioning
- **PostgreSQL 18 Monthly Partitioning**: High-volume tables (`messages`, `message_attempts`, `message_events`, `budget_ledger`) use range partitioning by month (`PARTITION BY RANGE (created_at)`).
- **Partition Pruning Mandatory**: Always include timestamp bounds (`gte(createdAt, startDate)`, `lte(createdAt, endDate)`) using `computePartitionWindow(publicId)` on partitioned table queries and updates to avoid full partition scans.
- **Fast-Path Send Acceptance**: Keep send acceptance to 1 DragonflyDB `SET NX` call + 1 PostgreSQL 18 transaction.

## 4. DragonflyDB / Redis Idempotency & L1 Caching
- **1-RTT Fast Path**: `IdempotencyService.reserve()` executes `SET key value EX TTL NX` directly on DragonflyDB first. Fallback to `GET` only if key already exists.
- **L1 Policy Caching**: Policy checks (`rateLimitPolicies`, `budgetPolicies`, `budgetUsage`) use a short in-memory TTL cache (5,000ms) to eliminate redundant SQL reads on every message dispatch.
- **Provider Config Caching**: Cache provider credentials/config in memory (`getCachedProviderConfig`) in worker loops to eliminate per-message database lookups.
- **Provider Registry Channel Memoization**: Cache resolved channel adapters in `ProviderRegistryStore` (`channelAdaptersCache`) to avoid iterating 80+ manifests per routing lookup.

## 5. Planetary-Scale Resilience & Intelligence
- **Adaptive BullMQ Queue Autoscaler**: Calculate dynamic worker concurrency (`QueueAutoscaler`) based on queue depth.
- **Anti-Entropy Consensus Auditor**: Compare checksums (`ConsensusAuditGuard`) and resolve split-brain state drift using vector clocks.
- **Zero-Trust Payload Encryption**: Transparent AES-256-GCM envelope encryption (`PayloadEncryptionManager`) for PII payloads at rest.
- **Predictive Unit-Cost Router & Budget Optimizer**: Real-time channel unit-cost ranking (`CostOptimizationEngine`) to minimize delivery expenditure while enforcing team budgets.
- **Stepped Half-Open Traffic Ramp**: Stepped probe traffic admission (5% ➔ 20% ➔ 50% ➔ 100%) in `GradualRampController` during half-open circuit recovery.
- **High-Throughput Micro-Batch Ingestion**: Micro-batch buffering (`MicroBatchIngestionPipeline`) achieving 50,000+ events/sec bulk database write throughput.
- **Zero-Downtime Dynamic Config Reloader**: Hot-reload in-memory parameters (`DynamicConfigReloader`) via Redis PubSub without worker restarts.
- **Adaptive Heap Memory Guard**: Monitor V8 heap saturation (`HeapMemoryGuard`) to trigger worker throttling before 85% capacity.
- **Weighted Fair Queueing Multi-Tenant Scheduler**: Deficit Round Robin queueing (`MultiTenantPriorityScheduler`) guaranteeing fair quantum distribution per tenant tier.
- **Full-Jitter Exponential Backoff**: Calculate randomized backoff (`FullJitterRetry`) to prevent thundering herd spikes.
- **Micro-Leaky Bucket Provider Pacing**: Pace outbound worker dispatches (`LeakyBucketGovernor`) per 100ms slice to respect provider API throughput caps.
- **Consistent Hash Shard Routing**: Route outbox processing (`ConsistentHashShardRouter`) across virtual shards to eliminate row-lock contention.
- **Zero-Allocation ByteBufferPool**: Pre-allocate slab buffer arenas (`ByteBufferPool`) to eliminate V8 GC pressure during high-throughput serializations.
- **Event-Loop Adaptive Traffic Governor**: Monitor V8 event loop utilization (`TrafficGovernor`) and perform load shedding (>85% saturation) on non-critical traffic.
- **Autonomous Canary Self-Healing**: Run background synthetic canary probes (`SelfHealingEngine`) to safely evaluate degraded providers before restoring user traffic.
- **Active-Active Cross-Region Geo-Replication**: Track multi-region heartbeats (`GeoReplicationManager`) in Redis for active-active multi-datacenter failover.
- **Real-Time Tenant SLA Scheduler**: Dynamically elevate queue priority (`TenantSlaManager`) for Enterprise tenants when delivery percentiles (p95 > 350ms) approach SLA breach limits.
- **Statistical Z-Score Anomaly Detection**: Proactively flag provider latency anomalies (`StatisticalAnomalyDetector`) when Z-Score $\frac{X - \mu}{\sigma} > 3.0$ before hard timeouts occur.
- **Smart Provider Latency Scorecard Router**: Dynamic EMA latency and success rate scoring (`SmartProviderRouter`) to automatically select the optimal provider adapter per channel.
- **Distributed Token Bucket Traffic Smoother**: Redis Lua-backed token bucket algorithm (`TokenBucketLimiter`) for atomic rate smoothing under massive traffic spikes.
- **W3C Distributed TraceContext**: End-to-end W3C `traceparent` context propagation (`TraceContext`) across API handlers, outbox records, queue jobs, provider requests, and webhooks.
- **Dead-Letter Queue (DLQ) & Replay**: Query failed messages with `DlqService.listFailedMessages()` and replay them using `DlqService.replayFailedMessages()`. REST APIs available at `/v1/dlq` and `/v1/dlq/replay`.
- **Zero-Data-Loss Graceful Shutdown**: `GracefulShutdownOrchestrator` handles `SIGTERM`/`SIGINT` by marking readiness `false`, pausing outbox loops, draining active worker jobs, flushing metrics (`ReportingService.flush()`), and closing connection pools cleanly.

## 6. Bun 1.4 Native High-Performance Standards
- **SIMD Shard Hashing**: Use native SIMD `(Bun.hash.murmur32v3(key) >>> 0) % totalShards` for consistent shard hashing. Avoid creating crypto hasher instances or string slicing.
- **Zero-Allocation Distributed Tracing**: Generate W3C traceparents using native C++ `crypto.randomUUID().replace(/-/g, '')` and `.slice(0, 16)` to avoid `Uint8Array` buffer allocations per request.
- **$O(1)$ DRR Scheduler Dequeue**: Use head-pointer indices (`head++`) with batch compaction (`splice(0, head)`) instead of $O(N)$ `Array.prototype.shift()`.
- **In-Memory Worker Route Caching**: Use short-TTL `BoundedLruCache` (5,000ms) in message dispatch workers to eliminate repetitive Redis routing lookups.
- **Monomorphic Redis Serialization**: Use `for...in` loops in custom Redis wrappers (`hmset`) to eliminate intermediate `Object.entries` tuple allocations.
- **Kernel Socket Balancing**: Configure `reusePort: true` on `Bun.serve` / Elysia listeners for OS multi-queue socket load balancing.
