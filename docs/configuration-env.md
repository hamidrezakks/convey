# Configuration and environment variables

This reference describes settings consumed by the current implementation. Core parsing lives in `apps/server/src/config/env.ts`; encryption, webhook, console and plugin settings are read by their respective modules. Convey is pre-release. See [schema policy](operations/schema-baseline.md) before changing stores.

## Core server settings

| Variable | Default | Behavior |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listener port; binds to `0.0.0.0`. |
| `NODE_ENV` | `development` | `development`, `test`, `production`. Normal entrypoint skips listening in test mode. |
| `LOG_LEVEL` | `info` | `trace`, `debug`, `info`, `warn`, `error`. |
| `CONVEY_REQUIRE_AUTH` | `true` | Boolean or string `true`/`false`; production rejects disabled auth. |
| `POSTGRES_DB` | `db-convey` | Explicit database name overrides the path in a valid `DATABASE_URL`. |
| `DATABASE_URL` | `postgres://user:password@localhost:5432/db-convey` | PostgreSQL connection string; replace placeholder credentials. |
| `DB_MAX_CONNECTIONS` | `20` | Maximum core database pool size per server process. |
| `REDIS_URL` | `redis://localhost:6379` | Redis-compatible endpoint for BullMQ and shared state. |
| `REDIS_KEY_PREFIX` | `convey` | Redis namespace and BullMQ prefix. |
| `BULLMQ_SCHEDULING_HORIZON_SECONDS` | `1800` | Near-term scheduling horizon; distant schedules are promoted from PostgreSQL. |
| `PAYLOAD_ENCRYPTION_KEY` | Optional outside production | Production requires a unique secret of at least 32 characters and rejects the development fallback. |

When `POSTGRES_DB` is unset, the database name is taken from the URL path or defaults to `db-convey`. When the URL itself is absent, Convey constructs the placeholder connection URL above. The database client fixes `idleTimeout` at 30 seconds and `connectTimeout` at 10 seconds; neither is an environment knob.

`HOST`, `CORS_ORIGIN`, `DB_NAME`, `DB_POOL_MIN`, `DB_POOL_MAX`, `DB_IDLE_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS`, `REDIS_MAX_CONNECTIONS`, `BULLMQ_CONCURRENCY`, `OUTBOX_POLL_INTERVAL_MS` and `OUTBOX_BATCH_SIZE` are not supported core variables. CORS is fixed in `apps/server/src/index.ts`. Queue polling and concurrency are configured in source.

Use a fresh database and Redis namespace when the pre-release schema or stored job format changes. Namespace isolation is not a substitute for persistence and restore testing. This configuration does not implement Redis Sentinel discovery.

## Authentication and credential bootstrap

Authentication checks an active API key, active tenant, expiry and registered team owner on each request. Revocation and suspension therefore apply on the next request. Supply the key in `Authorization: Bearer <key>` or `x-api-key`; client role headers do not grant authority.

Provision an active row in `tenants` using your database administration process, then run:

```sh
bun apps/server/scripts/create-api-key.ts TENANT_ID TEAM NAME ROLE SCOPE ENVIRONMENT
```

`ROLE` is `ORG_ADMIN`, `DEVELOPER`, `SUPPORT_AGENT` or `AUDITOR`; `SCOPE` is `tenant` or `platform`; `ENVIRONMENT` is `sandbox` or `production`. Optional defaults are `DEVELOPER tenant production`. The script prints the secret once and stores its hash. An API-key trigger registers the team owner and rejects teams belonging to another tenant.

The body `team` and SDK team must match the key's globally unique team. For application sends, use a tenant `DEVELOPER` credential. For console administration, explicitly create a platform credential, such as `ORG_ADMIN platform production`. Sandbox-only keys use the `/v1/sandbox` route group and cannot administer shared configuration. See [security boundaries](security.md) and [README setup](../README.md#local-setup).

`CONVEY_REQUIRE_AUTH=false` is only an isolated non-production development bypass. Production rejects it.

## Encryption and key versions

| Variable | Behavior |
| --- | --- |
| `PAYLOAD_ENCRYPTION_KEYS` | Optional JSON object of positive integer versions to secrets, each at least 32 characters. |
| `PAYLOAD_ENCRYPTION_KEY_VERSION` | Active version, default `1`, when a key ring is configured. Must exist in the ring. |

