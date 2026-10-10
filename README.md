# Convey

Convey is a standalone communication service built with Bun, Elysia, PostgreSQL and BullMQ. It accepts messages, records them with a transactional outbox, and dispatches through provider adapters. The repository includes an operator console, optional inbox/preferences plugins, and TypeScript, Go and Python SDKs.

## Current status

Convey is **pre-release**. Schema changes update the canonical CREATE definitions; use fresh disposable stores after a baseline change. Backward compatibility starts with the first published release. See the [schema and release policy](docs/operations/schema-baseline.md).

The production-hardening branch adds authenticated administration, database-backed roles, team ownership, scoped message access, signed webhook ingestion, recoverable outbox claims and release validation. The review fixes pass the canonical-schema server, security, console, plugin and SDK checks. This is **not a production-readiness certification**; see [verification results and rollout requirements](docs/operations/hardening-verification.md) before deploying.

Implemented paths include message acceptance and scheduling, team-scoped idempotency, provider dispatch, message history, failed-message replay, and the authenticated console. Public message identifiers are opaque `msg_<ULID>` values.

Experimental resilience utilities, benchmark results and provider catalog entries are not evidence of tested multi-region failover, guaranteed throughput, or delivery support for every vendor. Some overview tiles still use illustrative values. Use the documented [operational metrics](docs/operations/metrics.md) for alerting.

## Repository

| Directory | Purpose |
| --- | --- |
| `apps/gateway` | Go recipient-resolution proxy for non-admin APIs; [usage examples](apps/gateway/USAGE.md) and [adapter contract](apps/gateway/README.md) |
| `apps/server` | HTTP API, workers, database migrations and provider modules |
| `apps/web` | React operator console and same-origin production proxy |
| `apps/plugins` | Optional inbox and preference APIs |
| `apps/mock-server` | Local provider simulator |
| `apps/website` | Documentation website |
| `packages/sdk`, `packages/sdk-go`, `packages/sdk-py` | Client SDKs |

## Local setup

Use the Bun version in `.bun-version`, PostgreSQL 18 and a compatible Redis service. Use a disposable database for tests; several integration tests create or remove fixtures.

```sh
bun install --frozen-lockfile
cp .env.example .env
# Configure DATABASE_URL and REDIS_URL for your local services.
bun run db:migrate
bun run dev:server
```

Authentication is enabled by default. Provision an active tenant through your database administration tool. For a disposable local setup, run this SQL against the initialized database:

```sql
INSERT INTO tenants (id, name, status)
VALUES ('local-tenant', 'Local development', 'active');
```

Then create a credential for its globally unique team:

```sh
bun apps/server/scripts/create-api-key.ts local-tenant local-team application DEVELOPER tenant production
```

The key insertion trigger registers `local-team` to `local-tenant` and rejects teams already owned by another tenant. The command prints an `sk_live_` secret once and stores only its hash. Keep the secret outside source control. Send it as `Authorization: Bearer <key>` or `x-api-key`. The message's `team` must match the key's team; SDK configuration must use the same team.

For the operator console, explicitly provision a platform credential:

```sh
bun apps/server/scripts/create-api-key.ts local-tenant local-team operator ORG_ADMIN platform production
bun run dev:plugins
bun run dev:web
```

Configure delivery providers through the console or platform administration API. Provider records store encrypted credentials; the root `.env.example` provider values do not automatically configure the current adapters. Sign in with that platform key. It remains in tab memory and is cleared on reload or sign-out. Platform administration is privileged and may expose cross-team operations; do not use its key in client applications.

For an isolated local experiment only, `CONVEY_REQUIRE_AUTH=false` enables a development bypass. Production rejects this setting. Prefer authenticated development for realistic testing.

## Containers and deployment

The root Dockerfile has `server`, `web`, `plugins` and `mock-server` targets. The server starts HTTP and workers in the same process. Compose builds local application images; no published image or separate worker command is assumed. The console forwards requests to `CONVEY_API_INTERNAL_URL` and `CONVEY_PLUGINS_INTERNAL_URL`; these are runtime internal service addresses, not public browser addresses. The development console uses Vite proxies; optional `VITE_API_URL` and `VITE_PLUGINS_URL` configure browser-visible API origins at build time.

`docker-compose.yml` includes provider simulation and development credentials. Review it before use; it is not a turnkey production deployment. `docker-compose.service.yml` connects applications to an existing service network. Terminate HTTPS, restrict infrastructure and monitoring ports, configure backups and set independent secrets before exposing a deployment.

Pre-release baseline or queue-format changes require fresh disposable stores; the initializer rejects changed baselines without upgrading or deleting data. Follow the [schema policy](docs/operations/schema-baseline.md), and review the [hardening rollout constraints](docs/operations/hardening-migration.md). Arrange signed webhook ingress before exposing callbacks.

For container-network URLs, secrets, resource/service Compose setup and health checks, use the [Docker deployment guide](docs/deployment-docker.md). The Go gateway has its own [usage and deployment instructions](apps/gateway/USAGE.md). The documentation website has a separate [website deployment guide](docs/deployment-website.md).

## Webhooks

Webhook ingestion fails closed. Providers without a native verifier require a trusted ingress gateway which validates the vendor's signature and adds Convey's timestamped HMAC signature over the exact request body. Do not point unsigned vendor callbacks directly at the hardened API. Configuration, replay behavior and the signing protocol are in the [security contract](docs/security.md).

## Validation

```sh
bun run biome:check
bun run typecheck
bun run test:web
bun run test:sdks
# Only against an isolated test database and Redis instance:
bun run db:migrate
CONVEY_REQUIRE_AUTH=true bun test apps/server/tests/hardening
CONVEY_REQUIRE_AUTH=true bun test packages/sdk/tests/integration.test.ts
CONVEY_REQUIRE_AUTH=false CONVEY_ALLOW_UNSIGNED_WEBHOOKS=true bun run test:server:ci
```

The legacy suite requires `NODE_ENV=test` in addition to its explicit development bypass. Performance tests are separate (`bun run test:server:performance`); they must not run against production services. CI and release use the shared validation action. Release candidates are tested and built before tags or publishing; see [release management](docs/RELEASE_MANAGEMENT.md).

## Operational references

- [Migration and rollback](docs/operations/hardening-migration.md)
- [Provider implementation audit and unavailable integrations](docs/provider-porting-matrix.md)
- [Budget enforcement and accounting](docs/operations/budget-enforcement.md): guarantees, configuration, migration and reconciliation.
- [Verified behavior and remaining work](docs/operations/hardening-verification.md)
- [Security boundaries](docs/security.md)
- [Metrics and alert rules](docs/operations/metrics.md)
- [Queue topology](docs/queue-topology.md)
- [Provider catalog](docs/providers-reference.md)

Older architecture and benchmark documents describe design intent as well as implemented behavior. The security contract and verification report describe the checks performed on this branch; no throughput or availability guarantee is implied.
