# Mock-qualified operational runbook

Owner role: convey-operator. Assign an actual on-call owner before deployment. Rule names and thresholds are in `prometheus-rules.yml`; they are starting thresholds, not customer SLAs. Scrape job must be named `convey` or the missing-target rules must be adjusted consistently.

| Alert | Investigation and action | Resolution |
| --- | --- | --- |
| ConveyApiErrors | Inspect route-level 5xx rates and redacted errors; check PostgreSQL/queue connectivity. Restore dependencies or stop accepting traffic if durable acceptance is unavailable. | Error ratio below 5% for the evaluation window |
| ConveyAcceptanceLatency | Inspect acceptance histogram, connection saturation and database/queue latency. Reduce admitted concurrency before adding capacity. Never disable accounting checks to improve latency. | p95 below 500ms; separately assess proposed 250ms qualification target |
| ConveyRelayBacklog | Inspect due/processing outbox rows, available_at and locked_at, queue availability and worker readiness. Restore queue access; expired claims are retried with deterministic job IDs. | Oldest due age <=60 seconds |
| ConveyDeliveryFailures | Inspect failed states, provider errors and account configuration; distinguish accepted-but-unknown requests from confirmed rejection before replay. | Failure ratio below threshold and backlog accounted for |
| ConveyProviderCircuitOpen | Check provider-specific errors and credentials. Use mock verification for local drills; require provider evidence before restoring live traffic. | Process-local circuit closes and work resumes |
| ConveyMetricsUnavailable | Check DB connectivity, statement timeout and schema baseline. Previous gauge values are stale; never interpret them as current health. | availability gauge returns to 1 |
| ConveyStaleBudgetHolds | List holds in the Policies console, correlate each with provider evidence, then use audited commit/release reconciliation. Never delete holds or free uncertain spend. | No holds older than one hour; newly created uncertainty still requires investigation |
| ConveyScrapeUnavailable | Verify target discovery, service readiness and network access. Missing targets are not healthy. | Target present and up=1 |
| ConveyMetricsMissing | Check correct metrics endpoint, application version and collector registration. | Operational availability series present for each target |

Run `qualification:alerts` to verify new alert firing and recovery with synthetic series. A synthetic rule test does not prove notification routing; test the deployed receiver before launch. Internal dashboards should show due outbox age/count, operational availability, stale holds, request rate/error/latency, recent delivery outcomes and provider circuits. Do not use rate() on rolling-window gauges or assign global provider SLAs from per-process circuits.

## Backup and restore

1. Stop producers and workers for a consistent planned snapshot. Record candidate SHA, baseline fingerprint, UTC timestamp, PostgreSQL version and queue persistence configuration. For online recovery targets, establish PostgreSQL WAL retention/PITR separately.
2. Back up the full database, including message partitions, outbox, budget ledger/reservations/reconciliations, baseline marker, credentials and recipient revocations. Securely retain the matching complete encryption key ring outside the database backup. Capture queue state and idempotency state according to the configured Redis/Dragonfly persistence policy.
3. Restore into a separate environment with outbound access blocked and workers stopped. Verify the baseline fingerprint and accounting totals; retain unresolved holds and revocations. Missing keys fail closed. Do not enable workers merely because the database accepts connections.
4. Reconcile queue state against durable outbox and message/attempt state. Pending and expired claims can be retried with their existing identity. A processed outbox item whose queue job was lost needs explicit investigation; queue loss is not automatically recoverable by replaying every processed item. Unknown provider acceptance must never trigger blind resend.
5. Verify old and new ciphertext with the retained key ring, and verify revoked recipients remain denied. Restore newer revocations that postdate a backup before opening access. Restoring an older tombstone snapshot alone cannot preserve later revocations.
6. Record the observed data-loss window and recovery duration. Only resume with each acknowledged message accounted for and uncertainty assigned for reconciliation. Agree production RPO/RTO from realistic drills; the local synthetic timing is not a guarantee.

`qualification:recovery` creates its own isolated PostgreSQL container, restores a canonical snapshot into another database, verifies pending outbox/uncertain holds/revocations, restarts PostgreSQL and checks again. It does not connect to user databases. Existing strict-auth tests cover failed queue enqueue and expired-claim recovery; encryption suites cover rotation, unknown keys and durable revocation. Production queue-loss/PITR and notification routing remain deployment-specific drills.
