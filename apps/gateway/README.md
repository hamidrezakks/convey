# Convey recipient gateway

An independent Go 1.27.1 service using Fiber 3.5.0 and Uber Fx 1.24.0. Applications send a `userId`; this gateway resolves missing delivery addresses and forwards the request to an existing Convey service. Convey remains independent of the customer directory. No database, Redis, migrations, or cross-request customer cache is required.

**The customer API is deliberately abstract.** The real endpoint is not known yet. `internal/customer.Resolver` is the application boundary; the included HTTP implementation is a reference contract, not an assertion about your customer service. Replace `NewResolver`'s Fx provider or adapt `customer.HTTP` when the service contract is available. Both single-user and native bulk lookup are supported.

## Run

```sh
cd apps/gateway
CONVEY_URL=http://localhost:3000 CUSTOMER_URL=http://localhost:4000 go run ./cmd/gateway
```

Only two origins are required. URLs must contain no credentials, base path, query or fragment. In production, use HTTPS or a trusted private network and your normal ingress access controls. The service reads environment variables directly; it does not automatically load `.env` files.

| Variable | Default | Purpose |
| --- | --- | --- |
| `CONVEY_URL` | required | Existing Convey API origin |
| `CUSTOMER_URL` | required | Customer API origin |
| `CUSTOMER_LOOKUP_MODE` | `single` | `single` GET lookups or `bulk` POST lookup |
| `CUSTOMER_LOOKUP_PATH` | `/v1/customers/{userId}` or `/v1/customers/resolve` | Adapter endpoint path for the chosen mode |
| `CUSTOMER_TOKEN` | absent | Dedicated customer API bearer credential, never the caller's Convey credential |
| `GATEWAY_LISTEN` | `:8080` | Listener address |

Use the same caller API key and SDK configuration as Convey, changing only the API base URL to this gateway. The gateway has no privileged Convey service key. It verifies message-submission credentials against `/v1/auth/session` before looking up customer data. Convey must have authentication enabled. Tenant and platform callers may enrich only their credential's own team; a missing team is filled from the verified identity. Read-only roles cannot trigger customer lookup.

## Send by user ID

```sh
curl http://localhost:8080/v1/messages \
  -H "Authorization: Bearer $CONVEY_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "customer-482",
    "idempotencyKey": "order-482-confirmation",
    "category": "transactional",
    "country": "US",
    "channels": [
      {"channel":"email","content":{"subject":"Order confirmed","text":"Thank you!"}},
      {"channel":"sms","content":{"text":"Order 482 confirmed."}}
    ]
  }'
```

The gateway fills `recipients.email` and `recipients.phone`; Convey dispatches both channels. Explicit nonempty recipient fields take precedence. `userId` remains required. The gateway looks up missing fields required by primary channels **and fallback/cascade steps**, so a later SMS fallback also gets its phone number. It supports email, SMS, WhatsApp, Telegram, Slack, FCM and APNs using Convey's actual recipient fields. It does not infer a WhatsApp address from `phone`, and it does not copy unrelated profile data into messages.

