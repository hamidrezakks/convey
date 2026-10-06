# V1 release-readiness plan

Status: repeatable mock qualification implemented; release gates remain open as documented in [qualification results](v1-qualification.md). Updated 2026-09-28.

The owner selected mock-only verification. No live accounts, recipients or spend are used. The acceptance criteria below remain the release target; completion of tooling does not certify untested provider capabilities or production operating limits.

## Objective and boundaries

Release a deliberately scoped Convey version with demonstrated provider delivery, predictable budget enforcement, tenant isolation, recoverability, and reproducible installation. Existing passing tests are the starting point, not proof of live delivery or billing accuracy.

Until the owner publishes the first release, follow [schema-baseline.md](schema-baseline.md): edit canonical CREATE definitions, introduce no ALTER upgrade history or obsolete-format compatibility, and use disposable stores for schema changes. Never reset user data automatically. Keep key rotation and vendor protocol support. Publishing remains an explicit owner action. Do not wait for hosted CI during implementation handoffs; run relevant local checks and record results. Actual publishing must pass the release workflow's validations.

Owner roles below are responsibilities, not assigned people. One engineer may cover several roles; release scope, vendor accounts, recipients, spend allowance, and publication decisions belong to the project owner. Work that needs those inputs is marked separately so offline engineering can proceed.

## Sequence and dependencies

| Phase | Workstreams | Dependency / exit |
| --- | --- | --- |
| A: Define | 1. V1 scope; draft 8. contracts; define targets for 6 | Named supported capabilities, workload assumptions and evidence checklist |
| B: Prove correctness | 2. Providers; 3. Budgets; 5. Isolation | Scope draft; implement offline coverage first, then account-backed validation |
| C: Prove operation | 4. Recovery; 6. Reliability targets and alerts | Accounting and security invariants available; rehearse failures under load |
| D: Qualify candidate | 7. Packaged artifacts; finalize 8. contracts | All supported paths pass using one candidate revision |
| E: Release decision | Evidence review and explicit publication | Every release gate satisfied; owner accepts residual limitations |

Logical workstreams may overlap, but no feature is called certified because another workstream's tests pass. Fixes to the candidate invalidate affected evidence and require targeted reruns. Changes to shared transport, accounting, authentication or serialization require all dependent suites to rerun.

## 1. Define the supported v1 scope — P0

Owner: product/release owner with engineering.

Deliverables:
- A checked-in capability matrix for provider, channel, API version, send/batch behavior, receipts, inbound events, attachments/templates, pricing model, sandbox behavior, and supported regions where relevant.
- Separate states for implemented, offline-tested, live-verified, and v1-supported. Scope every certificate to tested capabilities; unsupported receipts must be stated explicitly.
- Audit catalog, seed data, API discovery, console configuration and documentation against the same matrix. Keep incomplete adapters disabled and avoid presenting unavailable features as operational.
- Document the v1 deployment topology and workload assumptions. Start with the smallest supported topology that can be demonstrated; do not advertise global scale or active-active guarantees without evidence.

Acceptance: every advertised capability has an owner, test reference and evidence requirement; no disabled provider can be selected through API or console overrides. The owner selects the actual provider shortlist before live certification. Inventory and candidate recommendations can proceed without that decision.

## 2. Certify supported providers — P0

Owner: provider engineering; owner supplies vendor test accounts, designated recipients and spend allowance.

Build on `provider-certification.md`, `provider-certification-evidence.json`, provider contract/retry tests and the existing interceptor harness.

Deliverables:
- Vendor-specific request/response fixtures for each shortlisted capability: authentication, recipient encoding, payload limits, batching, partial success, malformed success, permanent rejection, throttling and Retry-After.
- Boundary tests for timeout before/after acceptance, disconnection, token expiry/rotation, duplicate jobs, receipt replay, out-of-order receipts and wrong-account correlation.
- Webhook tests for signatures over raw bodies, invalid signatures, timestamp/replay rules where supported, unsubscribe/resubscribe and inbound ownership where applicable.
- A repeatable live certification procedure recording candidate SHA, adapter/API version, date, environment, redacted delivery and receipt evidence, and differences from fixtures. Consult current official vendor contracts during execution.

Acceptance: all required offline cases pass; live sends reach designated recipients and supported receipts correlate correctly; failures never report false success or expose credentials. Network ambiguity remains visible and is not blindly retried where duplicate delivery is possible. Each v1 provider has live evidence, or is removed from release scope. Never claim universal exactly-once delivery.

## 3. Prove budget accounting under failures — P0

Owner: backend/accounting engineering; owner supplies billing exports for live comparison.

Build on `budget-service.test.ts`, concurrency tests, the reconciliation API/console and `budget-enforcement.md`. Audit current documentation against code first; remove stale historical migration guidance and contradictory pricing statements.

