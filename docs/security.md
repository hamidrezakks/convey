# Convey security contract

This describes the hardening implementation, not a compliance certification or a claim that every subsystem has been audited. See the [migration runbook](operations/hardening-migration.md) and [verification report](operations/hardening-verification.md).

## Credentials and authorization

API keys are hashed before database storage. Authentication checks an active key, active tenant, expiry and registered team ownership on each request. Revocation takes effect without waiting for a credential cache. User-supplied role headers do not grant authority.

| Credential | Reads | Writes |
| --- | --- | --- |
| Tenant DEVELOPER or ORG_ADMIN | Its team's application resources | Its team's application resources |
| Tenant SUPPORT_AGENT or AUDITOR | Its team's application resources | Denied |
| Platform-scoped credential | Platform administration | Requires ORG_ADMIN |
| Sandbox-only credential | Its team's sandbox messages | Sandbox dispatch; shared configuration, platform administration and plugins denied |

Platform scope is intentionally privileged. Tenant scope does not become platform scope just because the role is ORG_ADMIN. The console requires platform scope and keeps its key in memory only.

The `team_owners` registry makes team identifiers globally unique across tenants. Public message status/history/trace, receipts and replay operations check team and sandbox scope. Bulk dispatch validates every team's ownership before writing. Internal worker service methods remain privileged and must not be exposed directly as public routes.

## Endpoint boundaries

| Surface | Boundary |
| --- | --- |
| Message, template, batch, DLQ and sandbox APIs | Valid API key, stored role, resource scope |
| `/v1/admin/*` | Platform scope; mutation requires ORG_ADMIN |
| `/v1/auth/session` | Valid API key; returns identity, never the secret |
| Plugin inbox and preferences | Identity checked against core API; tenant and team must match |
| Unsubscribe links | Token-based public flow; no operator key required |
| Inbound provider webhooks | Signature, timestamp and duplicate enqueue protection |
| Client receipts | API key and ownership of referenced message |
| Health, metrics and API documentation | Public routes; restrict through deployment network policy |

The console environment selector is not a separate staging deployment. Use separate infrastructure for independent staging data and secrets.

## Signed webhook ingress

There is no verified native signature implementation for every provider in the catalog. A registered native verifier takes precedence; otherwise configure a trusted signing gateway. The gateway must validate the original vendor signature before signing a request for Convey.

1. Set `CONVEY_WEBHOOK_SECRET_<PROVIDER_ID>` (upper case, hyphens replaced by underscores), or the shared fallback `CONVEY_WEBHOOK_SECRET`.
2. Set `x-convey-webhook-timestamp` to Unix seconds as ten decimal digits.
3. Calculate HMAC-SHA256 with the configured secret over `timestamp + "." + exact_raw_body`.
4. Send the lowercase or uppercase hexadecimal digest in `x-convey-webhook-signature`.

Convey verifies the exact body before parsing JSON or form data. Timestamps outside ±300 seconds, absent configuration and malformed/tampered signatures are rejected. Maintain clock synchronization on the signing gateway and server. The Meta subscription challenge also requires an explicitly configured `META_WEBHOOK_VERIFY_TOKEN`; no predictable fallback is provided.

The queue uses a deterministic identifier derived from provider, flow and body, and retains completed/failed jobs for 24 hours. This suppresses duplicate enqueue within the retention window; it is not permanent exactly-once processing. Identical legitimate callback bodies can also deduplicate during that period. Queue write failures return an error so the sender can retry.

`CONVEY_ALLOW_UNSIGNED_WEBHOOKS=true` is only honored outside production. It exists for isolated tests and simulators. Do not use it as production migration strategy.

## Logs and storage

The production structured logger recursively masks recognized credential and recipient metadata keys. This does not sanitize every possible free-form error string or arbitrary field name. Keep secrets out of log messages.

The repository has payload encryption and DLP utilities. Their presence is not a guarantee that every table, queue, vendor credential or log is encrypted or redacted. `PAYLOAD_ENCRYPTION_KEY` currently has a development fallback: explicitly configure and securely preserve your own key. Key loss may make stored envelopes unreadable. Audit actual storage paths and backups for your deployment rather than relying on the older “zero plaintext” claims.

No legal or regulatory certification is asserted by this project.
