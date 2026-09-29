# Customer recipient gateway

1. Define a stateless Go/Fiber/Fx service and customer lookup contract. Pin current stable dependencies. No database or schema changes.
2. Implement explicit non-admin route forwarding, verified tenant context, missing-recipient enrichment for single/bulk submissions, bounded I/O and lifecycle management.
3. Exercise real HTTP mocks: authentication boundaries, channel/fallback recipients, bulk failures, raw webhook bytes, transparent upstream errors, timeouts, and route inventory coverage.
4. Add a non-root container, minimal configuration, operator/client examples and CI. Review locally, commit each step, open a stacked PR without waiting for hosted CI.

Customer API is intentionally unspecified by the owner. The Resolver interface supports single or bulk adapters; the included configurable HTTP reference contract uses single GET /v1/customers/{userId}?team=... with verified X-Convey-Tenant-Id, X-Convey-Team and X-Convey-Sandbox headers. Return tenantId, team, userId and recipients. Never use unverified caller tenant headers. Optional dedicated customer bearer token. This contract must match the actual customer service before live use.

Convey owns authorization, delivery and idempotency. The gateway authenticates enriched sends with /v1/auth/session before customer lookup. Customer data is not cached across requests; changed contact data can cause a safe upstream idempotency conflict on a retry. No automatic send retries or hidden durable state.
