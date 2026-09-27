> Historical verification record. Pre-release schema initialization now follows [the canonical baseline policy](schema-baseline.md); migration and upgrade references below describe earlier development checks.

# Hardening verification and remaining work

Reviewed 2026-09-25 on branch `feat/convey-production-hardening`, against original revision `1069f09`. Initial results were local; the PR review also exercised hosted CI and exposed the clean-checkout website generation failure. The subsequent fixes were validated locally against a fresh archive and a newly migrated database. This is not live provider certification. Tests used disposable PostgreSQL 18 and Redis 7.4 services; no real provider messages were sent.

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
| Canonical migrations | Fresh test schema created; rerun through 0023 successful |
| Workspace TypeScript checks | All six pass |
| Biome | Pass, with three existing static-only class warnings |
| Console suite | 141 pass, 0 fail |
| Strict-auth hardening suite | 16 pass, 91 assertions |
| Additional auth/scope/env/signature tests | Initial 21 tests passed; hosted quality gate also runs auth/scope/env checks |
| SDK integration on authenticated API | 4 pass |
| TypeScript SDK unit tests | 100 pass |
| Go SDK suite | Pass, including race detection |
| Python SDK suite | 22 tests, 1 skipped, no failures |
| HTTP cardinality/status test | Pass: 100 distinct message IDs collapse to one route label; 200/403/404/500 observed |
| Real operational metrics refresh | Pass on disposable database |
| Production images | Server, web and plugins targets build successfully |
| Console browser smoke | Built web image: sign-in, authenticated inbox access, sign-out and reload verified |
| Release tooling | YAML parses; version dry run succeeds; malformed input rejected |
| Plugin suite | 7 pass |
| Canonical-schema server suite | 632 passed before classification; 629 required correctness tests plus 3 timing benchmarks now separated |
| Fresh archive | Frozen install, generated website sources, six typechecks and 141 UI tests pass |
| Hosted release / actual publication | Not executed |
| External provider delivery and performance SLA | Not tested |

The strict suite exercises missing credentials across route families, role-header forgery, cross-team single/bulk dispatch and message reads, sandbox boundaries, database ownership enforcement, team idempotency, concurrent replay, expiry/revocation, webhook body tampering/staleness/duplicates, structured log redaction, queue-failure recovery, templates/batches and authenticated plugin access. This is targeted coverage, not proof that every route or storage path is secure.

## PR review fixes

| Finding | Resolution | Commit |
| --- | --- | --- |
| Sandbox/production idempotency collision | Environment-scoped v2 keys across reserve, complete, release and bulk paths; tests cover both orders and retries | `edfe9fb` |
| Clean-checkout website type failure | Generate Fumadocs source before workspace typechecks | `425ac52` |
| Ignored Meta challenge setting | Read documented deployment variable, preserving existing aliases; positive/negative token tests | `fa76e01` |
| Invalid generic push/chat payloads | Explicit FCM/APNs/Slack/Telegram options with matching recipient/content fields; all seven selections checked against API schema | `c8a52a6` |
| Legacy integration failures | Add missing suppression columns, remove ad hoc schema mutation from fixtures, correct country/month/state/credential/receipt fixtures | `067cdd0` |

The original hosted run had 482 passing / 23 failing legacy tests. After the repairs, the full default server selection executes 632 tests successfully; previously failing setup hooks had prevented some tests from running. No correctness assertions were skipped or removed. A subsequent duplicate hosted run exposed a noisy 25 ms timing threshold; the three existing wall-clock benchmarks were moved unchanged into `latency-benchmark.test.ts`, selected by the existing performance command instead of shared-runner correctness CI. Plugin tests now also run after the server gate. Production migrations define the tested schema.

The new idempotency namespace needs a controlled transition for existing reservations; follow the migration runbook before rollout. Production provider verification, restore rehearsal and actual release publication remain deployment work, not completed test evidence.

## Prioritized follow-up plan

Estimates are engineering effort ranges, not delivery commitments. One engineer can execute sequentially; the release owner accepts each exit criterion.

| Priority | Work package | Depends on | Estimate | Exit criterion |
| --- | --- | --- | --- | --- |
| Done | Repair canonical-schema test fixtures and isolated cleanup | PR review | Completed | 629 required server tests and 7 plugin tests; 3 timing benchmarks run separately |
| P0 | Validate upgrade with representative historical data | Fixture repair | 1–2 days | Ownership collisions/orphans resolved; migrations and restore/reconciliation rehearsed; old workers excluded during rollout |
| P0 | Deploy and test trusted callback signing gateway | Provider inventory | 1–3 days per provider family | Valid native callbacks accepted, invalid native signatures rejected before signing, retries and queue outage recovery verified |
| P1 | Replace illustrative console telemetry | Operational metric contract | 2–3 days | Overview values derive from measured data or explicitly display unavailable; no synthetic latency/throughput labels |
| P1 | Exercise real provider test accounts | P0 validation | 2–4 days | Acceptance-to-delivery/retry/callback paths verified with designated test recipients; all UI wire schemas are already tested |
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

## Provider audit follow-up (2026-09-25)

The [provider audit](../provider-porting-matrix.md) replaces the earlier blanket provider-completeness claims with evidence for all 88 module entries. Shared rejection/status checks cover all modules; vendor-specific offline tests cover the repaired paths. Twenty native SMS adapters still require implementation and now reject before network I/O. Remaining modules and optional features are not certified by shared tests.

Current local evidence after these changes: 1,004 server tests pass (7,410 assertions), all six workspace typechecks pass, 16 strict-auth tests pass, and 141 console tests pass. Biome passes with the same three existing warnings. SMTP and APNs HTTP/2 are exercised against local peers; cloud requests use mocked HTTP or SDK responses. No live delivery or native callback-signature certification was performed.

Provider acceptance now records DISPATCHED and emits message.sent; only confirmed delivery receipts may record delivery. Consumers relying on the old immediate message.delivered event must migrate. APIs that do not supply a message ID no longer receive a fabricated one. Consult the audit for credential changes, disabled integrations, callback limitations and live-verification exit criteria.

## Budget audit follow-up (2026-09-25)

See [budget enforcement and accounting](budget-enforcement.md) for the reservation/settlement design, tested cases, migration 0024 and reconciliation procedure. The console now saves real policies; estimates are reserved before provider calls; accepted charges and usage settle atomically. Duplicate jobs, replay generations, currency mismatches and month boundaries have regression coverage. The limits apply to configured estimates, not verified vendor invoices.
