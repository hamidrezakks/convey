# Budget enforcement and accounting

Reviewed 2026-09-25. Budgets now protect **configured cost estimates**, not exact vendor invoices. Provider prices and FX defaults in the repository are illustrative; operators must supply appropriate rates. Taxes, carrier surcharges, vendor-specific pricing, template/media pricing and invoice reconciliation are not implemented.

## Send lifecycle

1. The provider worker reserves the estimated cost before calling the provider. A short PostgreSQL transaction serializes changes for the team and compares committed usage plus outstanding reservations plus the new estimate against the monthly cap. Policy reads are fresh, not taken from the five-second cache. Network delivery happens after the transaction closes.
2. Acceptance settles the reservation into the ledger and monthly usage in one transaction. Retrying settlement cannot double-charge. A duplicated job cannot call the provider again.
3. A recognized preflight validation error or rate-limit rejection for a single recipient releases the reservation. Unclassified failures (even when labeled permanent), transient failures, thrown exceptions and failed multi-recipient requests retain the hold because acceptance may be uncertain or partial. A malformed success response is not proof of rejection. These holds need operator reconciliation; they never expire automatically.
4. An intentional failed-message replay gets a new execution ID. Its jobs reserve separately; jobs from the previous execution are ignored. Retries, fallback targets and cascade steps retain distinct accounting identities.
5. Sandbox dispatch bypasses production budget checks, reservations and charges.

Amounts use four decimal places. Estimates are rounded up to that accounting unit. Recipient fan-out and standard GSM-7/UCS-2 SMS segmentation contribute to the estimate, including extended characters and surrogate-pair boundaries. Actual vendor segmentation and charges can differ; see [Twilio's segment documentation](https://www.twilio.com/docs/glossary/what-sms-character-limit).

Reservations pin the currency conversion and UTC month at creation. Settlement after midnight/month rollover remains attributed to the original month. Unknown currencies and invalid numeric values fail closed. Redis-configured FX rates are synchronized before reservations and policy saves, at most once per minute; Redis failures retain the last in-memory rates. This is not an automatic market-rate feed.

## Policy API and console

Platform administrators can use `PUT /v1/admin/budgets/:team` with `monthlyBudget`, `currency` and `hardStop`. Platform readers can use `GET` at the same path. Tenant-scoped and sandbox credentials cannot manage this shared configuration. Writes require a registered team, a supported currency, a nonnegative amount below 100,000,000 with at most four decimal places, and a boolean hard-stop flag.

The console loads the selected team's saved policy, committed usage, reserved amount and remaining funds. Saves perform the real API request and report errors. Other existing policy controls are explicitly disabled previews; saving the budget does not deploy them.

The first policy includes already-recorded spend for the current UTC month, converted from ledger USD using the configured rate. Creating it is blocked while that month's earlier sends still have unresolved holds. Currency changes are rejected after accounting begins, preventing historical amounts from being relabeled. Lowering a cap does not undo prior accepted sends or reservations; subsequent reservations are blocked until sufficient funds are available. Soft caps continue accounting without rejecting new estimates. A depleted hard cap also blocks the existing dispatch-stage precheck, including free channels; direct worker reservations permit a zero-cost send when no additional spend is incurred.

Reports convert `usedBudgetUsd` and `remainingBudgetUsd` into actual USD units and include outstanding reservations when calculating utilization and remaining funds. Teams without a policy no longer receive an invented $1,000 budget.

## Rollout and reconciliation

- Initialize the complete canonical schema in a fresh development/test database before starting workers. Pre-release schemas are replaced explicitly rather than upgraded; see [baseline policy](schema-baseline.md).
- Reconcile historical `budget_usage` with the ledger before relying on a production cap. The migration preserves existing figures; it cannot establish which historical provider calls were charged.
- Review configured provider estimates and FX rates against the account's pricing. Unknown providers still use the existing generic estimate; it is not a verified vendor price.
- Investigate outstanding holds using `budget_reservations` filtered by team, month and `state = 'reserved'`. Correlate the opaque message ID, provider and timestamps with provider records.
- After confirming acceptance, use the internal `BudgetService.settle(id, 'committed')`. After confirming no acceptance, use `BudgetService.settle(id, 'released')`. These operations serialize with reservations and update accounting atomically. Never delete a hold or edit monthly totals to free funds while its outcome is unknown.
- If a worker crashes before sending or after acceptance, its hold remains until reconciliation. A committed charge does not guarantee all later message-status writes completed; repair status from provider evidence without re-sending the old job. There is no claim of exactly-once delivery across a third-party network.

## Verification

The dedicated budget suite exercises concurrent cap exhaustion, duplicate jobs and settlement, rollback after a ledger write failure, single rejection versus uncertain bulk acceptance, sandbox isolation, intentional replays and stale jobs, month rollover, FX conversion, tiny-cost rounding, SMS segmentation, policy edits, existing spend, invalid values and report currency units. Strict-auth tests verify the actual read/write endpoints and role boundaries. Console tests verify saved state and load failure behavior.

At this revision, 1,018 server tests, 17 strict-auth tests and 143 console tests pass locally; all six workspace typechecks pass. Biome retains three existing warnings. Hosted PR checks are the final merge gate. No production deployment or vendor billing reconciliation was performed.

## Operator reconciliation

The Policies console lists the oldest 200 unresolved reservations for the selected team. Holds older than one hour are highlighted and exported as `convey_budget_stale_reservations` for alerting. Investigate provider records before resolving a hold. Confirming a charge commits its original estimate; releasing it requires evidence that no acceptance/charge occurred. Reconciliation, accounting and an immutable evidence record in `budget_reconciliations` commit in one transaction. Retries of the same outcome are idempotent; conflicting outcomes and cross-team IDs are rejected. Only platform administrators can write through the API. The record stores the authenticated API-key ID, team, outcome, reason and timestamp.

Set provider `unitCost` and `baseCurrency` through registration, or set `config.pricing` to `{ "cost": 0.01, "currency": "USD" }`. Production sends require explicit pricing; unsupported currencies, negative and non-finite costs are rejected. Changes affect new reservations only. Existing reservations retain their original price and exchange rate. Reconciliation confirms estimates, not final vendor invoice amounts.
