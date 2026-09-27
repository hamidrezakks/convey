# Pre-release schema policy

Convey has not had its first release. Package version strings and historical development commits do not establish a released compatibility contract.

## Until the first release

`apps/server/src/db/migrations/` contains the complete current schema, ordered by dependencies. Modify the original CREATE TABLE definition when changing a table; define its constraints and indexes there. Do not add ALTER TABLE patches, data backfills, parallel generated migration histories, or readers for old Convey formats. Keep the Drizzle model, writers, readers, fixtures and documentation consistent. The plugin tables follow the same rule in `apps/plugins/src/db/index.ts`.

Run `bun run db:check` to validate the policy, then `bun run db:migrate` against an empty development/test database. Initialization applies the baseline in one transaction, records its content fingerprint, and creates monthly partitions. Repeating the command with the same baseline is safe. A failed baseline rolls back; partition errors fail the command and can be retried. A nonempty unmarked schema or a changed fingerprint is rejected without modifying existing data.

After changing the schema or persisted message/queue format, stop local producers and workers and explicitly provision a fresh disposable database and queue namespace. The application never drops your database, truncates data, or attempts an upgrade. Preserve any development data you still need separately. Start core schema initialization before optional plugin initialization. No development database was reset as part of this policy change; verification uses task-owned disposable services.

Stored provider credentials require authenticated encrypted envelopes with an explicit key version. Message dispatch requires its encrypted payload. Recipient encryption/revocation IDs use `recipientKeyId(team, recipientId)`; there is no unscoped fallback. Configure the database with `POSTGRES_DB` or the path in `DATABASE_URL`; `DB_NAME` is not a supported alias. Idempotency uses one team/environment-scoped key format.

Encryption-key rotation remains supported because keys can rotate within one release. Vendor protocol normalization, development test mode, browser support and operational failover are current functionality, not compatibility with an earlier Convey release.

## At the first release

The release owner must freeze and tag the validated baseline, introduce a versioned forward-migration runner for subsequent changes, and document the supported API/data compatibility and deprecation policy. Test fresh installation and upgrades from that released baseline. From that point, do not rewrite shipped migrations or remove supported formats without the announced migration/deprecation process.

Releases are manual from `main` and default to dry-run. Merging a PR does not publish a release. Explicitly disable dry-run only when the release owner intends to publish.
