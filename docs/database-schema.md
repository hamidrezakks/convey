# Convey Database Schema & Architecture Specification

Convey uses **Drizzle ORM** with **PostgreSQL 15+** to maintain durable state, transactional outbox records, execution attempts, append-only audit events, policy definitions, customer webhooks, and financial cost ledgers.

---

## 1. Schema Specifications (16 Tables)

```text
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│         tenants           │      │         api_keys          │      │         policies          │
│ • id (PK)                 │      │ • id (PK)                 │      │ • id (PK)                 │
│ • tier (enterprise/std)   │◄────┤ • team (FK)               │      │ • team (FK)               │
│ • config                  │      │ • key_hash (Index)        │      │ • rate limits, budgets    │
└─────────────┬─────────────┘      └───────────────────────────┘      └───────────────────────────┘
              │
              ▼
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│     messages [PARTITION]  │      │     outbox (Transactional)│      │  message_attempts [PART]  │
│ • id, created_at (PK)     │      │ • id (PK)                 │      │ • id, created_at (PK)     │
│ • public_id (ULID, Index) │◄────┤ • message_id (Index)      │◄────┤ • message_id (Index)      │
│ • team, user_id (Index)   │      │ • state, scheduled_at     │      │ • provider_id, channel    │
│ • _encryptedEnvelope      │      │ • payload (Minimal JSON)  │      │ • duration_ms, error_code │
└─────────────┬─────────────┘      └───────────────────────────┘      └───────────────────────────┘
              │
              ▼
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│   message_events [PART]   │      │         providers         │      │       suppressions        │
│ • id, occurred_at (PK)    │      │ • id (PK: ses, twilio...) │      │ • id (PK)                 │
│ • message_id (Index)      │      │ • channel, enabled        │      │ • recipient_hash (Index)  │
│ • type, payload           │      │ • config, credentials     │      │ • team, channel, reason   │
└───────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘
```

---

### 1.1 Partitioned Core Tables

#### `messages` Table (Partitioned by `created_at`)
Stores logical message definitions, aggregate states, and AES-256-GCM encrypted envelopes.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NOT NULL, Part PK | Internal surrogate identifier. |
| `public_id` | `text` | NOT NULL, Index | Public opaque ULID (`msg_<ULID>`) exposed to callers. |
| `user_id` | `text` | NOT NULL, Index | Recipient identifier in tenant application. |
| `team` | `text` | NOT NULL, Index | Tenant team boundary. |
| `category` | `text` | NOT NULL | Category (`transactional`, `promotional`, `alert`). |
| `country` | `varchar(2)` | NOT NULL | 2-letter ISO 3166-1 alpha-2 country code. |
| `campaign_id` | `text` | NULLABLE | Associated campaign identifier if part of a campaign. |
| `state` | `text` | NOT NULL, Index | Aggregate status (`accepted`, `scheduled`, `dispatched`, `delivered`, `failed`, `expired`, `cancelled`, `bounced`). |
| `priority` | `text` | NOT NULL | Priority level (`critical`, `transactional`, `normal`, `marketing`). |
| `is_sandbox` | `boolean` | NOT NULL (Default: `false`) | When true, provider calls are mocked. |
| `recipients` | `jsonb` | NOT NULL | Normalized recipient metadata. |
| `channels` | `jsonb` | NOT NULL | Channel request configurations. |
| `fallback` | `jsonb` | NULLABLE | Multi-channel fallback rules configuration. |
| `metadata` | `jsonb` | NOT NULL | Contains `_encryptedEnvelope` (AES-256-GCM encrypted PII & body). |
| `scheduled_at` | `timestamptz` | NULLABLE, Index | Execution schedule timestamp. |
| `expires_at` | `timestamptz` | NULLABLE | TTL limit for delivery validity. |
| `cancelled_at` | `timestamptz` | NULLABLE | Cancellation timestamp if cancelled before dispatch. |
| `completedAt` | `timestamptz` | NULLABLE | Terminal delivery timestamp. |
| `created_at` | `timestamptz` | NOT NULL, Part PK | Record insertion timestamp. |
| `updated_at` | `timestamptz` | NOT NULL | Last status update timestamp. |

- **Composite Primary Key**: `(id, created_at)`
- **Indexes**:
  - `idx_messages_public_id_created`: `(public_id, created_at)`
  - `idx_messages_team_created`: `(team, created_at)`
  - `idx_messages_state_created`: `(state, created_at)`
  - `idx_messages_state_scheduled`: `(state, scheduled_at)`
  - `idx_messages_sandbox`: `(team, is_sandbox, created_at)`

