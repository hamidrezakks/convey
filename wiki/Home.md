# Convey developer and architecture wiki

Convey is a pre-release communication service built with Bun, Elysia, PostgreSQL 18 and BullMQ with a Redis-compatible queue store. The repository includes an operator console, optional inbox/preferences plugins, TypeScript/Go/Python SDKs, and an optional Go recipient gateway.

Start with the [root README](../README.md) for authenticated setup and the [V1 contract candidate](../docs/operations/v1-contracts.md) for supported claims and limitations. Acceptance is not delivery. Provider catalog entries and local benchmark results do not establish live-provider certification, a production SLA or multi-region correctness.

## Guides

- [Per-channel request examples](Per-Channel-Examples-and-Payloads.md)
- [Security and payload encryption](Zero-Trust-Security-and-Encryption.md)
- [Resilience and operational tools](Planetary-Scale-Resilience-Architecture.md)
- [Recipient gateway usage](../apps/gateway/USAGE.md): user-ID resolution, overrides, bulk requests and Docker setup.
- [Gateway batching and measured performance](../apps/gateway/PERFORMANCE.md)

## Implementation references

| Reference | Scope |
| --- | --- |
| [Architecture](../docs/architecture.md) | API, persistence and workers |
| [REST API](../docs/api.md) | Message payloads and routes |
| [Database schema](../docs/database-schema.md) | Persistence model |
| [Queue topology](../docs/queue-topology.md) | Dispatch and background processing |
| [Provider certification](../docs/operations/provider-certification.md) | Evidence and qualification limits |
| [Budget enforcement](../docs/operations/budget-enforcement.md) | Reservations, caps and reconciliation |
| [Security contract](../docs/security.md) | Credentials, scope and signed ingress |
| [Operational metrics](../docs/operations/metrics.md) | Metrics used for alerting |
| [Schema baseline policy](../docs/operations/schema-baseline.md) | Fresh stores for changed pre-release baselines |
| [Release management](../docs/RELEASE_MANAGEMENT.md) | Validation and publication |

## Local verification

```sh
bun run biome:check
bun run typecheck
bun run test:sdks
bun run test:gateway
bun run simulate:gateway
```

Database-backed tests and benchmarks require isolated disposable stores. Follow the root README's test environment instructions before running them. The gateway simulator uses its own loopback mock services and does not send real notifications.
