# V1 contract candidate

Status: pre-release, mock-qualified where test evidence exists. No live-provider certification or public SLA is implied.

## Deployment and supported claims

Qualification currently targets one regional deployment with PostgreSQL 18, Redis-compatible queues, server workers, web console and optional plugins. ARM64 local container tests do not establish AMD64 support, active-active correctness, geographic failover or planetary-scale throughput. The capability inventory records adapter declarations separately from evidence; the initial focused mocks cover Resend and Twilio, with broader existing transport suites retained.

## API and accounting

- Durable acceptance returns 202 and an opaque message ID. Acceptance is not delivery. Query status or consume signed events for subsequent outcomes; keep internal provider, queue and database identifiers private.
- Authentication uses stored role, team, tenant and sandbox scope. Request headers cannot elevate privileges. Platform writes require a platform administrator; tenant and sandbox keys cannot perform them. Missing authentication fails closed in production.
- Idempotency is scoped to team and sandbox/production. Within the default 24-hour retention, identical requests replay their saved response, conflicting payloads return a conflict, and in-progress requests conflict rather than creating a second send. After expiration a reused key may create new work. Queue-store loss invalidates assumptions about retained idempotency evidence.
- Retries are bounded and respect provider throttling. Uncertain acceptance is not proof of rejection; no exactly-once guarantee crosses a third-party network. Intentional replay is a distinct execution and may incur another charge.
- Budget caps govern configured estimates at four decimal places, rounded upward for nonzero estimates. Each reservation pins its currency conversion and UTC month. Hard caps block new positive reservations atomically; free routes remain permitted. Policy reduction cannot reverse prior exposure. Unknown outcomes retain holds until evidenced reconciliation. Sandbox does not consume production budget.
- Webhook consumers must verify the exact signed bytes and deduplicate event identities. Events may be duplicated or arrive out of order. Provider-specific signature schemes and supported receipt events require individual contract coverage; do not infer them from a catalog listing.
- Message states and error shapes are defined in shared contracts and API controllers; generated docs and installed SDK consumer tests must match the candidate. Scheduling is acceptance for future processing, not a promise of exact delivery time.

## First release transition

Until first publication, edit canonical CREATE definitions and require explicitly fresh disposable stores when the baseline changes. Do not ship speculative upgrade migrations or old development-format readers.

For the first release, record the exact baseline fingerprint and tag, supported API/SDK/runtime/provider capabilities, and known limitations. Before the next schema-changing release, introduce an immutable ordered migration ledger anchored to that released baseline, validate the starting fingerprint, and test upgrades from that baseline plus fresh installation. Migration failure must leave a consistent state; choose transactional changes where supported and document restore/rollback handling. Never infer upgrade safety from repeated CREATE IF NOT EXISTS.

Publish compatibility/deprecation windows only after the owner chooses support commitments. A database restore is recovery of a matching baseline, not an upgrade mechanism. Release remains a manual, validated action with dry-run enabled by default.

## Access coverage references

`access-policy.test.ts` exhaustively covers role/scope/method combinations. `hardening/security.test.ts` exercises actual unauthenticated route families, cross-team single/bulk writes and their absence of side effects, message views/receipts, sandbox isolation, DLQ replay, templates/batches, plugins, budget administration, revocation and signed ingress. `tenant-scope.test.ts`, provider-correlation and encrypted-payload tests cover additional internal boundaries. This list is evidence for tested boundaries, not a claim that every possible route combination has been audited.