Generate independent secrets with `openssl rand -hex 32`. `PAYLOAD_ENCRYPTION_KEY` is still required in production when the ring is configured. Keep the exact old secret associated with its version, deploy the complete ring to all server processes, then select the new version and restart consistently. Unknown versions fail closed. Keep old keys while records or backups require them. There is no automatic re-encryption command, production mock KMS is prohibited, and external tenant KMS encryption is not implemented.

The supported master-key variable is `PAYLOAD_ENCRYPTION_KEY`; `CONVEY_ENCRYPTION_KEY` is not an alias. Durable recipient revocation denies application decryption; derived keys remain reproducible from the master and backups, so it is not cryptographic erasure.

## Webhook ingress

| Variable | Behavior |
| --- | --- |
| `CONVEY_WEBHOOK_SECRET` | Convey ingress HMAC secret; required for the Convey signed ingress path. |
| `CONVEY_ALLOW_UNSIGNED_WEBHOOKS` | Exact string `true` permits unsigned ingress only outside production; otherwise disabled. |
| `META_WEBHOOK_VERIFY_TOKEN` | Meta/WhatsApp GET challenge token, separate from POST signature verification. |

Meta challenge fallback aliases, in order, are `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_VERIFY_TOKEN` and `META_VERIFY_TOKEN`. Incoming POSTs fail closed if they cannot be verified. Providers without a native verifier require a trusted gateway that validates the vendor and adds Convey's timestamped HMAC over the exact raw body. Provider secrets and replay rules are documented in [security](security.md).

Outgoing customer webhook subscription secrets are stored per subscription. `CONVEY_WEBHOOK_SIGNING_SECRET` is not a global outgoing-webhook setting.

## Console and optional plugins

| Variable | Consumer | Default |
| --- | --- | --- |
| `CONVEY_API_INTERNAL_URL` | Console proxy and plugins authentication | `http://localhost:3000` |
| `CONVEY_PLUGINS_INTERNAL_URL` | Console proxy | `http://localhost:3001` |
| `VITE_API_URL` | Console browser code, at build time | Empty: same-origin core proxy |
| `VITE_PLUGINS_URL` | Console browser code, at build time | Empty: same-origin plugin proxy |
| `PLUGINS_PORT` | Plugins listener | `3001` |

The production console's `apps/web/server.ts` proxies core and plugin requests to internal URLs. Vite development proxies use the same internal variables. Browser-visible Vite URLs are compiled into the bundle; the Dockerfile does not automatically take them as build arguments. The plugin database reads `DATABASE_URL` directly, so its path must agree with the core's effective `POSTGRES_DB`.

## Container and Compose settings

`AUTO_MIGRATE` is read by `docker-entrypoint.sh`, defaults to `true`, and runs schema initialization when equal to `true` or `1`. It is not a native API setting. Compose interpolation settings include `WEB_PORT` (`5173`), `POSTGRES_PORT` (`5432`), `REDIS_PORT` (`6379`), `MOCK_GATEWAY_PORT` (`4000`), `POSTGRES_USER` and `POSTGRES_PASSWORD` (both development default `convey`). Review [container deployment](deployment-docker.md) before using them.

Bun loads `.env` for native commands. Compose uses `.env` for interpolation, and only its declared `environment` entries reach containers. Settings such as key rings and provider credentials not passed by an existing Compose file require an explicit environment override. Keep secrets outside source control.

## Provider and policy configuration

Provider bootstrap loads enabled database records and decrypts their credentials into explicit configuration. `normalizeProviderConfig` translates uppercase vendor field names inside configuration objects; it does not read `process.env`. Worker setup scans configured providers at startup, and provider changes can notify running workers through Redis PubSub. No propagation-time guarantee is implied.

The root example contains simulator values for Resend, SendGrid, Twilio, Slack and PagerDuty. Those legacy example variables do not automatically configure current adapters; use the console or platform administration API for delivery configuration. Configuration field mappings are defined in `apps/server/src/modules/providers/core/provider-config.ts`; inspect the selected provider's adapter and [implementation audit](provider-porting-matrix.md), rather than assuming catalog presence means delivery is implemented. Passing legacy provider variables through Compose alone does not create a configured provider.

Routing, budget and rate-limit policies are database-backed administrative configuration. See [budget accounting](operations/budget-enforcement.md) for enforcement and reconciliation behavior. The Go recipient-resolution gateway has its own [configuration and usage](../apps/gateway/USAGE.md).
