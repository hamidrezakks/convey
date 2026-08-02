# Convey Horizontal Scaling & High-Availability Guide

Convey is designed to scale horizontally across stateless node replicas while leveraging PostgreSQL time-range partitioning and Redis BullMQ queues.

---

## 1. Stateless API & Worker Scaling

- **Stateless Elysia.js Nodes**: API instances (`bun src/index.ts`) are completely stateless. Traffic can be distributed across nodes using standard Layer 7 load balancers (NGINX, ALB, Envoy).
- **BullMQ Distributed Workers**: Background worker queues automatically distribute job execution across all active Convey nodes.
- **Queue Autoscaler (`src/queues/queue-autoscaler.ts`)**: Dynamically adjusts BullMQ worker concurrency allocations based on queue depth and processing throughput.

---

## 2. Database & Redis Scaling

- **PostgreSQL Declarative Partitioning**: Range partitioning by month (`created_at`) keeps table indexes small, ensures high query pruning, and prevents index bloat.
- **Connection Pooling**: Uses PostgreSQL connection pooling (`postgres` driver) tuned per instance.
- **Redis Cluster Support**: Redis key namespaces use hash tags (`{convey}:...`) to guarantee atomic multi-key LUA script execution across Redis cluster shards.
- **Zero-Trust Encryption Decryption**: Decryption of `_encryptedEnvelope` occurs strictly inside worker node memory, leaving zero decryption load on database instances.
