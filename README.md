# Convey

Convey is a standalone communication service built with Bun, Elysia, PostgreSQL and BullMQ. It accepts messages, records them with a transactional outbox, and dispatches through provider adapters. The repository includes an operator console, optional inbox/preferences plugins, and TypeScript, Go and Python SDKs.

## Current status

The production-hardening branch adds authenticated administration, database-backed roles, team ownership, scoped message access, signed webhook ingestion, recoverable outbox claims and release validation. The review fixes pass the canonical-schema server, security, console, plugin and SDK checks. This is **not a production-readiness certification**; see [verification results and rollout requirements](docs/operations/hardening-verification.md) before deploying.

Implemented paths include message acceptance and scheduling, team-scoped idempotency, provider dispatch, message history, failed-message replay, and the authenticated console. Public message identifiers are opaque `msg_<ULID>` values.

Experimental resilience utilities, benchmark results and provider catalog entries are not evidence of tested multi-region failover, guaranteed throughput, or delivery support for every vendor. Some overview tiles still use illustrative values. Use the documented [operational metrics](docs/operations/metrics.md) for alerting.

## Repository

| Directory | Purpose |
| --- | --- |
| `apps/server` | HTTP API, workers, database migrations and provider modules |
| `apps/web` | React operator console and same-origin production proxy |
| `apps/plugins` | Optional inbox and preference APIs |
| `apps/mock-server` | Local provider simulator |
| `apps/website` | Documentation website |
| `packages/sdk`, `packages/sdk-go`, `packages/sdk-py` | Client SDKs |

## Local setup

Use the Bun version in `.bun-version`, PostgreSQL 18 and a compatible Redis service. Use a disposable database for tests; several legacy tests create or remove fixtures.

```sh
bun install --frozen-lockfile
cp .env.example .env
# Configure DATABASE_URL and REDIS_URL for your local services.
bun run db:migrate
bun run dev:server
```

Authentication is enabled by default. Provision an active tenant through your database administration process, then create a credential for its globally unique team:

```sh
bun apps/server/scripts/create-api-key.ts TENANT_ID TEAM application DEVELOPER tenant production
```

The command prints the secret once and stores its hash. Keep the secret outside source control. Send it as `Authorization: Bearer <key>` or `x-api-key`. The message's `team` must match the key's team; SDK configuration must use the same team.

For the operator console, explicitly provision a platform credential:

```sh
bun apps/server/scripts/create-api-key.ts TENANT_ID TEAM operator ORG_ADMIN platform production
bun run dev:plugins
bun run dev:web
```

Sign in with that platform key. It remains in tab memory and is cleared on reload or sign-out. Platform administration is privileged and may expose cross-team operations; do not use its key in client applications.

For an isolated local experiment only, `CONVEY_REQUIRE_AUTH=false` enables a development bypass. Production rejects this setting. Prefer authenticated development for realistic testing.

## Containers and deployment

The Dockerfile has `server`, `web`, `plugins` and `mock-server` targets. The console forwards requests to `CONVEY_API_INTERNAL_URL` and `CONVEY_PLUGINS_INTERNAL_URL`; these are runtime internal service addresses, not public browser addresses. The development console uses Vite proxies; optional `VITE_API_URL` and `VITE_PLUGINS_URL` configure browser-visible API origins at build time.

`docker-compose.yml` includes provider simulation and development credentials. Review it before use; it is not a turnkey production deployment. `docker-compose.service.yml` connects applications to an existing service network. Terminate HTTPS, restrict infrastructure and monitoring ports, configure backups and set independent secrets before exposing a deployment.

Existing installations must follow the [hardening migration runbook](docs/operations/hardening-migration.md). In particular, resolve ambiguous team ownership and arrange signed webhook ingress before switching versions.

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
- [Verified behavior and remaining work](docs/operations/hardening-verification.md)
- [Security boundaries](docs/security.md)
- [Metrics and alert rules](docs/operations/metrics.md)
- [Queue topology](docs/queue-topology.md)
- [Provider catalog](docs/providers-reference.md)

Older architecture and benchmark documents describe design intent as well as implemented behavior. The security contract and verification report describe the checks performed on this branch; no throughput or availability guarantee is implied.
