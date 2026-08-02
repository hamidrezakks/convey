# Convey Database Schema & Architecture Specification

Convey uses **Drizzle ORM** with **PostgreSQL 15+** to maintain durable aggregate state, execution attempts, transactional outbox records, policy rules, and reporting ledgers.

---

## 1. Schema Specifications (12 Tables)

### `messages` Table (Partitioned by `created_at`)
Stores logical message definitions and encrypted envelopes.

- `id` (bigserial, PK): Internal surrogate numeric ID.
- `public_id` (varchar, unique): Opaque ULID (`msg_<ULID>`) returned to API callers.
- `team` (varchar, index): Tenant team boundary.
- `user_id` (varchar, index): Recipient user ID.
- `category` (varchar): Category (e.g. `transactional`, `promotional`).
- `country` (varchar): 2-letter ISO country code.
- `priority` (varchar): Execution priority (`critical`, `high`, `normal`, `low`).
- `state` (varchar): Aggregate state (`accepted`, `scheduled`, `queued`, `sending`, `delivered`, `failed`, `fallback_triggered`, `dlq`).
- `scheduled_at` (timestamp): Execution schedule time.
- `expires_at` (timestamp): Expiration time limit.
- `metadata` (jsonb): Custom metadata containing `_encryptedEnvelope` (AES-256-GCM encrypted recipients and channel bodies).
- `created_at` (timestamp, PK for partition): Creation timestamp.

---

### `message_attempts` Table (Partitioned by `created_at`)
Tracks individual external provider execution attempts across retries, failovers, and fallbacks.

- `id` (bigserial, PK): Internal attempt ID.
- `message_id` (varchar, index): Reference to message public ULID.
- `attempt_no` (integer): Attempt index (1, 2, 3...).
- `channel` (varchar): Execution channel (`email`, `sms`, `push`, `chat`, `tool`).
- `provider_id` (varchar): Internal provider identifier (`ses`, `twilio`, `whatsapp-business`).
- `provider_message_id` (varchar, hidden from API): Provider's internal tracking ID.
- `state` (varchar): Attempt status (`initiated`, `provider_accepted`, `delivered`, `failed`).
- `error_code` / `error_message` (text): Captured provider error detail.
- `duration_ms` (integer): Provider HTTP execution round-trip latency.
- `created_at` (timestamp, PK for partition): Creation timestamp.

---

### `message_events` Table (Partitioned by `occurred_at`)
Append-only audit trail logging all lifecycle events (`message.accepted`, `provider.dispatch`, `message.delivered`, `provider.failover`, `channel.fallback`).

- `id` (bigserial, PK): Audit event ID.
- `message_id` (varchar, index): Message public ULID.
- `type` (varchar): Event type string.
- `channel` (varchar): Channel associated with event.
- `provider_id` (varchar): Provider associated with event.
- `payload` (jsonb): Event contextual metadata.
- `occurred_at` (timestamp, PK for partition): Event timestamp.

---

### `outbox` Table
Transactional outbox table polled by `outbox-relay.worker.ts` (`FOR UPDATE SKIP LOCKED`).

- `id` (bigserial, PK): Outbox record ID.
- `message_id` (varchar, index): Reference to message public ULID.
- `state` (varchar): Outbox state (`pending`, `processing`, `processed`, `failed`).
- `channel` (varchar): Target channel.
- `queue_name` (varchar): Target BullMQ queue name.
- `payload` (jsonb): Minimal metadata for queue dispatch.
- `retry_count` (integer): Relay retry count.
- `created_at` / `updated_at` (timestamp).

---

### `providers` Table
Dynamic provider configurations and encrypted credentials.

- `id` (varchar, PK): Provider ID (`ses`, `sendgrid`, `twilio`, etc.).
- `channel` (varchar): Channel enum (`email`, `sms`, `push`, `chat`, `tool`).
- `enabled` (boolean): Activation status.
- `config` (jsonb): Provider settings (region, weight, rate limits).
- `credentials` (jsonb): Encrypted credential details.
- `created_at` / `updated_at` (timestamp).

---

### `campaigns`, `policies`, `suppressions`, `reports`, `tenants`, `api_keys`, `budget_ledger` Tables
- `campaigns`: State tracking for promotional campaigns (`active`, `paused`, `cancelled`).
- `policies`: Tenant rate-limit and SLA rule definitions.
- `suppressions`: Normalized hashed unsubscribe/bounce suppressions.
- `reports`: Aggregated hourly metric rollups.
- `tenants`: Multi-tenant account boundaries.
- `api_keys`: Hashed team API keys for REST API authentication.
- `budget_ledger`: Partitioned financial ledger tracking unit costs per message and provider.

---

## 2. Time-Range Partitioning Engine

Partitioned tables (`messages`, `message_attempts`, `message_events`, `budget_ledger`) use PostgreSQL declarative time-range partitioning (`PARTITION BY RANGE (created_at / occurred_at)`).

The `ensureMonthlyPartitions()` utility in `src/db/partitions.ts` runs automatically during bootstrap, creating partitions for the current month, previous month, and next two months (e.g. `messages_y2026m08`).

---

## 3. Database Architecture Review Questionnaire Answers

1. **Why do these tables exist?** Each table represents an isolated domain: message aggregate state, attempt tracking, append-only audit events, transactional queue outbox, provider settings, policies, and reporting ledgers.
2. **Which tables are on the request hot path?** Only **`messages`** and **`outbox`** are on the synchronous send acceptance path.
3. **What is the expected write volume?** 1 INSERT to `messages` + 1 INSERT to `outbox` per accepted request.
4. **Expected row count after 1 month / 1 year?** At 100M msg/month: `messages` (100M/mo -> 1.2B/yr), `message_attempts` (120M/mo), `message_events` (250M/mo).
5. **Partitioned or not?** `messages`, `message_attempts`, `message_events`, and `budget_ledger` are time-range partitioned. Small lookup tables are unpartitioned.
6. **Why time-range partitioning?** Prevents index bloat, allows zero-downtime data pruning via `DROP TABLE`, and ensures fast range queries.
7. **Data retention policy?** `outbox` (7 days), `message_events` (90 days), `messages` (1 year), `reports` (permanent).
8. **Critical indexes?** `messages(public_id, created_at)`, `messages(user_id, created_at)`, `message_attempts(message_id, created_at)`, `message_events(message_id, occurred_at)`.
9. **Can Redis cache or replace any access?** Idempotency checks and rate-limiting counters are handled strictly in Redis (`SET NX` and token bucket keys).
10. **Could any table be merged safely?** No. Merging attempts or audit events into `messages` would cause massive write amplification on hot message rows.