Bulk requests use `POST /v1/messages/bulk` with `{"messages":[...]}` (or Convey's bare-array form), up to 500 items. The gateway validates all teams, deduplicates unresolved user IDs per request, and completes recipient resolution before making one bulk submission. A missing customer or required address rejects the entire gateway submission with 422. The downstream bulk API still owns acceptance semantics; this is not a new cross-service transaction guarantee.

## Customer adapter contract

The verified scope is supplied by Convey, never by inbound customer/tenant headers. The customer service must authorize the dedicated credential for this scope and honor sandbox isolation. The adapter checks returned scope and IDs before accepting data.

**Single mode:**

```http
GET /v1/customers/customer-482?team=orders
Authorization: Bearer <CUSTOMER_TOKEN, if configured>
X-Convey-Tenant-Id: tenant-1
X-Convey-Team: orders
X-Convey-Sandbox: false
```

```json
{
  "tenantId": "tenant-1",
  "team": "orders",
  "isSandbox": false,
  "userId": "customer-482",
  "recipients": {
    "email": "customer@example.test",
    "phone": "+12025550123",
    "whatsapp": "+12025550123",
    "telegramChatId": "123456",
    "slack": {"channelId": "C123"},
    "fcmTokens": ["example-fcm-token"],
    "apnsTokens": ["example-apns-token"]
  }
}
```

Return only available fields. Single lookups use at most eight concurrent HTTP requests within a submission and share its deadline. An HTTP 404 means missing customer. Other unsuccessful responses, malformed JSON or mismatched scope/IDs fail closed. Single-path IDs cannot contain slashes or be `.` or `..`; use a custom resolver/bulk protocol for alternate identifier semantics.

**Bulk mode:** set `CUSTOMER_LOOKUP_MODE=bulk`. The gateway makes one `POST /v1/customers/resolve` with the same trusted headers:

```json
{"tenantId":"tenant-1","team":"orders","isSandbox":false,"userIds":["customer-482","customer-483"]}
```

Return `{"customers":[<record above>, <second record>]}` with exactly one record per requested user. Extra IDs, duplicates, missing users and cross-scope records are rejected. A different REST endpoint, response envelope, GraphQL or gRPC service can implement:

```go
type Resolver interface {
    Resolve(context.Context, Scope, []string) (map[string]Recipients, error)
}
```

No HTTP or Fiber types cross this boundary. Resolver implementations must honor cancellation, scope checks and missing-user semantics. Tests inject an in-memory implementation.

## Proxy surface

An explicit method/path allowlist covers every non-admin route in `docs/operations/api-access-matrix.md`. A test fails when that inventory changes without updating the gateway.

- Messages, bulk submission, status, timeline, trace and template previews
- Templates, versions, partials, rendering and publishing
- Batch lifecycle, suppressions, webhook subscriptions and tests
- Delivery receipts, sandbox messages, DLQ replay and mutated replay
- Auth session, signed provider webhook ingress and tracking-token URLs

Only message creation and bulk creation receive enrichment. Batch lifecycle endpoints do not contain message bodies. Replay endpoints use stored recipients; this gateway does not silently refresh contacts during replay. Webhook bodies remain byte-for-byte unchanged. Headers, query strings, upstream statuses, redirects and error bodies pass through with hop-by-hop and untrusted forwarding headers removed. Provider verification remains Convey's responsibility. URL-based vendor signature verification must use the externally registered callback URL at the trusted ingress; moving such a callback to a different host requires updating that integration.

Admin routes, unknown methods/routes, metrics and Swagger are not exposed. Canonically encoded API paths are required; encoded route segments, duplicate slashes and dot-segment paths are rejected. `/healthz` and `/readyz` describe the gateway listener only, not the health of both remote services. Dependency errors surface on requests. Optional plugin APIs belong to a separate application and are not proxied by this server gateway.

## Reliability and privacy

- 4 MiB incoming body/customer response limit, 32 MiB upstream response limit, 15-second end-to-end deadline and bounded outbound connections.
- No automatic POST retries and no redirect following. Retry-after/status information is returned to the caller.
- Caller auth is forwarded only to Convey. The customer adapter receives only its dedicated token and verified scope.
- Logs contain method, status and duration, without bodies, query strings, user IDs, addresses or credentials.
- Fx binds the listener during startup and drains Fiber during shutdown. The image runs as UID 10001.
- Explicit recipient overrides are permitted, matching Convey's API. This is not a policy limiting users to their own addresses.

Convey's existing idempotency key is preserved. Fresh lookup on a retry can observe changed contact information and cause Convey's payload-conflict response. The gateway deliberately does not hide that with a stale PII cache. Save an accepted message ID and inspect its outcome; for exact payload replay, retain the originally resolved recipient snapshot in your trusted application workflow. An unresolved send must not be resubmitted with a new key merely to bypass a conflict.

## Verification and container

```sh
go test -race ./...
go vet ./...
docker build -t convey-gateway apps/gateway  # from repository root
```

Tests use local mock servers only. They cover scope/role rejection before lookup, recipient overrides, all channel fields, fallback/cascade address collection, bulk lookup deduplication/failures, raw callbacks, redirects, upstream errors, deadlines, bounded lookup concurrency, API inventory parity and Fx startup/shutdown. Actual customer integration remains dependent on an agreed customer-service contract.

### Local qualification

The feature branch passed 16 top-level tests (plus table/subtests) with the race detector, `go vet`, the repository Biome check (three pre-existing warnings), and a non-root/read-only container startup and graceful-stop smoke test. `govulncheck` v1.8.0 reports no affected symbols or imported packages. Its remaining module-only advisory is GO-2026-5932 for the unused `golang.org/x/crypto/openpgp` package. No real customer service or delivery provider was contacted. Hosted CI was not awaited.
