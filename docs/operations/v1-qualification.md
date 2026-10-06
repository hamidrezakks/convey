# V1 mock qualification results

2026-09-28. Implementation and self-review are complete for the mock qualification tooling and fixes below. The owner requested mocks; no live sends or spend occurred. [Machine-readable evidence](v1-qualification-evidence.json) records the implementation revision, environment, results, checksums and image IDs. This is not a first-release approval or certification of every provider.

## Implemented workstreams

| Plan area | Implemented and verified | Remaining release evidence |
| --- | --- | --- |
| Scope | Generated 87-adapter capability inventory; 20 incomplete adapters remain disabled | Owner's supported capability shortlist; declarations are not certification |
| Providers | Deterministic Resend/Twilio failures plus existing broader suites; production worker-to-mock send and signed receipt | Per-capability/vendor-version certification for every advertised provider |
| Budgets | Concurrent hold/ledger invariants, exact evidence comparator, paid/free-cap regression and real-worker verification | Actual invoice/fee/FX evidence if invoice accuracy is advertised |
| Recovery | Fresh canonical setup, independent snapshot restore, PostgreSQL restart, preserved uncertainty/revocation/outbox; failed enqueue and stale-claim recovery | Deployment-scale PITR and queue-loss recovery, agreed RPO/RTO |
| Isolation | 82-route inventory; anonymous checks for every API-key route using schema-valid requests, role matrix and existing two-team integration tests | Independent review and deployment-specific network/secret boundaries |
| Operations | Nine alert rules, synthetic firing/recovery checks, operator runbook; burst and sustained acceptance profiles | Long-duration soak, measured dispatch/receipt latency targets, deployed notification receiver checks |
| Artifacts | Installed npm/wheel consumers, Go external compilation; ARM64 server/web/plugins images run as non-root; egress-blocked production mock flow | AMD64 execution and minimum-runtime matrix; published Go module resolution |
| Contracts | API/accounting/operational limitations and first-release transition documented | Owner approves support commitments and freezes baseline on first publication |

## Defects fixed by qualification

- Removed the coarse dispatch budget check: enforcement now occurs when the provider price is known, under the atomic reservation. Free sends work even after the cap is lowered below existing exposure. Paid sends remain blocked.
- Reused validated database configuration when discovering configured provider adapters. Modules without an onConfigured hook previously disappeared from routing despite successful startup.
- Made empty-pool defaults channel-specific so SMS does not fall back to SES email.
- Fixed npm declaration graphs for NodeNext ESM and CommonJS consumers, and removed the public Buffer-only type dependency from webhook handlers.
- Replaced the old Docker script, which mixed sandbox acceptance and direct mock endpoint calls, with a real production worker flow on an internal network.
- Made the queue-recovery fixture unambiguously due rather than sensitive to submillisecond database/application clock differences.
- Added non-root application users and excluded nested deployment environment files from Docker context.

## Local results

1,041 server tests, 17 strict-auth tests, 144 console tests, seven plugin tests, 100 TypeScript SDK tests and the billing comparison regression passed. Go race tests passed; Python ran 22 tests with one live-environment test skipped. All six workspace type checks and the qualification-tool type check passed. Biome has three existing warnings. Canonical schema and inventory drift checks passed. No hosted CI wait was performed.

Acceptance used the in-process HTTP application with real local PostgreSQL/Redis, no delivery workers: 200 requests/concurrency 10 yielded p95 27.76ms and p99 51.43ms; 1,000 requests at a requested 50/second over 20.5 seconds yielded p95 91.41ms and p99 123.57ms. These measurements exclude external HTTP transport and vendor latency; they are not production SLAs or a long-duration soak.

The container rehearsal used production configuration and real workers with external egress disabled. It verified startup/readiness, anonymous denial, scheduled dispatch not sending early, mock HTTP acceptance, one atomic paid charge, signed receipt persistence/application, duplicate receipt suppression, paid-cap rejection, a free send after cap reduction, restart preservation, console serving and plugin health. It does not claim browser interaction coverage of the console.

## Reproduce

Use disposable PostgreSQL/Redis and the existing test environment variables for server/auth/load tests. Never point reset helpers at user data. The recovery and container scripts create and remove their own infrastructure. Build the three images as `convey-qualification:server`, `convey-qualification:web`, and `convey-qualification:plugins` before container qualification.

| Command | Purpose |
| --- | --- |
| `bun run qualification:inventory:check` | Detect provider capability inventory drift |
| `bun run qualification:access:check` | Detect registered route inventory drift |
| `bun run qualification:typecheck` | Check qualification tools |
| `bun run qualification:recovery` | Isolated canonical database snapshot/restore/restart |
| `bun run qualification:alerts` | Prometheus synthetic alert tests |
| `bun run qualification:artifacts` | Build/install npm package; ESM/CJS/runtime/types and external Go consumer |
| `bun run qualification:python` | Build/install Python wheel in isolated environments |
| `bun run qualification:containers` | Non-root production containers, real workers, mock-only network |
| `bun run qualification:load` | Bounded authenticated acceptance burst |
| `bun run qualification:load --sustained` | 1,000-request sustained acceptance profile |
| `bun test scripts/qualification/reconciliation.test.ts` | Exact mock billing comparison regressions |

`bun scripts/qualification/reconciliation.ts evidence.json` compares same-currency decimal-string estimates and observed amounts, reports exact variance, and exits nonzero for unexplained differences. Input must already use one currency per row; do not relabel currencies to avoid implementing FX reconciliation. It never writes accounting data. Inputs and outputs must be redacted before checking them in.

Provider failure tests and all-route authentication checks run in existing server/strict-auth suites. CI/release validation now includes inventory, tool types, recovery, alert and installed-artifact checks, plus the container rehearsal. The unchanged pre-release baseline has 23 CREATE-definition files and no ALTER history. Forward upgrade migrations remain deferred until the first release under the established policy.
