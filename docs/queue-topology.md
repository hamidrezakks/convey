# Convey Queue Topology & Worker Execution Architecture

Convey uses **BullMQ** over Redis (`ioredis`) for near-term message dispatching, queue autoscaling, and provider execution, coupled with **PostgreSQL** for long-term scheduling (> 30 minutes).

---

## 1. Queue Infrastructure Topology

```text
                           ┌─────────────────────────────────────┐
                           │      Transactional Outbox (PG)      │
                           └──────────────────┬──────────────────┘
                                              │ (outbox-relay worker)
                                              ▼
                           ┌─────────────────────────────────────┐
                           │      dispatchQueue ({convey})       │
                           └──────────────────┬──────────────────┘
                                              │ (message-dispatch worker)
                                              ▼
               ┌──────────────────────────────┼──────────────────────────────┐
               ▼                              ▼                              ▼
  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
  │ bull:provider-send-ses   │  │ bull:provider-send-twilio│  │ bull:provider-send-fcm   │
  └────────────┬─────────────┘  └────────────┬─────────────┘  └────────────┬─────────────┘
               │                             │                             │
               ▼                             ▼                             ▼
       (provider-send)               (provider-send)               (provider-send)
               │                             │                             │
               └──────────────────────────────┼──────────────────────────────┘
                                              │
                                     (on attempt failure)
                                              ▼
                           ┌─────────────────────────────────────┐
                           │   fallbackRetryQueue ({convey})     │
                           └─────────────────────────────────────┘
```

---

## 2. Queue Definitions

All queues use Redis key isolation under prefix `{convey}` to ensure atomic multi-key LUA script execution on Redis cluster setups.

1. **`dispatchQueue` (`{convey}:message-dispatch`)**:
   - Main queue accepting messages from `outbox-relay.worker.ts`.
   - Handled by `message-dispatch.worker.ts`, which performs smart routing, policy checks, and dispatches to specific provider queues.

2. **Per-Provider Send Queues (`{convey}:provider-send-<providerId>`)**:
   - Isolated queue per active provider (e.g. `bull:provider-send-ses`, `bull:provider-send-twilio`, `bull:provider-send-whatsapp-business`).
   - Ensures provider rate limits, circuit breaker isolations, and adapter executions are completely sandboxed.

3. **`fallbackRetryQueue` (`{convey}:fallback-retry`)**:
   - Handles failed attempts requiring same-channel failovers or cross-channel fallbacks.

4. **`webhookIngestQueue` (`{convey}:webhook-ingest`)**:
   - Micro-batches incoming provider webhook callbacks and status receipts before committing to database event tables.

---

## 3. Dual-Layer Multi-Tenant Scheduling

To prevent Redis key explosion from long-scheduled messages (e.g. promotional messages scheduled 6 months in advance), Convey uses a **dual-layer scheduling algorithm**:

- **BullMQ Horizon (`<= 30 minutes`)**: Messages scheduled within 30 minutes (`env.BULLMQ_SCHEDULING_HORIZON_SECONDS`) are pushed directly to BullMQ as delayed jobs (`delay: scheduledAt - now`).
- **PostgreSQL Persistence (`> 30 minutes`)**: Messages scheduled beyond 30 minutes remain stored in PostgreSQL `messages` and `outbox` tables.
- **Scheduled Promoter Loop (`scheduled-promoter.worker.ts`)**: Runs every 10 seconds, polling PostgreSQL for messages entering the 30-minute window and promoting them into BullMQ.

---

## 4. Background Worker Loops (7 Workers)

1. `outbox-relay.worker.ts`: Polls `outbox` table (`SKIP LOCKED`), dispatches to BullMQ.
2. `message-dispatch.worker.ts`: Routes messages from `dispatchQueue` to provider queues.
3. `provider-send.worker.ts`: Executes provider adapters, decrypts envelopes, handles circuit breakers.
4. `fallback-retry.worker.ts`: Evaluates fallback rules and re-queues failover attempts.
5. `callback.worker.ts`: Updates message attempt statuses upon callback arrival.
6. `webhook-ingest.worker.ts`: Processes micro-batched webhook delivery receipts.
7. `scheduled-promoter.worker.ts`: Promotes long-scheduled messages from PostgreSQL to BullMQ.

---

## 5. Queue Autoscaler & Monitoring

- **`QueueAutoscaler` (`src/queues/queue-autoscaler.ts`)**: Monitors queue backlog depths and ingestion rates, dynamically adjusting worker concurrency allocations.
- **Job Consumption Dump Utility (`bun run jobs:dump`)**: Dumps current BullMQ Redis key counts, job states (completed, failed, active, waiting), and PostgreSQL outbox stats.
