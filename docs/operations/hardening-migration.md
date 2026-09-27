# Pre-release initialization and recovery

Convey is unreleased. There is no supported upgrade from historical development schemas. Follow the [canonical baseline policy](schema-baseline.md); edit complete CREATE definitions and use fresh disposable development stores. Do not run old backfills, copy old idempotency namespaces, or mix workers from different development revisions.

## Initialize and verify

1. Provision a fresh PostgreSQL 18 database and a fresh Redis-compatible namespace. Never automatically erase an existing database.
2. Configure `DATABASE_URL`, optional `POSTGRES_DB`, `REDIS_URL`, `REDIS_KEY_PREFIX`, authentication, payload encryption secrets, explicit provider pricing and native webhook verification secrets.
3. Run `bun run db:check`, then `bun run db:migrate`. The initializer rejects stale/unmarked installations without changing their data.
4. Create the tenant, then issue keys through `bun apps/server/scripts/create-api-key.ts TENANT_ID TEAM NAME ROLE SCOPE ENVIRONMENT`. Team ownership is enforced when a key is created. Use platform-scoped production credentials only for authorized operators.
5. Start the API, workers, optional plugins and console from the same revision. Initialize the core database before optional plugin tables. Keep database, queue and monitoring ports private.
6. Verify authentication, tenant/environment isolation, key revocation, signed callbacks, sandbox delivery and scoped replay against the fresh schema. Live delivery tests require designated vendor test accounts and recipients.

## Outbox recovery

The relay claims rows as `processing`, commits, then enqueues outside SQL locks. Successful enqueue marks records `processed`; enqueue failure returns them to `pending`. Abandoned claims become eligible after 60 seconds. Deterministic job IDs reduce duplicate work when a process stops between enqueue and acknowledgement.

If oldest-due age grows, inspect queue connectivity and worker logs. Restore connectivity and let the relay reclaim stale leases. Do not mark records processed manually. Compare message outcomes and vendor acceptance before replay. At-least-once queues do not guarantee exactly-once vendor delivery.

## First release boundary

Before the first published release, freeze the verified baseline and establish forward migrations and compatibility guarantees as described in the [release policy](schema-baseline.md#at-the-first-release). Recovery and backup tests remain necessary; supporting older unreleased schemas does not.
