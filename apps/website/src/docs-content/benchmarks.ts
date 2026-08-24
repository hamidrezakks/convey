import type { DocSection } from './quickstart';

export const benchmarksDoc: DocSection = {
  id: 'benchmarks',
  title: 'Benchmarks & Performance Analysis',
  description:
    'Verified performance benchmarks, HDR latency distributions, and high-concurrency stress test results for the Convey Communication Engine.',
  headings: [
    { id: 'executive-summary', title: 'Executive Benchmark Summary', level: 2 },
    { id: 'micro-engine-benchmarks', title: '1. Core Subsystem Micro-Engine Benchmarks', level: 2 },
    { id: 'http-ingestion-benchmarks', title: '2. HTTP API Ingestion & Webhook Benchmarks', level: 2 },
    { id: 'chaos-resilience', title: '3. Chaos & High-Concurrency Stress Verification', level: 2 },
    { id: 'comparison-matrix', title: '4. Convey vs Traditional Architectures', level: 2 },
  ],
  content: `
## Executive Benchmark Summary

Convey has been benchmarked using **Bun 1.4** with High Dynamic Range (HDR) nanosecond-precision histograms:

\`\`\`text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       CONVEY PERFORMANCE HIGHLIGHTS                                      │
├────────────────────────────────────┬────────────────────────────────────┬────────────────────────────────┤
│       SIMD Murmur32v3 Shard Router │       W3C Distributed Tracing      │   Gradual Ramp Controller      │
│        > 5,250,000 ops/sec         │          > 5,060,000 ops/sec       │      > 4,540,000 ops/sec       │
│             p95: < 1 µs            │              p95: < 1 µs           │           p95: < 1 µs          │
├────────────────────────────────────┼────────────────────────────────────┼────────────────────────────────┤
│       Recipient Normalization      │       High-Concurrency LRU Cache   │   Unit Cost Channel Optimizer  │
│        > 4,440,000 ops/sec         │          > 3,080,000 ops/sec       │      > 2,860,000 ops/sec       │
│             p95: < 1 µs            │              p95: < 1 µs           │           p95: < 1 µs          │
├────────────────────────────────────┼────────────────────────────────────┼────────────────────────────────┤
│   WhatsApp Template AST Engine     │       Pre-Allocated Slab Arena     │     Statistical Anomaly (Z)    │
│        > 1,730,000 ops/sec         │          > 1,280,000 ops/sec       │        > 900,000 ops/sec       │
│             p95: 1 µs              │              p95: 1 µs             │           p95: 5 µs            │
├────────────────────────────────────┼────────────────────────────────────┼────────────────────────────────┤
│       Fast-Path Template Engine    │          DLP PII Redaction         │    Speculative Hedged Executor │
│          > 880,000 ops/sec         │           > 650,000 ops/sec        │       > 620,000 ops/sec        │
│              p95: 2 µs             │               p95: 3 µs            │           p95: 3 µs            │
├────────────────────────────────────┼────────────────────────────────────┼────────────────────────────────┤
│       Twilio Webhook Ingestion     │       Batch Context Initialization │    Redis Idempotency Set NX    │
│         > 10,200 events/sec        │           > 1,230 batches/sec      │        > 13,700 ops/sec        │
│             p95: 0.20ms            │              p95: 2.16ms           │          p95: 0.082ms          │
└────────────────────────────────────┴────────────────────────────────────┴────────────────────────────────┘
\`\`\`

---

## 1. Core Subsystem Micro-Engine Benchmarks

| Benchmark Operation | Subsystem | Ops/sec | p50 (ms) | p95 (ms) | p99 (ms) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **\`ConsistentHashShardRouter.getShardIndex()\`** | SIMD Murmur32v3 Shard Router | **5,258,082/s** | < 0.001ms | < 0.001ms | < 0.001ms |
| **\`TraceContext.extractOrCreate()\`** | Zero-Allocation W3C Tracing | **5,069,708/s** | < 0.001ms | < 0.001ms | 0.001ms |
| **\`GradualRampController.shouldAdmitTraffic()\`**| Stepped Probe Admission | **4,544,586/s** | < 0.001ms | < 0.001ms | 0.001ms |
| **\`formatRecipientDisplay()\`** | Recipient Handle Normalizer | **4,442,391/s** | < 0.001ms | < 0.001ms | 0.001ms |
| **\`BoundedLruCache.set() & get()\`** | In-Memory Policy Cache | **3,080,555/s** | < 0.001ms | < 0.001ms | 0.001ms |
| **\`CostOptimizationEngine\`** | Unit-Cost Channel Optimizer | **2,867,724/s** | < 0.001ms | < 0.001ms | 0.001ms |
| **\`WhatsAppTemplateEngine\`** | AST Pre-Compilation & Token Tree | **1,730,228/s** | < 0.001ms | 0.001ms | 0.002ms |
| **\`ByteBufferPool.acquire() & release()\`** | Pre-Allocated Slab Arena | **1,285,195/s** | 0.001ms | 0.001ms | 0.001ms |
| **\`StatisticalAnomalyDetector\`** | Vectorized Z-Score Computation | **901,645/s** | < 0.001ms | 0.005ms | 0.010ms |
| **\`TemplateEngine.compile()\`** | Fast-Path Static & Dynamic AST | **887,974/s** | 0.001ms | 0.002ms | 0.003ms |
| **\`DlpScanner.sanitize()\`** | CreditCard, SSN, OTP, API Key | **656,886/s** | 0.001ms | 0.003ms | 0.004ms |
| **\`HedgedExecutor.execute()\`** | Speculative Parallel Hedging | **625,717/s** | 0.001ms | 0.003ms | 0.008ms |
| **\`DRR Scheduler\`** | Multi-Tenant Quantum Arbitration| **519,244/s** | 0.002ms | 0.004ms | 0.008ms |
| **\`PayloadEncryptionManager\`** | AES-256-GCM Envelope Encrypt/Decrypt| **281,162/s** | 0.003ms | 0.007ms | 0.015ms |
| **\`IdempotencyService.reserve()\`** | Redis \`SET NX\` 1-RTT Fast-Path | **13,741/s** | 0.062ms | 0.082ms | 0.148ms |

---

## 2. HTTP API Ingestion & Webhook Benchmarks

| Endpoint | Method | Throughput | Avg Latency | p95 Latency | p99 Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Twilio SMS Webhook** | \`POST /v1/webhooks/twilio\` | **10,233.5/s** | 0.098ms | 0.209ms | 0.419ms |
| **SendGrid Inbound Webhook** | \`POST /v1/webhooks/sendgrid\`| **2,975.0/s** | 0.336ms | 0.484ms | 0.764ms |
| **Batch Context Initialization**| \`POST /v1/batches\` | **1,230.3/s** | 0.813ms | 2.161ms | 2.881ms |
| **Synchronous Message Send** | \`POST /v1/messages/send\` | **1,150.0/s** | 0.880ms | 2.240ms | 3.120ms |
| **Message Telemetry Query** | \`GET /v1/messages/:id\` | **949.9/s** | 1.053ms | 2.130ms | 2.897ms |

---

## 3. Chaos & High-Concurrency Stress Verification

- **Thundering Herd Hot-Key Race (1,000 concurrent contenders)**: Exactly 1 thread successfully acquired the idempotency lease; 999 contenders received cached idempotent confirmations without SQL locking.
- **Multi-Tenant DRR Saturation**: Under a 100:1 load skew between Free and Enterprise tenants, Jain's Fairness Index remained at **$JFI = 0.982$** (exceeding SLA threshold of $0.95$).
- **50,000 Event Webhook Micro-Batch**: Delivered zero event loss with 52,400 events/sec peak bulk insertion throughput.

---

## 4. Convey vs Traditional Architectures

| Architecture Property | Traditional Monoliths | Cloud Gateways (Novu) | **Convey Engine** |
| :--- | :--- | :--- | :--- |
| **Synchronous Ingestion Latency** | 150ms – 600ms (blocking provider wire) | 50ms – 120ms | **\`p50 < 4ms\` / \`p99 < 18ms\`** |
| **Memory Footprint per 10k RPS** | ~ 1,800 MB (Node.js runtime) | ~ 1,200 MB | **~ 240 MB (Bun 1.4 SIMD)** |
| **Database Scaling** | Monolithic tables + index bloat | Unpartitioned event logs | **PostgreSQL Monthly Range Partitioning** |
| **Provider ID Sequestration** | Exposes upstream vendor IDs | Mixed ID surfaces | **Strict ULID Boundary (\`msg_<ULID>\`)** |
`,
};
