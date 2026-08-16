# Convey Queue Topology & Worker Execution Architecture

Convey employs a hybrid execution topology combining **PostgreSQL Transactional Outbox** (for durable multi-shard persistence and long-term scheduling) with **BullMQ over Redis 7+** (for sub-millisecond dispatching, autoscaling, and isolated per-provider sandboxes).

---

## 1. Queue Infrastructure Topology

```text
                               ┌─────────────────────────────────────────┐
                               │        Transactional Outbox (PG)        │
                               │   (Consistent-Hash Virtual Sharding)    │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼ (outbox-relay.worker.ts)
                               ┌─────────────────────────────────────────┐
                               │      dispatchQueue ({convey})           │
                               │        {convey}:message-dispatch        │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼ (message-dispatch.worker.ts)
                               ┌─────────────────────────────────────────┐
                               │  Deficit Round Robin Multi-Tenant Flow  │
                               │  PolicyEngine & SmartProviderRouter     │
                               └────────────────────┬────────────────────┘
                                                    │
                 ┌──────────────────────────────────┼──────────────────────────────────┐
                 ▼                                  ▼                                  ▼
    ┌──────────────────────────┐       ┌──────────────────────────┐       ┌──────────────────────────┐
    │ {convey}:provider-send   │       │ {convey}:provider-send   │       │ {convey}:provider-send   │
    │          -ses            │       │         -twilio          │       │    -whatsapp-business    │
    └────────────┬─────────────┘       └────────────┬─────────────┘       └────────────┬─────────────┘
                 │ (provider-send)                  │ (provider-send)                  │ (provider-send)
                 ▼                                  ▼                                  ▼
         ┌───────────────┐                  ┌───────────────┐                  ┌───────────────┐
         │ AWS SES v2    │                  │ Twilio API    │                  │ Meta Cloud API│
         └───────┬───────┘                  └───────┬───────┘                  └───────┬───────┘
                 │                                  │                                  │
                 └──────────────────────────────────┼──────────────────────────────────┘
                                                    │
                                         (On Transient / Fallback)
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │       {convey}:fallback-retry           │
                               │      (fallback-retry.worker.ts)         │
                               └─────────────────────────────────────────┘
```

---

## 2. Queue Definitions & Redis Cluster Hash Tagging

All BullMQ queue names utilize Redis cluster hash tags `{convey}`. This guarantees that all multi-key Lua scripts execute on the same Redis cluster shard without `CROSSSLOT` errors:

| Queue Name | Redis Key Pattern | Primary Producer | Primary Consumer | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`dispatchQueue`** | `{convey}:message-dispatch` | `outbox-relay.worker.ts` | `message-dispatch.worker.ts` | Central orchestration queue for policy evaluation, DRR scheduling, and provider selection. |
| **`providerSendQueue`** | `{convey}:provider-send-<providerId>` | `message-dispatch.worker.ts` | `provider-send.worker.ts` | Dedicated queue per provider (e.g. `bull:provider-send-ses`). Sandboxes rate limits and circuit breakers. |
| **`fallbackRetryQueue`** | `{convey}:fallback-retry` | `provider-send.worker.ts` | `fallback-retry.worker.ts` | Evaluates same-channel provider failovers and cross-channel waterfall cascades. |
| **`webhookIngestQueue`**| `{convey}:webhook-ingest` | API Gateway (`/v1/webhooks`) | `webhook-ingest.worker.ts` | Ingests micro-batched provider delivery receipts and bounce events. |
| **`customerWebhookQueue`**| `{convey}:customer-webhook-dispatch` | `webhook-ingest.worker.ts` | `customer-webhook-dispatch.worker.ts` | Dispatches HMAC-signed delivery receipts to customer webhook URLs. |
| **`callbackQueue`** | `{convey}:callback` | `provider-send.worker.ts` | `callback.worker.ts` | Updates message attempt statuses upon asynchronous callback arrival. |

---

## 3. Background Worker Loops (8 Dedicated Workers)

Convey runs 8 background worker loops, each isolated to prevent head-of-line blocking:

