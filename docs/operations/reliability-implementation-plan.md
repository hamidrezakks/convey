# Reliability implementation plan

Base: main at 6be82dd. Each workstream receives its own implementation commit and regression checks. Local validation is required; CI is not a blocking step.

| Order | Workstream | Acceptance criteria | Status |
| --- | --- | --- | --- |
| 1 | Encryption configuration | Production rejects missing/weak keys and mock KMS; rotation preserves old ciphertext | Planned |
| 2 | Webhook destination security | HTTPS public destinations, pinned validated DNS, no redirects, bounded response handling | Planned |
| 3 | Receipt reliability | Durable receipt processing, bounded retries, deduplication and visible exhausted failures | Planned |
| 4 | Receipt isolation | Provider-scoped cached and database correlation; collision regression coverage | Planned |
| 5 | Customer notifications | Correct tenant resolution, common typed dispatch path, public-safe payloads, status notifications | Planned |
| 6 | Message state consistency | Serialized per-attempt transitions, monotonic success states, sibling-aware aggregate, duplicate-safe effects | Planned |
| 7 | Provider rate limits | Bounded retry with server delay support; no outage penalty for throttling | Planned |
| 8 | Recipient revocation | Durable fail-closed revocation across processes/restarts; accurate deletion guarantees | Planned |
| 9 | Telemetry honesty | Measured values or explicitly unavailable; no fabricated health/latency/volume | Planned |
| 10 | Budget operations | Scoped hold listing, audited reconciliation, stale-hold visibility, configurable estimates | Planned |
| 11 | Provider certification | Incomplete adapters remain disabled; explicit contract evidence required for readiness | Planned |

## Verification and delivery

Run focused regressions after each step, then migrations against disposable PostgreSQL, server/auth/console suites, workspace type checks and formatting checks. Review final diff for isolation, secret exposure, retries, concurrent updates and migration safety. Create a PR describing final behavior and remaining external verification requirements. Live provider certification requires designated vendor test accounts and recipients; fixture tests do not prove live delivery or invoice accuracy.
