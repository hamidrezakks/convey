# ADR-002: Dual-Layer Scheduling and Transactional Outbox Pattern with BullMQ

- **Status**: Accepted
- **Date**: 2026-08-10
- **Authors**: Convey Principal Architecture Team
- **Deciders**: Systems Engineering, Database Reliability Team

---

## 1. Context & Problem Statement
Notification systems face two major distributed reliability challenges:
1. **Dual-Write Inconsistency**: Writing to a database and publishing to a message broker (Redis/BullMQ) in separate steps risks message loss if the process crashes between writes or if the broker is temporarily unreachable.
2. **Redis Memory Explosion**: Enqueuing millions of long-scheduled messages (e.g. promotional notifications scheduled 3 to 6 months in advance) into Redis delayed sets exhausts expensive in-memory RAM.

---

## 2. Decision Drivers
- **Zero Message Loss Guarantee**: Every accepted message must be durably stored in PostgreSQL before acknowledging HTTP 202.
- **Sub-15ms Hot Path**: Send acceptance must not be blocked by slow message broker network round-trips.
- **Cost-Efficient Long-Term Scheduling**: Long-term scheduled messages must not consume Redis RAM.
- **High-Throughput Multi-Worker Consumption**: Worker nodes must poll outbox records without row-lock contention.

---

## 3. Considered Alternatives
1. **Direct BullMQ Insertion on Send**: Push directly to BullMQ in the HTTP handler. Rejected because broker downtime causes immediate HTTP 500 drop-offs, and long-scheduled jobs bloat Redis RAM.
2. **PostgreSQL LISTEN/NOTIFY**: Use PostgreSQL notify channels. Rejected due to connection scaling limits and lack of built-in rate-limiting/concurrency primitives found in BullMQ.
3. **Kafka / Pulsar Outbox Streaming**: High-throughput log streaming. Rejected due to heavy operational cluster complexity and absence of fine-grained delayed job scheduling.
4. **Dual-Layer Transactional Outbox (PostgreSQL + BullMQ)**: Atomic SQL transaction writes to `messages` and `outbox`; asynchronous `outbox-relay` sweeps with `FOR UPDATE SKIP LOCKED`; horizon-based splitting (<= 30 mins to BullMQ vs > 30 mins in PostgreSQL). **Selected**.

---

## 4. Decision Outcome
We implement the **Dual-Layer Transactional Outbox Pattern**:
1. **Synchronous Fast Path**:
   - Executes 1 Redis `SET NX` idempotency lock.
   - Commits 1 atomic PostgreSQL transaction: `INSERT INTO messages` (AES-256-GCM envelope) and `INSERT INTO outbox` (status: `pending`).
   - Returns HTTP `202 Accepted` with opaque ULID `msg_<ULID>`.
2. **Outbox Relay Worker (`outbox-relay.worker.ts`)**:
   - Polls `outbox` records across consistent-hash virtual shards using `FOR UPDATE SKIP LOCKED`.
   - Messages scheduled `≤ 30 minutes` are enqueued into BullMQ `dispatchQueue` as delayed jobs.
3. **Scheduled Promoter Loop (`scheduled-promoter.worker.ts`)**:
   - Scans PostgreSQL partition indexes for messages crossing the 30-minute threshold and promotes them to BullMQ.

---

## 5. Consequences

### Positive Consequences
- **Zero Data Loss**: Guaranteed durability; un-enqueued records remain safely in PostgreSQL across Redis crashes.
- **Redis Memory Savings**: Reduces Redis memory consumption by **> 80%** by storing long-term schedules in PostgreSQL.
- **Lock-Free Concurrency**: `FOR UPDATE SKIP LOCKED` combined with consistent hashing allows linear worker horizontal scaling without deadlocks.

### Negative Consequences / Mitigations
- **Relay Latency**: Introduces a minor 2ms - 10ms asynchronous relay interval between PostgreSQL outbox commit and BullMQ queue arrival (mitigated by sub-50ms outbox polling loops).
