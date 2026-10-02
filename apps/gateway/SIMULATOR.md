# Gateway simulator and mock qualification

Run from the repository root:

```sh
bun run simulate:gateway
```

Or, without Bun:

```sh
cd apps/gateway
go run ./cmd/simulator
```

The command starts the actual Fiber gateway plus mock customer and Convey HTTP servers, all on randomly selected loopback ports. It runs 27 checks in **each** lookup mode, prints PASS lines and exits nonzero on failure. All listeners stop automatically. No database, credentials, environment configuration, Docker or vendor account is needed. Go downloads module dependencies on the first run if they are not cached.

## Interactive mock service

```sh
bun run mock:gateway
# Or native bulk lookup:
cd apps/gateway
go run ./cmd/simulator --serve --mode bulk
```

Use the gateway URL printed by the process. The fake token `demo-key` permits sends, `readonly-key` demonstrates write rejection, and `sandbox-key` uses separate mock idempotency scope. Press Ctrl-C to stop all three listeners. Each restart resets the in-memory data.

```sh
# Replace the port with the printed port.
export MOCK_GATEWAY=http://127.0.0.1:12345
curl "$MOCK_GATEWAY/v1/messages" \
  -H 'Authorization: Bearer demo-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId":"alice",
    "idempotencyKey":"demo-order-1",
    "category":"transactional",
    "country":"US",
    "channels":[
      {"channel":"email","content":{"subject":"Mock order","text":"Thank you"}},
      {"channel":"sms","content":{"text":"Mock order accepted"}}
    ]
  }'
```

The response contains a mock `messageId` and `state: accepted`. Repeat the request to observe an idempotent response. Query `GET /v1/messages/{messageId}` with the same token. The simulator does not transition the message to delivered.

## Mock customer data

Editable fixture: `internal/simulator/customers.json` (embedded when the command builds).

| User ID | Available addresses / behavior |
| --- | --- |
| `alice` | All seven supported recipient fields |
| `bob` | Email and phone |
| `email-only` | Email, allowing missing-SMS checks |
| `missing` | Customer 404 |
| `unavailable` | Customer 503 |
| `malformed` | Invalid customer JSON |
| `wrong-scope` | Mismatched customer tenant |
| `slow` | Response delayed beyond the simulator gateway deadline |

All addresses, numbers, tokens and credentials are synthetic. The simulator only points at its own loopback servers and does not read production origins from environment variables.

## Scenarios

Each mode checks single acceptance, resolved fields, identical retries, status forwarding, changed-profile conflicts without duplicate acceptance, explicit overrides without lookup, all seven channel fields, fallback/cascade phone enrichment, deduplicated bulk lookup, bare-array bulk requests, failed bulk lookup without forwarding, five customer failure cases, three credential failures, cross-team rejection, sandbox scope, blocked administration, preserved throttling, oversized-body rejection, 40 concurrent submissions, and customer credential/scope isolation.

The request-limit check sends an oversized Content-Length over a real socket and verifies early 413 rejection before any upstream request. This avoids confusing server-side rejection with a client write racing the server's connection close.

Automated tests also check every exposed method/path against the route inventory, raw/compressed callback bytes, exact callback paths, query/status/response headers, media types, bulk size limits, deadlines, Fx lifecycle, and single-lookup concurrency. The enrichment fuzz target accepts arbitrary JSON and malformed input:

```sh
cd apps/gateway
go test -race ./...
go vet ./...
go test -cover ./...
go test ./internal/gateway -run '^$' \
  -fuzz FuzzEnrichmentRejectsMalformedInput -fuzztime=15s -parallel=2
```

The simulator runs in the gateway CI job as well as in `go test`. Normal test runs execute the fuzz seed corpus; random fuzzing is an explicit command.

## What this proves

The real gateway performs network I/O through its production HTTP adapter and forwarding code. The mock Convey API supplies authentication, acceptance, basic idempotency and status responses so enrichment and proxy behavior can be checked independently.

This does **not** certify real customer-service integration, Convey's delivery workers, scheduling, budget accounting, provider signatures or live provider behavior. The simulated Convey API is a deliberately limited test double, not a replacement implementation of its complete API validation. Use the existing server qualification suites for those systems. No claim of production readiness follows from mock-only tests.

## Recorded verification (2026-10-02)

- 21 top-level tests plus route/table subtests and a fuzz seed target passed under the race detector.
- Simulator: 54 checks total, including 40 concurrent submissions in each lookup mode, passed. Five consecutive simulator test runs also passed after fixing request-limit testing.
- Fuzzing: 394,717 executions in 15 seconds with two workers, no failing inputs.
- Statement coverage: customer adapter 87.7%, gateway 88.9%, simulator 79.3%. Thin command entry points are checked by running their binaries rather than by the coverage harness.
- Static analysis and repository formatting passed, with three existing unrelated Biome warnings.
- Linux amd64/arm64 gateway builds passed. The interactive simulator accepted a mock send and exited cleanly on SIGTERM, closing its listener.
- Docker follow-up: the production image built on Linux arm64, and the complete 54-check simulator passed inside a Linux container with external networking disabled.
- The production scratch image passed single and bulk customer lookup checks on an isolated internal Docker network: readiness, single/bulk acceptance, email and fallback-phone enrichment, invalid credentials, cross-team requests, missing customers, blocked admin routes, no forwarding of rejected messages, and exact callback bytes/trailing slash. Both containers ran as UID 10001 with a read-only filesystem, all capabilities dropped and no-new-privileges; both exited with code 0 on SIGTERM. Test containers and their network were removed.
- Tested image: `sha256:ec9e52f51bd8e5a67c9fb70d2369445f51d77fb030d2c2abca2f28df7c644268` (`linux/arm64`). This runtime result does not claim amd64 container execution.
- Hosted CI was not awaited. No production endpoints or delivery vendors were used.