---

#### `message_attempts` Table (Partitioned by `created_at`)
Tracks individual provider dispatch attempts across retries, failovers, and fallbacks.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NOT NULL, Part PK | Attempt unique identifier. |
| `message_id` | `text` | NOT NULL, Index | References `messages.public_id`. |
| `attempt_no` | `integer` | NOT NULL | Sequential attempt index (1, 2, 3...). |
| `channel` | `text` | NOT NULL, Index | Channel utilized (`email`, `sms`, `push`, `chat`, `tool`). |
| `provider_id` | `text` | NOT NULL, Index | Adapter ID (`ses`, `twilio`, `whatsapp-business`). |
| `provider_message_id` | `text` | NULLABLE | Internal vendor ID (never exposed to API clients). |
| `origin` | `text` | NOT NULL | Attempt origin (`initial`, `retry`, `provider_failover`, `fallback`). |
| `state` | `text` | NOT NULL | Status (`initiated`, `provider_accepted`, `delivered`, `failed`). |
| `error_code` | `text` | NULLABLE | Normalized error code (`PROVIDER_TIMEOUT`, `RATE_LIMIT`). |
| `error_message` | `text` | NULLABLE | Detailed error response from upstream provider. |
| `duration_ms` | `integer` | NULLABLE | Upstream HTTP round-trip latency in milliseconds. |
| `cost_usd` | `numeric(10,6)`| NULLABLE | Actual financial unit cost incurred. |
| `created_at` | `timestamptz` | NOT NULL, Part PK | Attempt execution timestamp. |

- **Composite Primary Key**: `(id, created_at)`
- **Indexes**: `(message_id, created_at)`, `(provider_id, state, created_at)`, `(channel, state, created_at)`.

---

#### `message_events` Table (Partitioned by `occurred_at`)
Append-only audit trail logging lifecycle milestones.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `text` | NOT NULL, Part PK | Event identifier. |
| `message_id` | `text` | NOT NULL, Index | References `messages.public_id`. |
| `type` | `text` | NOT NULL | Event type (`message.accepted`, `provider.dispatch`, `message.delivered`, `message.opened`, `message.read`, `message.bounced`). |
| `channel` | `text` | NULLABLE | Channel associated with event. |
| `provider_id` | `text` | NULLABLE | Provider associated with event. |
| `payload` | `jsonb` | NOT NULL | Contextual telemetry metadata. |
| `occurred_at` | `timestamptz` | NOT NULL, Part PK | Event occurrence timestamp. |

- **Composite Primary Key**: `(id, occurred_at)`
- **Indexes**: `(message_id, occurred_at)`.

---

#### `budget_ledger` Table (Partitioned by `created_at`)
Monthly partitioned financial ledger tracking per-message unit costs and provider billing reconciliation.

---

### 1.2 Unpartitioned Operational Tables

#### `outbox` Table
High-speed transactional outbox queue polled by `outbox-relay.worker.ts`.
- `id` (`text`, PK): Unique outbox record ID.
- `message_id` (`text`, Index): References `messages.public_id`.
- `state` (`text`, Index): Status (`pending`, `processing`, `processed`, `failed`).
- `type` (`text`): Outbox task type (`message.dispatch`).
- `channel` (`text`): Target channel.
- `priority` (`text`): Priority queue classification.
- `queue_name` (`text`): Target BullMQ queue.
- `payload` (`jsonb`): Minimal metadata required for queue dispatch.
- `scheduled_at` (`timestamptz`, Index): Schedule timestamp.
- `retry_count` (`integer`): Outbox relay retry counter.
- `locked_at` / `locked_by`: Concurrency lock tracking for worker instances.
- `created_at` / `updated_at`: Timestamps.

#### `providers` Table
Dynamic provider configurations and encrypted credentials.
- `id` (`text`, PK): Provider ID (`ses`, `twilio`, `resend`, `fcm`, etc.).
- `channel` (`text`, Index): Channel type enum.
- `name` (`text`): Display name.
- `enabled` (`boolean`, Index): Active routing status.
- `weight` (`integer`): Load balancing weight (1 - 100).
- `config` (`jsonb`): Rate limits, regional endpoints, circuit thresholds.
- `credentials` (`jsonb`): AES-encrypted API keys and secrets.

