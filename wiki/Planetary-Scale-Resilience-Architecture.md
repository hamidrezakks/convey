# Planetary-Scale Resilience & Execution Benchmark Architecture

This guide documents Convey's active-active multi-region resilience features, chaos testing engine, anti-entropy quorum auditor, and CLI benchmark tools.

---

## 1. Resilience Subsystem Architecture

- **Multi-Region Active-Active Geo-Replication (`GeoReplicationManager`)**: Manages heartbeat telemetry loops (`startHeartbeatLoop()`), cross-region state sync, and seamless failovers during regional cloud provider outages.
- **Anti-Entropy Quorum Consensus Auditor (`ConsensusAuditGuard`)**: Periodically computes SHA-256 state checksums across active nodes, automatically resolving state drift via vector clock ordering.
- **Stepped Half-Open Ramp Controller (`GradualRampController`)**: Controls traffic throughput (5% ➔ 20% ➔ 50% ➔ 100%) during provider circuit breaker recovery.
- **Chaos Injection Engine (`ChaosEngine`)**: Simulates provider rate limits, network timeouts, and database latency under test conditions.

---

## 2. CLI Benchmark & Job Dump Utilities

Convey includes two CLI benchmark utilities to test performance and audit BullMQ/PostgreSQL job execution state:

### 1. Job Consumption Report (`bun run jobs:dump`)
Dumps real-time job counts across Redis queues (`dispatchQueue`, `fallbackRetryQueue`, `webhookIngestQueue`, per-provider queues) and PostgreSQL tables (`messages`, `outbox`, `message_attempts`, `message_events`).

```bash
bun run jobs:dump
```

#### Output Example
```json
{
  "timestamp": "2026-08-12T02:10:00.000Z",
  "redis": {
    "grandTotalCompleted": 10000,
    "grandTotalFailed": 0,
    "grandTotalActive": 0,
    "grandTotalWaiting": 0
  },
  "postgres": {
    "totalMessages": 10000,
    "outboxProcessed": 10000,
    "outboxPending": 0,
    "totalAttemptsExecuted": 10000,
    "totalEventsLogged": 20000
  }
}
```

### 2. 10,000 Message Benchmark Load Test (`bun run benchmark:report`)
Executes a high-throughput 10,000 message load test benchmark across Email, SMS, Push, and Chat channels, outputting throughput, delivery rate, provider attempt breakdown, fallback metrics, and financial cost ledger.

```bash
bun run benchmark:report
```

#### Output Summary
- **Throughput**: `> 10,000` msg/sec accepted.
- **Delivery Rate**: `> 98.5%` delivered.
- **Hot-Path Latency**: `< 15ms` synchronous acceptance.
