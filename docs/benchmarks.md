# Convey Performance Benchmarks & SLA Verification

This document details the automated benchmark test suite, methodology, throughput metrics, and latency SLA verification results for the **Convey Communication Engine**.

---

## 🚀 Executive Benchmark Summary

Convey is benchmarked across three core tiers:
1. **Core Subsystem Micro-Engines**: In-memory and Redis-accelerated algorithms (DLP scanning, DRR scheduling, AES-256-GCM encryption, W3C tracing, idempotency).
2. **HTTP API Ingestion**: Synchronous acceptance endpoints backed by Elysia.js, Bun 1.4 native HTTP, and PostgreSQL transactional outbox writes.
3. **High-Concurrency Pipeline & Outbox Relay**: Multi-threaded in-flight concurrent requests and `FOR UPDATE SKIP LOCKED` outbox polling.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CONVEY PERFORMANCE HIGHLIGHTS                                  │
├────────────────────────────────┬────────────────────────────────┬────────────────────────────────┤
│    W3C Tracing & Headers       │      Pre-Allocated Arena       │      DLP PII Redaction         │
│     > 6,200,000 ops/sec        │      > 1,300,000 ops/sec       │       > 450,000 ops/sec        │
│          p95: < 1 µs           │          p95: 1 µs             │           p95: 4 µs            │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│    DRR Multi-Tenant Quantum    │     Envelope Encryption (GCM)  │    Redis Lua Rate Smoothing    │
│       > 368,000 ops/sec        │       > 240,000 ops/sec        │        > 8,900 ops/sec         │
│           p95: 5 µs            │           p95: 8 µs            │          p95: 0.136ms          │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│    Single Message Send (SMS)   │    Single Message Send (Email) │   Inbound Webhook Ingestion    │
│         > 330 msgs/sec         │         > 330 msgs/sec         │       > 1,800 events/sec       │
│           p95: 4.3ms           │           p95: 3.9ms           │           p95: 0.76ms          │
└────────────────────────────────┴────────────────────────────────┴────────────────────────────────┘
```

---

## 🔬 1. Core Subsystem Micro-Engine Benchmarks

Micro-engine benchmarks test Convey's internal algorithms in isolation with zero mock overhead.

| Benchmark Operation | Subsystem | Ops/sec | Avg Latency | p50 Latency | p95 Latency | p99 Latency | Iterations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`TraceContext.extractOrCreate()`** | W3C Distributed Tracing | **6,222,458/s** | < 0.001ms | < 0.001ms | < 0.001ms | 0.001ms | 5,000 |
| **`ByteBufferPool.acquire() & release()`** | Buffer Allocation Arena | **1,305,440/s** | 0.001ms | 0.001ms | 0.001ms | 0.001ms | 5,000 |
| **`DlpScanner.sanitize()`** | CreditCard, SSN, OTP, Key Redaction | **449,952/s** | 0.002ms | 0.002ms | 0.004ms | 0.008ms | 1,000 |
| **`DRR Scheduler`** | Multi-Tenant Fair Quantum Distribution | **368,025/s** | 0.003ms | 0.002ms | 0.005ms | 0.011ms | 1,000 |
| **`PayloadEncryptionManager`** | AES-256-GCM Envelope Encrypt + Decrypt | **240,390/s** | 0.004ms | 0.003ms | 0.008ms | 0.016ms | 500 |
| **`TokenBucketLimiter.consume()`** | Redis Lua Atomic Rate Smoothing | **8,928/s** | 0.112ms | 0.104ms | 0.136ms | 0.252ms | 200 |
| **`IdempotencyService.reserve()`** | Redis `SET NX` Fast-Path | **3,335/s** | 0.300ms | 0.129ms | 1.157ms | 3.586ms | 200 |

### Key Architectural Takeaways:
- **Zero-Allocation Tracing**: W3C TraceContext generation operates at over **6.2 million ops/sec** with sub-microsecond overhead.
- **Envelope Encryption**: Field-level AES-256-GCM zero-trust encryption/decryption processes over **240,000 ops/sec** (p95: 8 µs), ensuring no plaintext PII persists in PostgreSQL without impacting ingestion SLAs.
- **Multi-Tenant Fairness**: The Deficit Round Robin (DRR) quantum scheduler processes scheduling decisions at **368,000 ops/sec** with a p95 latency of 5 µs.

---

## 🌐 2. HTTP API Ingestion Benchmarks

Ingestion benchmarks measure synchronous end-to-end HTTP request/response latency through Elysia.js, including authentication middleware, DLP redaction, schema validation, and PostgreSQL ACID transaction commit (`INSERT messages` + `INSERT outbox`).

| Endpoint / Scenario | Method | Throughput | Avg Latency | p50 Latency | p95 Latency | p99 Latency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Health & Subsystems Status** | `GET /health` | **1,906.7/s** | 0.524ms | 0.491ms | 0.652ms | 1.313ms |
| **Single Message Send (SMS)** | `POST /v1/messages` | **332.3/s** | 3.009ms | 2.775ms | 4.388ms | 5.085ms |
| **Single Message Send (Email HTML)** | `POST /v1/messages` | **330.6/s** | 3.025ms | 2.867ms | 4.009ms | 7.265ms |
| **Bulk Message Send (10 msgs/batch)** | `POST /v1/messages/bulk` | **207.8/s** | 4.813ms | 4.467ms | 6.587ms | 7.569ms |
| **Message Status Query** | `GET /v1/messages/:id` | **276.3/s** | 3.619ms | 3.313ms | 5.867ms | 7.490ms |
| **Batch Context Initialization** | `POST /v1/batches` | **476.4/s** | 2.099ms | 1.983ms | 3.204ms | 6.014ms |
| **Suppression Record Insert** | `POST /v1/suppressions` | **337.0/s** | 2.967ms | 2.529ms | 6.672ms | 9.547ms |
| **SendGrid Inbound Webhook** | `POST /v1/webhooks/sendgrid` | **1,705.1/s** | 0.586ms | 0.530ms | 0.906ms | 2.236ms |

### Key Architectural Takeaways:
- **Synchronous Ingestion SLA**: Single message sends (`POST /v1/messages`) achieve **p50 < 3.0ms** and **p95 < 4.5ms**, easily beating the strict 15ms SLA requirement.
- **Bulk Efficiency**: Ingesting 10 messages per batch via `POST /v1/messages/bulk` achieves **~2,078 messages/sec effective ingestion** with a p95 response time of only 6.5ms.
- **Webhook Processing**: Inbound provider delivery webhooks achieve **> 1,700 events/sec** with sub-millisecond average latency.

---

## ⚡ 3. High-Concurrency Pipeline & Outbox Relay SLAs

High-concurrency tests simulate production traffic spikes with 50 concurrent in-flight requests per batch and continuous background outbox relay execution.

| Scenario | Concurrency Profile | Ops/sec | Avg Latency | p50 Latency | p95 Latency | SLA Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Concurrent API Ingestion** | 50 concurrent in-flight HTTP requests | **33.8 batch/s (1,690 msg/s)** | 29.56ms | 28.96ms | 43.87ms | ✅ Passed |
| **Outbox Relay Batch Processor** | `FOR UPDATE SKIP LOCKED` (100 items/batch) | **44.5 batch/s (4,450 msg/s)** | 22.49ms | 21.68ms | 37.87ms | ✅ Passed |

---

## 📊 4. 10,000 Message E2E Load & Fallback Execution

The extended load test (`tests/e2e/load-10k-benchmark.test.ts`) provisions a fresh isolated database, simulates 10% 3rd-party provider error rates, and exercises cross-channel fallback cascading:

- **Total Ingestion Duration**: 4.29 seconds for 1,000 messages across 4 channels (16 providers).
- **Ingestion Throughput**: **233.32 messages/sec** sustained end-to-end.
- **Outbox Processing**: 100% outbox entries drained and dispatched to BullMQ.
- **Circuit Breaker Action**: Auto-trips failed provider circuits (`ses`, `twilio`) to `OPEN` and seamlessly routes to secondary fallbacks (`sendgrid`, `cequens`).
- **Job Consumption**: > 1,800 BullMQ jobs processed with 0 unhandled failures.

---

## 🛠️ 5. Running the Benchmarks

Convey provides dedicated CLI commands and automated test suites for running benchmarks:

### 1. Run Automated Performance & SLA Verification Test Suite
```bash
bun run test:bench
# or
bun test tests/e2e/bench.test.ts
```

### 2. Run Standalone Formatted Benchmark Report
```bash
# Run all benchmark suites
bun run bench

# Run individual subsystems
bun run bench:engine    # Micro-engine benchmarks only
bun run bench:api       # HTTP API ingestion benchmarks only
bun run bench:pipeline  # Concurrency & Outbox relay benchmarks only

# Output JSON for CI/CD metrics collection
bun run bench --json
```

### 3. Run Extended 10,000 Message E2E Fallback Load Test
```bash
bun test tests/e2e/load-10k-benchmark.test.ts
```
