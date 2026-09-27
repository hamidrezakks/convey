# Provider certification gates

A catalog entry is not a live delivery certificate. The 20 incomplete native adapters remain unavailable, regardless of credentials, registry overrides, or administrative registration. Seeding creates disabled entries and never overwrites existing credentials. Production sends require an explicit validated price in provider configuration: `pricing: { cost: number, currency: string }`; admin registration's `unitCost` and `baseCurrency` persist this configuration. Estimates are not invoice reconciliation.

To enable an incomplete adapter, submit the implementation with vendor-specific offline contract fixtures covering:

1. Request URL, authentication, exact payload, recipient encoding and batch semantics.
2. Successful acceptance and malformed/partial responses without false success.
3. Permanent errors, throttling, timeout and uncertain acceptance.
4. Signed receipt verification, parsing, account correlation, duplicates and out-of-order events (or explicit evidence that receipts are unsupported).
5. The test file paths and vendor API version in `provider-certification-evidence.json`.

The readiness regression checks the original unavailable cohort against that evidence file. Generic adapter-shape tests cannot satisfy the gate. The full contract suite must pass before removing an adapter from the unavailable list.

Live certification additionally requires designated vendor test accounts and approved recipients, observed delivery receipts and pricing reconciliation against vendor records. No live certification is implied by fixture tests. Record live certification separately with date, API version, environment and redacted evidence.