#### `policies` Table
Tenant SLA, rate-limiting, and financial budget policies.
- `id` (`text`, PK)
- `team` (`text`, Index): Tenant boundary.
- `channel` (`text`): Channel scope.
- `rate_limit_window_seconds` / `rate_limit_max_requests`: Rate limit rules.
- `budget_limit_usd` / `budget_period`: Financial spend caps.
- `quiet_hours_enabled` / `quiet_hours_start` / `quiet_hours_end`: Recipient STO quiet hours.
- `sla_target_ms`: P95 delivery latency target.

#### `suppressions` Table
Normalized hashed suppression entries (unsubscribes, bounces, complaints).
- `id` (`text`, PK)
- `team` (`text`, Index): Tenant boundary (or `'global'`).
- `recipient_hash` (`text`, Index): SHA-256 hash of recipient email/phone.
- `recipient_masked` (`text`): Masked string for audit displays (`a***@example.com`).
- `channel` (`text`): Channel scope.
- `reason` (`text`): Reason (`unsubscribe`, `hard_bounce`, `complaint`, `manual`).

#### `batches` & `campaigns` Tables
- `batches`: Batch job progress (`total_count`, `processed_count`, `success_count`, `failed_count`, `status`).
- `campaigns`: Marketing and promotional campaign groupings.

#### `webhook_subscriptions` & `webhook_deliveries` Tables
- `webhook_subscriptions`: Customer endpoint registrations, HMAC signing secrets, and event filters.
- `webhook_deliveries`: Delivery attempt logs, HTTP response codes, and round-trip latencies.

#### `reports`, `tenants`, `api_keys`, `audit_logs` Tables
- `reports`: Hourly OLAP metric rollups (`count`, `total_duration_ms`, `bucket_hour`).
- `tenants`: Multi-tenant account metadata and tier classifications.
- `api_keys`: SHA-256 hashed API keys for REST authentication.
- `audit_logs`: Administrative actions log.

---

## 2. Declarative Range Partitioning Engine

Partitioned tables use PostgreSQL declarative time-range partitioning (`PARTITION BY RANGE (created_at / occurred_at)`).

### Automatic Partition Maintenance (`ensureMonthlyPartitions`)
The `ensureMonthlyPartitions()` routine in `src/db/partitions.ts` runs automatically during bootstrap and as a scheduled background maintenance loop. It ensures that partitions exist for:
- Current Month (e.g. `messages_y2026m08`)
- Previous Month (e.g. `messages_y2026m07`)
- Next 2 Future Months (e.g. `messages_y2026m09`, `messages_y2026m10`)

### Mandatory Partition Pruning Rule
Every query against partitioned tables (`messages`, `message_attempts`, `message_events`) must supply timestamp boundaries to enable **PostgreSQL Partition Pruning**:
```typescript
import { computePartitionWindow } from './partitions';

const { startDate, endDate } = computePartitionWindow(messageId);
await db.select().from(messages).where(
  and(
    eq(messages.publicId, messageId),
    gte(messages.createdAt, startDate),
    lte(messages.createdAt, endDate)
  )
);
```

---

## 3. Database Architecture Review Questionnaire Answers

1. **Why do these tables exist?** Each table encapsulates a distinct, decoupled domain: aggregate message state, provider execution attempts, append-only audit events, transactional queue outbox, provider settings, policies, suppression lists, and customer webhook deliveries.
2. **Which tables are on the synchronous send hot path?** Strictly **`messages`** and **`outbox`** (inside a single PostgreSQL transaction).
3. **What is the expected write volume?** 1 INSERT to `messages` + 1 INSERT to `outbox` per accepted message request.
4. **Expected row count after 1 month / 1 year?** At 100M messages/month: `messages` (100M/mo ➔ 1.2B/yr), `message_attempts` (120M/mo), `message_events` (250M/mo).
5. **Why declarative time-range partitioning?** Prevents B-Tree index bloat on high-volume tables, keeps working sets resident in memory, and allows instant zero-downtime data pruning via `DROP TABLE`.
6. **Data retention policy?** `outbox` (7 days), `message_events` (90 days), `messages` (1 year), `reports` (permanent).
7. **Critical indexes?** `messages(public_id, created_at)`, `messages(user_id, created_at)`, `message_attempts(message_id, created_at)`, `outbox(state, scheduled_at, priority)`.
8. **Can Redis cache or replace any database access?** Idempotency reservations (`SET NX`), active WhatsApp 24h conversation windows, and rate limit counters are handled in Redis to eliminate SQL load.
9. **Could any table be merged safely?** No. Merging attempts or audit logs into `messages` would cause severe row-lock contention and write amplification on hot message records.
