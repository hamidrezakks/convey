# Docker and container deployment

Convey is pre-release. The checked-in Dockerfile and Compose files support development and evaluation; they are not a production-readiness certification. Review [verified behavior](operations/hardening-verification.md), [schema policy](operations/schema-baseline.md), [security](security.md) and [configuration](configuration-env.md) before external exposure.

## Images and service topology

The root Dockerfile uses Bun `1.4.0` and has four application targets:

| Target | Entrypoint | Default port |
| --- | --- | --- |
| `server` | `docker-entrypoint.sh`, then `bun apps/server/src/index.ts` | `3000` |
| `web` | `bun apps/web/server.ts` | `5173` |
| `plugins` | `bun apps/plugins/src/index.ts` | `3001` |
| `mock-server` | `bun apps/mock-server/src/index.ts` | `4000` |

The server starts the API and workers together; no separate `bun run worker` script is supplied. The Go [recipient gateway](../apps/gateway/USAGE.md) has a separate `apps/gateway/Dockerfile`, and is not a service in the root Compose files. The documentation website also runs separately (`bun run dev:website`, port `5174`); see [website deployment](deployment-website.md) for its own container and CI configuration.

Build local images from the repository root:

```sh
docker build --target server -t convey-server:local .
docker build --target web -t convey-web:local .
docker build --target plugins -t convey-plugins:local .
docker build --target mock-server -t convey-mock-server:local .
```

Compose builds its application targets and sets local image tags where specified. Do not assume a published `convey/server` image. No Kubernetes manifests or Helm chart are provided.

## Unified evaluation stack

`docker-compose.yml` includes PostgreSQL 18, DragonflyDB, server, plugins, console and a mock gateway with provider-domain aliases. Copy `.env.example` to `.env`, then adjust connection URLs for the container network:

```ini
NODE_ENV=production
CONVEY_REQUIRE_AUTH=true
POSTGRES_DB=db-convey
DATABASE_URL=postgres://convey:convey@postgres:5432/db-convey
REDIS_URL=redis://redis:6379
```

Set independent generated values for `PAYLOAD_ENCRYPTION_KEY` and `CONVEY_WEBHOOK_SECRET` (`openssl rand -hex 32` for each). Production rejects missing or invalid encryption secrets. The native `localhost` URLs in `.env.example` cannot reach another container; override them explicitly. Keep PostgreSQL credentials and names consistent with the database service and plugin connection URL.

```sh
docker compose up -d --build
docker compose ps
docker compose logs convey-server
curl --fail http://localhost:3000/health/readiness
```

This stack contains development credentials and mock provider configuration. Signed webhook ingestion can reject unsigned simulator callbacks. An accepted message or simulated send does not prove real-provider delivery. Do not use simulator domain aliases for a live provider deployment.

After initialization, provision an active tenant using PostgreSQL administration and create a key inside the server container:

```sh
docker compose exec convey-server   bun apps/server/scripts/create-api-key.ts TENANT_ID TEAM application DEVELOPER tenant production
```

The script registers globally unique team ownership and prints the secret once. Application requests must use that team. Create an `ORG_ADMIN platform production` credential separately for console administration. See [README setup](../README.md#local-setup).

`docker compose down` stops the unified stack while preserving its data volumes. Volume deletion removes local data and must be a deliberate disposal decision, never an upgrade method.

## Separate resources and applications

`docker-compose.resources.yml` creates PostgreSQL, DragonflyDB and the `convey-network` bridge. `docker-compose.service.yml` expects that external network and starts server, plugins and console. Start infrastructure and confirm health before starting applications.

For this topology, set the database URL to the resource container and the Redis URL to its actual network alias:

```ini
DATABASE_URL=postgres://convey:convey@convey-postgres:5432/db-convey
REDIS_URL=redis://redis:6379
```

The service file's `convey-redis` fallback does not match the resource's `convey-dragonfly` container or aliases; explicitly configuring the working `redis` alias avoids that mismatch. Supply authentication/encryption/webhook settings as above, and remove mock credentials when using real vendors.

```sh
docker compose -f docker-compose.resources.yml up -d
docker compose -f docker-compose.resources.yml ps
docker compose -f docker-compose.service.yml up -d --build
docker compose -f docker-compose.service.yml logs convey-server
```

The console proxies core requests through `CONVEY_API_INTERNAL_URL=http://convey-server:3000` and plugin requests through `CONVEY_PLUGINS_INTERNAL_URL=http://convey-plugins:3001`. Plugins are internal on port `3001`; the console's default host port is `5173`. The checked-in files expose PostgreSQL and Redis ports; restrict these before external deployment.

## Provider simulation overlay

`docker-compose.providers.yml` adds discrete provider simulators. Use it with the base file:

```sh
docker compose -f docker-compose.yml -f docker-compose.providers.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.providers.yml logs mock-resend
```

These simulators and the repository's Docker test scripts are evaluation tools, not production certification. Use isolated stores for destructive fixtures and review script prerequisites before running them.

## Canonical schema initialization

The server entrypoint defaults `AUTO_MIGRATE` to `true`. Values `true` or `1` run `bun apps/server/src/db/migrate.ts` before executing the server command. This initializes the current canonical baseline and monthly partitions, from three months back through six months ahead. The baseline fingerprint protects existing data: unchanged baselines are repeatable; changed baselines or nonempty unmarked schemas are rejected.

To control initialization explicitly, set `AUTO_MIGRATE=false` for normal startup, then initialize once:

```sh
docker compose -f docker-compose.service.yml run --rm -e AUTO_MIGRATE=false   convey-server bun apps/server/src/db/migrate.ts
```

Convey does not drop or upgrade development data. After schema or persisted queue changes, stop producers/workers and provision fresh disposable databases and queue namespaces. Preserve anything needed separately. Initialize core storage before optional plugin startup. Forward migrations begin with the first release.

## Health, shutdown and deployment requirements

| Endpoint | Behavior |
| --- | --- |
| `GET /health/liveness` | Process responds; root image healthcheck uses this path. |
| `GET /health/readiness` | Bootstrap readiness and component/worker state; `503` when unready. |
| `GET /health` | Live DB/Redis connectivity and readiness details. |
| `GET /metrics` | Prometheus exposition; restrict monitoring access. |
| `GET /swagger` | OpenAPI UI; apply network/access restrictions as needed. |
| Mock `GET /health` | Simulator health only. |

The readiness endpoint reports bootstrap state; it is not an end-to-end delivery probe. The aggregate `/health` endpoint actively checks database and Redis connectivity.

On `SIGTERM` or `SIGINT`, the shutdown orchestrator marks readiness false, stops polling and maintenance, awaits worker closures, flushes buffers and closes connections. It does not close the listener first or enforce a fixed 15-second drain deadline. Arrange ingress removal on unready instances and sufficient termination time, then qualify interruption/recovery with your workload.

Before live exposure, configure HTTPS, independent credentials and secrets, infrastructure network restrictions, durable queue storage and tested backups/restores. The supplied DragonflyDB command enables cache mode and does not establish production queue durability merely by mounting a volume. Pin and validate infrastructure images, test signed vendor callback ingress, and use [operational metrics](operations/metrics.md) for alerts. Validate actual providers, load, retry behavior and recovery in your deployment before making throughput, availability or zero-data-loss claims.
