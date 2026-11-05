# Security and payload encryption

The maintained [security contract](../docs/security.md) defines Convey's authentication, authorization, signed webhook ingress and storage boundaries. The project does not assert a regulatory certification or guarantee that every storage or logging path is encrypted or sanitized.

## Authentication and scope

Credentials are hashed in storage and checked against active keys, tenants, registered team ownership, expiry and sandbox scope. Request headers cannot grant roles. Tenant keys access their own team's resources; platform administration requires platform scope, with ORG_ADMIN for writes. The console retains its platform credential in tab memory.

Use the provisioning instructions in the [root README](../README.md). The [API access inventory](../docs/operations/api-access-matrix.md) records registered routes and their expected boundaries.

## Payload key management

Configure `PAYLOAD_ENCRYPTION_KEY` or the versioned `PAYLOAD_ENCRYPTION_KEYS` ring with `PAYLOAD_ENCRYPTION_KEY_VERSION`. These are the supported configuration names; the older `CONVEY_ENCRYPTION_KEY` example was incorrect.

Follow [payload key management](../docs/operations/payload-key-management.md) for the actual envelope format, key distribution, rotation, backup retention and failure behavior. Retain keys needed by existing ciphertext and backups. There is no automatic re-encryption command. Do not infer that metadata, queue records, provider credentials or free-form logs are protected merely because encryption or DLP utility classes exist.

## Webhooks and the recipient gateway

Provider callbacks fail closed without a registered verifier or the configured timestamped Convey HMAC. A trusted signing ingress must validate the vendor signature before signing the exact raw bytes for Convey. See [the signing protocol](../docs/security.md#signed-webhook-ingress).

The optional [recipient gateway](../apps/gateway/README.md) has a different purpose: it resolves missing addresses under verified tenant/team/sandbox scope. It preserves callback bytes and delegates signature verification to Convey; it does not implement a trusted webhook signing ingress. Caller credentials go only to Convey, and directory requests use a dedicated customer token.

Review the [hardening verification report](../docs/operations/hardening-verification.md) and [deployment guidance](../docs/deployment-docker.md) for tested boundaries and deployment responsibilities.