### 1. `outbox-relay.worker.ts`
- Polls PostgreSQL `outbox` table using `FOR UPDATE SKIP LOCKED`.
- Distributes read cursors across virtual shards using `ConsistentHashShardRouter` to eliminate database row-lock contention.
- For immediate execution (`scheduled_at <= NOW() + 30m`), enqueues job into `dispatchQueue`.
- For long-term scheduled items (`> 30m`), leaves in PostgreSQL for `scheduled-promoter.worker.ts`.

### 2. `message-dispatch.worker.ts`
- Pulls from `dispatchQueue`.
- Evaluates `MultiTenantPriorityScheduler` (Deficit Round Robin) to guarantee fair execution quanta across tenant tiers.
- Verifies team rate limits, quiet hours (STO), suppression lists, and budgets.
- Resolves optimal provider via `SmartProviderRouter` based on real-time EMA latency scores.
- Routes job to the targeted provider's dedicated send queue (`{convey}:provider-send-<providerId>`).

### 3. `provider-send.worker.ts`
- Pulls from per-provider sandboxed queue.
- Decrypts `_encryptedEnvelope` in worker process memory.
- Checks `ProviderCircuitBreaker` and `LeakyBucketGovernor`.
- If WhatsApp channel, executes `WhatsAppSessionInterceptor` (evaluates 24h active conversation window and applies $0.00 text transformation).
- Executes provider adapter using `HedgedExecutor`.
- Records immutable result in `message_attempts` and writes lifecycle event to `message_events`.

### 4. `fallback-retry.worker.ts`
- Pulls failed attempts from `fallbackRetryQueue`.
- Categorizes error (transient vs terminal).
- Executes same-channel backup provider or evaluates message `fallback.rules` for cross-channel cascade.
- If all attempts are exhausted, transitions message to DLQ.

### 5. `scheduled-promoter.worker.ts`
- Runs every 10 seconds.
- Queries PostgreSQL index `idx_messages_state_scheduled` for messages entering the 30-minute BullMQ horizon (`scheduled_at <= NOW() + INTERVAL '30 minutes'`).
- Atomically promotes them into BullMQ as delayed jobs (`delay = scheduled_at - NOW()`).

### 6. `webhook-ingest.worker.ts`
- Consumes micro-batched provider webhook events from `webhookIngestQueue`.
- Updates `message_attempts` status and logs `message_events`.
- Triggers 24h WhatsApp session recording in Redis upon inbound message receipts.

### 7. `customer-webhook-dispatch.worker.ts`
- Dispatches signed HTTP POST delivery receipts to tenant-configured webhook endpoints with full-jitter exponential backoff.

### 8. `callback.worker.ts`
- Processes asynchronous delivery confirmations from long-polling or polling provider mechanisms.

---

## 4. Dual-Layer Hybrid Scheduling Horizon

To prevent Redis memory bloat from long-scheduled messages (e.g. promotional notifications scheduled months in advance), Convey uses a **30-minute scheduling horizon**:

```text
[Message Ingestion]
        │
        ├── scheduledAt <= 30 Minutes ──► [BullMQ Delayed Job (Microsecond Precision)]
        │
        └── scheduledAt > 30 Minutes  ──► [PostgreSQL Partitioned Ledger (Zero Redis Memory)]
                                                        │
                                                        ▼ (At T - 30 Minutes)
                                          [scheduled-promoter.worker.ts Promotes to BullMQ]
```

---

## 5. Adaptive Queue Autoscaler & Concurrency Control

- **`QueueAutoscaler` (`src/queues/queue-autoscaler.ts`)**:
  - Dynamically monitors queue backlog depths and ingestion rates.
  - Automatically scales worker concurrency between `minConcurrency` (1) and `maxConcurrency` (50) without process restarts:
    $$\text{Concurrency} = \min\left(\text{maxConcurrency}, \max\left(\text{minConcurrency}, \left\lceil \frac{\text{Queue Depth}}{\text{Autoscale Factor}} \right\rceil\right)\right)$$
- **Real-Time Job Inspection (`bun run jobs:dump`)**:
  - Dumps real-time counts of active, waiting, completed, and failed jobs across all Redis queues alongside PostgreSQL outbox status.