Deliverables:
- A lifecycle model covering reservation, commitment, confirmed release, unknown outcome, intentional replay, fallback and cascade. Define the accounting identity for each billable execution.
- Deterministic multi-worker fault tests at reservation, before provider call, after provider acceptance, before/after settlement, and before acknowledgement. Inject database rollback, Redis loss, process termination and repeated reconciliation.
- Boundary matrix: hard/soft caps, free sends, fan-out, SMS segments, currency precision, FX changes, UTC month rollover, policy creation/editing, reduced caps, sandbox and team isolation. Resolve the documented dispatch-versus-worker discrepancy for zero-cost sends under an exhausted cap.
- A reconciliation report comparing Convey estimates to vendor evidence without silently replacing estimated accounting with invoice values. Label currency, FX, fees, tax, segmentation and timing differences; define allowed variance per supported pricing model.

Required invariants:
- An execution settles at most once; retried settlement/reconciliation cannot duplicate ledger charges.
- Usage equals committed ledger amounts in the pinned accounting currency/month; reserved totals equal unresolved holds. No negative accounting totals.
- Each new positive-cost reservation under a hard cap fits the available cap atomically. Lowering a cap below existing exposure blocks further positive reservations without rewriting prior commitments; soft caps are explicitly nonblocking.
- Confirmed nonacceptance can release a hold; unknown or partial acceptance retains an auditable hold. No automatic expiry frees uncertain spend.
- Sandbox and other teams cannot affect production accounting; intentional replays have distinct identities.

Acceptance: invariant checks pass after every injected failure and after recovery; concurrent capacity exhaustion cannot oversubscribe the configured estimate policy. Every discrepancy in live comparisons has a documented explanation or blocks the affected pricing claim. Exact invoice enforcement is outside v1 unless independently implemented and proved.

## 4. Verify installation, backup and recovery — P0

Owner: platform engineering.

Deliverables:
- A fresh-install rehearsal using only documented configuration, canonical schema and packaged services. Verify initialization ordering, repeated initialization, readiness and clear failure on stale baselines without data deletion.
- A backup/restore runbook covering PostgreSQL, queue state and durable outbox, encryption key ring, revocation records and operational configuration. Document which store is authoritative for each state.
- Recovery drills for API/worker termination, queue unavailability/loss, database interruption, stalled leases and poison jobs. Reconcile accepted, queued, ambiguous and terminal messages after recovery.
- Key-rotation drill with old/new ciphertext and restored backups. Missing keys fail closed; revocation remains effective across restore.
- A restore into a separate environment with outbound delivery disabled initially, preventing unintended sends while reconciling restored work.

Acceptance: a new operator can install from the runbook; acknowledged messages within the declared recovery-point boundary are accounted for; recovery does not silently resend ambiguous provider calls. Measure actual recovery time and data-loss window, compare with the agreed targets, and retain drill evidence. Backup creation alone does not satisfy this gate.

## 5. Review tenant and privilege isolation — P0

Owner: security/backend engineering; independent review preferred where available.

Deliverables:
- An access matrix for anonymous, tenant, sandbox, platform-reader and platform-admin credentials across all public/admin routes and worker ingress.
- Adversarial two-team tests using guessed/swapped opaque IDs, cursor filters, bulk requests, caches, configuration reloads, webhook identities, DLQ replay and reconciliation.
- Verify credential encryption/redaction, logs and error responses, public identifier boundaries, recipient revocation, webhook destination restrictions and key revocation behavior.
- Inventory routes and sensitive operations so coverage is linked to actual entry points rather than only handpicked examples.

Acceptance: unauthorized operations return the intended denial with no database, queue or provider side effects; team A cannot observe or alter team B data. All high-impact findings are fixed and regression-tested. Any untested external boundary remains explicitly unverified.

## 6. Establish reliability targets and actionable alerts — P1, required for launch

Owner: platform/backend engineering with release owner.

Deliverables:
- Define workload profiles: message rate, burst size, concurrent teams, payload size, provider response distribution and failure rates. Separate internal acceptance/processing time from vendor delivery time.
- Proposed initial internal test targets, pending baseline measurements: acceptance p95 <= 250 ms and p99 <= 1 s; due-message dispatch delay p95 <= 5 s and p99 <= 30 s; receipt-processing p95 <= 5 s. These are proposals, not measured performance or customer promises.
- Agree explicit recovery-time and recovery-point targets after the first restore drill, before candidate qualification. Do not invent production guarantees from local tests.
- Dashboard and alerts for oldest due outbox/queue item, retry exhaustion, ambiguous sends, stale holds, reconciliation backlog, webhook failures, database/queue availability and missing telemetry.
- Every alert states threshold, evaluation window, severity, owner, investigation query, recovery action and resolution condition. Avoid high-cardinality recipient/message metric labels.

Acceptance: run the agreed sustained and burst profiles on a recorded environment; report percentiles, errors and resource limits. Inject each actionable alert condition and demonstrate firing and recovery. Missing measurements are unavailable, never healthy. Failed targets require a fix, reduced scope/load envelope or an explicit revised target before release.

