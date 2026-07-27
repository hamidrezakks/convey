# ADR-002: Transactional Outbox Pattern & BullMQ Queueing

- **Status**: Accepted
- **Date**: 2026-08-10

## Context
Message acceptance must be durably stored without risk of message loss if queue brokers fail. Synchronous send acceptance must remain under 15ms.

## Decision
We adopt the **Transactional Outbox Pattern** combined with **BullMQ** queueing:
1. Synchronous send acceptance performs 1 Redis `SET NX` idempotency check + 1 PostgreSQL transaction (`INSERT messages` + `INSERT outbox`).
2. An asynchronous `outbox-relay.worker.ts` polls `outbox` (`FOR UPDATE SKIP LOCKED`) and relays jobs to BullMQ provider queues.
3. Near-term scheduling (<= 30 mins) uses BullMQ delayed jobs; long-term scheduling (> 30 mins) uses PostgreSQL persistent queues.

## Consequences
- Guarantees zero message loss during Redis broker restarts.
- Keeps hot path HTTP acceptance latency sub-15ms.
- Prevents Redis memory bloat from long-scheduled messages.
