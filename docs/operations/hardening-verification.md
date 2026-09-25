# Hardening verification and remaining work

Reviewed 2026-09-25 on branch `feat/convey-production-hardening`, against original revision `1069f09`. Results are local execution evidence, not a hosted CI run or a live provider certification. Tests used disposable PostgreSQL 18 and Redis 7.4 services; no real provider messages were sent.

## Completed steps

| Step | Change | Commit |
| --- | --- | --- |
| 1 | Stored roles, secure auth defaults, explicit platform scope | `120c39e` |
| 2 | Global team ownership, scoped messages/replay and plugin access | `77d2d5e` |
| 3 | Operator sign-in, shared authenticated clients, production API proxy | `858a44a` |
| 4 | Candidate validation before release tags/publication | `b0d0cdd` |
| 5 | Bounded HTTP metric labels and operational health gauges | `046b2f7` |
| 6 | Production security regressions, signed callbacks and recoverable outbox claims | `4a99f95` |
| 7 | Honest capability documentation, migration/recovery and release runbooks | This documentation commit |

## Execution evidence

| Check | Result |
| --- | --- |
| Canonical migrations | Fresh test schema created; rerun through 0022 successful |
| Workspace TypeScript checks | All six pass |
| Biome | Pass, with three existing static-only class warnings |
| Console suite | 134 pass, 0 fail |
| Strict-auth hardening suite | 14 pass, 57 assertions |
| Combined hardening/auth/scope/env/signature tests | 35 pass, 101 assertions |
| SDK integration on authenticated API | 4 pass |
| TypeScript SDK unit tests | 100 pass |
| Go SDK suite | Pass, including race detection |
| Python SDK suite | 22 tests, 1 skipped, no failures |
| HTTP cardinality/status test | Pass: 100 distinct message IDs collapse to one route label; 200/403/404/500 observed |
| Real operational metrics refresh | Pass on disposable database |
| Production images | Server, web and plugins targets build successfully |
| Console browser smoke | Built web image: sign-in, authenticated inbox access, sign-out and reload verified |
| Release tooling | YAML parses; version dry run succeeds; malformed input rejected |
| Hosted release / actual publication | Not executed |
| External provider delivery and performance SLA | Not tested |

The strict suite exercises missing credentials across route families, role-header forgery, cross-team single/bulk dispatch and message reads, sandbox boundaries, database ownership enforcement, team idempotency, concurrent replay, expiry/revocation, webhook body tampering/staleness/duplicates, structured log redaction, queue-failure recovery, templates/batches and authenticated plugin access. This is targeted coverage, not proof that every route or storage path is secure.

## Known release blockers

The current non-performance legacy server run reports **481 passing and 24 failing tests**. The original revision was separately run against its canonical migrations and reports **899 passing and 28 failing tests**, including performance cases excluded from the current default CI selection. The current failure names also occur on the baseline. These totals are not directly comparable coverage counts.

Examples include fixtures inserting `providers.tenant_id` despite the canonical schema, invalid country lengths, missing audit actor fields, and a Redis-prefix expectation tied to the default prefix. Suites affected include cascades, suppression/inbound replies, admin/sandbox, tracing, quiet hours, budget ledger and broad E2E fixtures. Existing assertions and tests remain in the required release gate; they have not been converted to passes or silently skipped.

A clean typecheck, container build and new passing security tests do not override these failures. Do not publish this branch as fully validated until the legacy fixtures and any resulting application defects are resolved.

## Prioritized follow-up plan

Estimates are engineering effort ranges, not delivery commitments. One engineer can execute sequentially; the release owner accepts each exit criterion.

| Priority | Work package | Depends on | Estimate | Exit criterion |
| --- | --- | --- | --- | --- |
| P0 | Repair canonical-schema test fixtures and isolated cleanup | Current branch | 2–4 days | All required server/plugin tests pass repeatedly on a fresh schema; no blanket skips or schema alterations hiding defects |
| P0 | Validate upgrade with representative historical data | Fixture repair | 1–2 days | Ownership collisions/orphans resolved; migrations and restore/reconciliation rehearsed; old workers excluded during rollout |
| P0 | Deploy and test trusted callback signing gateway | Provider inventory | 1–3 days per provider family | Valid native callbacks accepted, invalid native signatures rejected before signing, retries and queue outage recovery verified |
| P1 | Replace illustrative console telemetry | Operational metric contract | 2–3 days | Overview values derive from measured data or explicitly display unavailable; no synthetic latency/throughput labels |
| P1 | Exercise real provider test accounts and all dispatch channel forms | P0 validation | 2–4 days | Acceptance-to-delivery/retry/callback paths verified with designated test recipients; UI wire schemas match API |
| P1 | Audit encryption and credential lifecycle | Storage inventory | 2–4 days | No production fallback encryption key, documented rotation/recovery and tested coverage of sensitive storage paths |
| P1 | Rehearse release candidate in hosted CI | All release blockers | 1 day | Dry run validates exact candidate and all distributions; registry permissions separately verified before an authorized publication |
| P2 | Establish reproducible performance envelope | Correctness gates pass | 2–3 days | Dataset, machine limits, concurrency, p95/p99 and outbox drain rate recorded; no universal throughput claims |
| P2 | Classify or remove unused resilience scaffolding | Runtime call-graph review | 2–4 days | Each advertised feature has a live integration and failure test, or is clearly documented as experimental |

## Acceptance and rollout gates

1. Correctness: required CI checks pass against canonical schema.
2. Security: strict-auth suite passes and deployment-specific vendor signatures are tested.
3. Operations: backups restore, stale outbox leases recover, useful metrics are available.
4. Release: exact versioned candidate builds and passes dry run before tagging.
5. Rollout: small initial workload, monitored error/backlog thresholds, and a named rollback decision owner.