## 7. Validate distributable artifacts — P0

Owner: release/platform engineering.

Build on `.github/actions/validate/action.yml`, production Docker tests and SDK integration scripts; add missing coverage rather than duplicating pipelines.

Deliverables:
- Build server, web and plugins images and TypeScript, Python and Go SDK distributions from the same candidate SHA with pinned toolchains/lockfiles.
- Install SDK artifacts in clean consumer projects outside workspace resolution; verify imports/types and supported runtime versions. Test every advertised image architecture on a suitable runner or record it as unsupported.
- Bring up the built images against fresh stores and exercise authenticated send, status, scheduling, webhook processing, budget rejection/reconciliation, console configuration, plugin operations and graceful restart using deterministic providers.
- Check entrypoints, runtime dependencies, health/readiness, configuration failures, secret exclusion and non-root execution where supported. Record image digests, package checksums and relevant dependency/security findings.

Acceptance: packaged smoke flows pass without development mounts or undeclared workspace dependencies; SDK requests match the shipped API contract; candidate artifacts are traceable to the tested SHA. Critical exploitable dependency/configuration findings block release. Build success alone is insufficient.

## 8. Finalize API contracts and first-release policy — P0

Owner: API/release engineering with project owner.

Deliverables:
- Review API/schema and SDK contracts: authentication, pagination, errors, public IDs, idempotency scope/retention/conflicting payloads, scheduling/cancellation, retry semantics and unknown outcomes.
- Document webhook signing, event schema, ordering, redelivery and consumer deduplication. Define estimated budget guarantees and supported precision/currencies without invoice guarantees.
- Add contract snapshots/consumer checks where they detect meaningful API drift. Correct examples and remove unsupported claims.
- Before publishing, prepare and validate the transition to post-release versioned migrations: preserve the frozen baseline, record its identity and test fresh installation plus migration-ledger initialization from that exact baseline without rewriting data. Rehearse a temporary forward change only in a disposable test harness; do not commit speculative ALTER migrations to the unreleased canonical schema.
- At the first release, tag/freeze the baseline and activate the forward-migration and compatibility policy for subsequent versions. Define deprecation notice, supported upgrade origins, rollback/restore strategy and SDK/API support windows.

Acceptance: examples execute against the packaged candidate; contracts agree across API, SDKs and docs. No promised behavior lacks coverage or an explicit limitation. The owner approves first-release scope and publication; subsequent shipped migrations become immutable.

## Commit and review strategy

Use an implementation branch based on the current main after checking existing work and PR state. Preserve unmerged work; do not silently reset or overwrite it. Use separate reviewable commits for:

1. Scope matrix and contract decisions.
2. Provider harness improvements, then one adapter/certification change per commit.
3. Budget invariant harness, followed by each discovered accounting correction and regression.
4. Isolation matrix and fixes grouped by boundary.
5. Installation/restore tooling and recovery regressions.
6. Metrics, agreed thresholds, alert rules and operator runbooks.
7. Artifact consumer tests and container smoke coverage.
8. Final contracts, evidence index and first-release transition procedure.

For each commit record the problem, change, targeted verification and remaining uncertainty. Broaden testing for shared behavior changes. Complete final self-review and update the PR with final scope and local evidence; do not wait for CI for the requested handoff. This planning commit does not authorize publication or send live messages.

## Evidence and completion gates

Maintain an evidence index containing workstream, candidate SHA, test command/procedure, environment/tool versions, result/date, artifact location, reviewer, and remaining limitations. Store redacted evidence only; account credentials belong in the designated secret store.

| Gate | Required evidence |
| --- | --- |
| Scope | Approved capability matrix; unavailable functionality cannot be enabled accidentally |
| Correctness | Provider contracts, accounting invariants and isolation checks pass |
| Live integration | Every supported provider has scoped delivery evidence and pricing discrepancies explained |
| Operations | Fresh install, backup restore, key rotation and failure recovery rehearsed |
| Reliability | Agreed workload targets pass; alerts fire and recover with usable runbooks |
| Distribution | Exact candidate packages/images pass clean-environment consumer and smoke tests |
| Release contract | Baseline freeze/forward-migration transition and compatibility policy ready; owner explicitly publishes |

A gate is passed only by recorded evidence, not by code completion or test counts. External account or billing inputs may remain blocked while unrelated engineering proceeds. Never substitute fixture success for missing live evidence.

## Next execution batch

Start with the capability inventory, access/accounting invariant matrices and deterministic failure harness. Present a proposed v1 provider shortlist based on existing implementation evidence; the owner selects it and supplies the accounts/recipients/spend allowance for live work. Continue offline correctness and artifact preparation while those inputs are pending. Re-estimate remaining work after the first provider certification, budget fault run and restore drill reveal actual gaps.
