# Convey Horizontal Scaling & High-Availability Architecture Guide

Convey is engineered to scale horizontally across stateless compute nodes while maximizing the I/O efficiency of PostgreSQL 16 range-partitioned storage and Redis 7 cluster topologies.

---

## 1. Multi-Tier Scaling Model

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 LAYER 7 LOAD BALANCERS (ALB / Envoy / NGINX)                     │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ Round-Robin / Least Connections
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             STATELESS ELYSIA.JS API GATEWAY NODES (N Replicas)                   │
│   • CPU: 1 - 2 vCPU per pod      • RAM: 128 MB - 256 MB RSS per pod                              │
│   • Sub-15ms Send Acceptance     • Linear Horizontal Scalability                                 │
└───────────────────────┬──────────────────────────────────────────────────┬───────────────────────┘
                        │                                                  │
                        ▼ (1 PG Transaction)                               ▼ (1 Redis SET NX)
┌───────────────────────────────────────────────┐  ┌───────────────────────────────────────────────┐
│        POSTGRESQL 16 PARTITIONED CLUSTER      │  │             REDIS 7 CLUSTER / SENTINEL        │
│   • PgBouncer / RDS Proxy Connection Pooling  │  │   • Cluster Sharding with `{convey}` HashTags │
│   • Declarative Monthly Range Partitions      │  │   • In-Memory Idempotency & Rate Limiting     │
│   • Write Master + Read Replicas for Reports  │  │   • BullMQ Queue Coordination                 │
└───────────────────────┬───────────────────────┘  └───────────────────────┬───────────────────────┘
                        │                                                  │
                        └────────────────────────┬─────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             DISTRIBUTED BULLMQ WORKER NODES (M Replicas)                         │
│   • QueueAutoscaler (Dynamic Concurrency 1 - 50)  • LeakyBucket Micro-Rate Governors             │
│   • V8 HeapMemoryGuard Backpressure Throttling   • Deficit Round Robin Multi-Tenant Scheduling   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Scaling Specifications

### 2.1 Stateless API Gateways
- **Scaling Metric**: CPU utilization (`> 60%`) or incoming HTTP request rate (`> 8,000 req/sec per node`).
- **Autoscaling Target**: Horizontal Pod Autoscaler (HPA) targeting 2 to 30 replicas.
- **Graceful Termination**: Minimum termination grace period of 15 seconds allows Stage 1 traffic ejection via `/health/readiness` ➔ HTTP 503 before pod SIGKILL.

### 2.2 Distributed Worker Nodes
- **Autoscaling Metric**: BullMQ queue backlog depth (`waiting` jobs) or PostgreSQL outbox lag seconds.
- **Dynamic In-Process Autoscaler (`QueueAutoscaler`)**:
  - Automatically adjusts per-worker concurrency between 1 and 50 based on backlog velocity.
  - Eliminates the need to spawn heavy new container pods during sudden micro-spikes.
- **Event-Loop Traffic Governor**:
  - Automatically sheds non-critical marketing traffic when event loop lag exceeds 50ms, protecting critical transactional notifications.

### 2.3 PostgreSQL Database Tier
- **Connection Management**:
  - Employ **PgBouncer** or **AWS RDS Proxy** in transaction pooling mode.
  - Set Convey instance pool size to 10 - 20 connections per node.
- **Partition Maintenance**:
  - Range partitioning by month ensures individual index trees remain small enough to stay fully cached in PostgreSQL buffer pool memory (`shared_buffers`).
  - Drop historical partitions with zero lock contention (`DROP TABLE messages_y2025m01;`).
- **Read Scaling**:
  - Heavy OLAP aggregations (`src/modules/reports/olap-archiver.ts`) and audit timeline queries query PostgreSQL read replicas.

### 2.4 Redis Cache & Queue Cluster
- **Cluster Sharding**:
  - All BullMQ queue keys and Lua scripts use `{convey}` hash tags, ensuring atomic script execution across Redis cluster nodes.
- **Memory Footprint Optimization**:
  - Dual-layer scheduling keeps messages scheduled `> 30 minutes` out of Redis entirely, reducing Redis RAM requirements by over 80%.

---

## 3. High-Throughput Micro-Batching Pipeline

Inbound webhook receipts and status callbacks from external providers are ingested via `MicroBatchIngestionPipeline` (`src/modules/webhooks/micro-batch-ingestion.ts`):

- **Micro-Batch Sizing**: Flushes up to **500 events** or every **50 milliseconds**.
- **Multi-Row Database Commits**: Replaces 500 individual `INSERT` transactions with a single multi-row `INSERT INTO message_attempts ... VALUES (...), (...), ...`.
- **Benchmark Throughput**: Achieves **> 52,000 events/sec** with less than 45% CPU utilization.

---

## 4. Capacity Planning Matrix

| Monthly Notification Volume | API Gateways | Worker Nodes | PostgreSQL Instance | Redis Cluster |
| :--- | :--- | :--- | :--- | :--- |
| **10 Million msg / month** | 2 × 1 vCPU, 512 MB | 2 × 2 vCPU, 1 GB | 2 vCPU, 8 GB RAM (RDS db.t4g.large) | 1 × 2 GB (Redis 7) |
| **100 Million msg / month** | 4 × 2 vCPU, 1 GB | 6 × 4 vCPU, 2 GB | 8 vCPU, 32 GB RAM (RDS db.r6g.2xlarge) | 3-Node Cluster (6 GB) |
| **1 Billion msg / month** | 12 × 4 vCPU, 2 GB | 18 × 8 vCPU, 4 GB | 32 vCPU, 128 GB RAM (RDS db.r6g.8xlarge) | 6-Node Cluster (16 GB) |
