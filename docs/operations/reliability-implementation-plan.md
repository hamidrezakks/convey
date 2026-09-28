# Reliability implementation plan

Base: main at 6be82dd. Each workstream receives its own implementation commit and regression checks. Local validation is required; CI is not a blocking step.

| Order | Workstream | Acceptance criteria | Status |
| --- | --- | --- | --- |
| 1 | Encryption configuration | Production rejects missing/weak keys and mock KMS; rotation preserves old ciphertext | Implemented; locally verified |
| 2 | Webhook destination security | HTTPS public destinations, pinned validated DNS, no redirects, bounded response handling | Implemented; locally verified |
| 3 | Receipt reliability | Durable receipt processing, bounded retries, deduplication and visible exhausted failures | Implemented; locally verified |
| 4 | Receipt isolation | Provider-scoped cached and database correlation; collision regression coverage | Implemented; locally verified |
| 5 | Customer notifications | Correct tenant resolution, common typed dispatch path, public-safe payloads, status notifications | Implemented; locally verified |
| 6 | Message state consistency | Serialized per-attempt transitions, monotonic success states, sibling-aware aggregate, duplicate-safe effects | Implemented; locally verified |
| 7 | Provider rate limits | Bounded retry with server delay support; no outage penalty for throttling | Implemented; locally verified |
| 8 | Recipient revocation | Durable fail-closed revocation across processes/restarts; accurate deletion guarantees | Implemented; locally verified |
| 9 | Telemetry honesty | Measured values or explicitly unavailable; no fabricated health/latency/volume | Implemented; locally verified |
| 10 | Budget operations | Scoped hold listing, audited reconciliation, stale-hold visibility, configurable estimates | Implemented; locally verified |
| 11 | Provider certification | Incomplete adapters remain disabled; explicit contract evidence required for readiness | Implemented; locally verified |

## Verification and delivery

Run focused regressions after each step, then migrations against disposable PostgreSQL, server/auth/console suites, workspace type checks and formatting checks. Review final diff for isolation, secret exposure, retries, concurrent updates and migration safety. Create a PR describing final behavior and remaining external verification requirements. Live provider certification requires designated vendor test accounts and recipients; fixture tests do not prove live delivery or invoice accuracy.

## Delivery evidence

- Server: 1,034 tests pass; strict-auth: 17 tests pass; console: 144 tests pass; plugins: 7 tests pass.
- Six workspace type checks pass. Biome passes with three pre-existing static-only-class warnings.
- The 23-file canonical baseline initializes atomically against disposable PostgreSQL 18 and accepts exact reruns. Schema comparison preserved 946 columns, 741 constraints, 229 indexes and one trigger, including partitions.
- Regression coverage includes concurrent receipt replay, cross-provider ID collisions, fail-closed revocation and restart behavior, public-only webhook DNS, budget reconciliation scope/concurrency, price validation and provider readiness gates.
- Self-review corrected Retry-After propagation, sibling-attempt failure protection, inbound keyword handling, and provider configuration cache publication ordering.

## Deployment requirements and external verification

Configure production encryption secrets/key ring and explicit provider prices before deploying. Initialize the current baseline in a fresh database before starting workers; follow the pre-release schema policy when changing persisted formats. Inbound messages without an existing attempt require an operator-configured `inboundTeam` in provider configuration. Revocation is durable logical denial, not physical data erasure. Retain tombstones in backups. External tenant KMS selection is rejected in production until a real envelope integration exists.

All eleven engineering workstreams are implemented; live provider certification and invoice reconciliation require vendor test accounts, designated recipients and provider billing evidence. The 20 incomplete adapters remain disabled. No live sends or vendor certification are claimed. CI is not a release gate for this requested handoff; local results are recorded above.

## Pre-release policy follow-up

Completed in separate commits: consolidate CREATE definitions, enforce atomic baseline initialization and drift rejection, persist the unreleased policy and manual release defaults, correct plugin uniqueness at creation, replace generated ALTER history with CI schema validation, remove old credential/message/configuration readers, and update operational documentation. See [schema baseline](schema-baseline.md). Existing development stores are never reset automatically. Encryption key rotation remains supported.
