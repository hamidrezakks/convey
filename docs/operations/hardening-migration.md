# Hardening migration and recovery runbook

## Release prerequisites

Do not promote this branch while the required legacy regression checks fail. Resolve the failures listed in [verification](hardening-verification.md), then run a release dry run against isolated services. Assign a deployment owner and a rollback owner; record the image digests, database snapshot, key identifiers and signing-gateway configuration.

This changes access behavior: authentication becomes the default, platform operations require explicit scope, teams cannot be shared between tenants, sandbox keys lose shared configuration access, and unsigned callbacks are rejected.

## Before migration

1. Take PostgreSQL and queue-store backups and test restoration into an isolated environment. Preserve encryption/signing secrets separately. Confirm retention, disk capacity and credentials for recovery.
2. Inventory active keys, owning tenants, globally used team IDs and historical messages. Check ambiguity:

   ```sql
   SELECT team, count(DISTINCT tenant_id)
   FROM api_keys GROUP BY team HAVING count(DISTINCT tenant_id) > 1;
   ```

   Resolve each collision with its owners before migration. Renaming a team requires a coordinated migration of messages, outbox payloads, policies, keys and queue/idempotency state; do not rename only the key.
3. Inventory historical teams without keys and reserve their ownership manually after verifying the owner. Migration backfills from API keys only; it cannot infer ownership of orphan historical data. Do not allow newly issued keys to claim those identifiers accidentally.
4. Configure a trusted webhook gateway and test native vendor verification plus Convey signing. Set `CONVEY_WEBHOOK_SECRET` or provider-specific secrets on the server. Direct unsigned callbacks will stop working after deployment.
5. Check subscribers and plugin preference duplicates before startup. Preferences now use `(tenant_id, team, recipient_id)` uniqueness; validate existing rows and consumers against team-scoped behavior.

## Apply and verify

1. Enter a maintenance window. Pause producers and stop old API/worker processes; mixed versions retain old authorization and outbox semantics. Keep durable stores intact.
2. Run `bun run db:migrate` with the intended database configuration. The runner applies canonical migrations; do not recreate tables from ad hoc test setup.
3. Confirm migrations 0020 (key role/scope/sandbox), 0021 (team ownership) and 0022 (outbox claim index) completed. Migration 0021 rejects ambiguous teams. Existing keys default to DEVELOPER and tenant scope.
4. Reserve verified historical team ownership in `team_owners` before allowing new key creation. Ownership rows survive key deletion. Review these rows as privileged database configuration.
5. Create replacement/operator credentials through `bun apps/server/scripts/create-api-key.ts TENANT_ID TEAM NAME ROLE SCOPE ENVIRONMENT`. The tenant must already exist and be active. Use `ORG_ADMIN platform production` for a write-capable operator; use tenant scope for applications. Save the one-time secret securely and record only key IDs in the rollout log.
6. Set `CONVEY_REQUIRE_AUTH=true`, independent infrastructure credentials and `PAYLOAD_ENCRYPTION_KEY`. Production refuses the auth bypass. Pass provider-specific webhook secrets explicitly through your deployment when using them.
7. Start the new API, workers, plugins and console. Configure console upstreams with internal service URLs. Plugins authenticate through `CONVEY_API_INTERNAL_URL`. Expose HTTPS through the deployment gateway and keep database/queue/monitoring ports private.
8. Check liveness/readiness and operational metric availability. Verify no-key requests fail; a tenant key cannot call administration or read another team's message; a sandbox key cannot read production messages; revoked keys fail immediately.
9. Verify one signed callback reaches the durable queue, a modified body fails, and duplicate delivery does not add another job. Confirm a sandbox message's acceptance, status and scoped replay. Test actual provider delivery separately using designated test accounts before resuming producers.
10. Sign into the production-built console, inspect inbox access, sign out and reload. Monitor HTTP errors, outbox age and delivery failures during gradual traffic restoration.

## Outbox recovery

The relay claims rows as `processing`, commits the SQL transaction, then enqueues without holding SQL locks. Successful enqueue marks rows `processed`. Enqueue failure returns them to `pending`; abandoned processing claims become eligible after 60 seconds. Deterministic job IDs reduce duplicate work when a process stops between enqueue and acknowledgement.

If oldest-due age grows, check queue connectivity and worker logs first. Restore queue access, then allow the relay to reclaim stale leases. Do not mark records processed manually to make the dashboard green. Compare message outcomes and queue state before replaying. DLQ replay is limited to failed messages in the caller's team/environment and writes a new pending outbox entry atomically; concurrent replay should have a single winner.

At-least-once queue behavior does not guarantee exactly-once external vendor delivery. Keep provider idempotency and callback reconciliation in the recovery procedure.

## Rollback

Stop producers and workers before rollback. Prefer a forward fix or restore a known snapshot into isolated services first. The old application does not enforce the new boundaries; restarting it against public traffic reopens them. Keep access restricted while restoring the previous application and database/queue state together. Account for sends already accepted by vendors before any replay.

Do not automatically drop ownership constraints or new columns. Database restore loses changes since the snapshot; reconcile accepted messages and provider outcomes before reopening traffic. Rotate exposed credentials if the rollback involved a security incident.
