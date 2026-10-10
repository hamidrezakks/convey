# Convey REST API Reference

This reference describes the current pre-release server. Acceptance is durable enqueueing, not delivery, and no public latency SLA or hosted API availability is implied. See the [V1 contract candidate](operations/v1-contracts.md), [access matrix](operations/api-access-matrix.md), and [qualification evidence](operations/v1-qualification.md).

The local server defaults to `http://localhost:3000`; change the origin for your deployment. API routes start with `/v1`. Interactive OpenAPI documentation is at `/swagger`. SDKs receive the server origin as their base URL and append resource paths themselves.

## Authentication and request scope

```http
Authorization: Bearer <api-key>
Content-Type: application/json
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

`traceparent` is optional. Tenant credentials carry stored tenant, team, role, and sandbox scope. A request cannot grant itself access by setting a team header or body field. Production requires authentication; local development can bypass it only when configured. Admin platform writes require appropriate platform scope. `GET /v1/auth/session` returns the authenticated session's scope.

Sandbox-only credentials always select sandbox execution. An authorized key can also request it with `X-Convey-Sandbox: true` or `X-Convey-Environment: sandbox`. Sandbox is derived from authentication and headers, not from an `isSandbox` field in the send body. Sandbox keys cannot access shared configuration resources.

Message idempotency uses the required `idempotencyKey` **body field**. Within retained evidence (24 hours by default), the same scoped key and payload replay the saved response; different payloads conflict. In-progress reservations also conflict. Retention expiry or queue-store loss can invalidate retained evidence. There is no exactly-once guarantee across third-party provider networks.

## Messages

### Send: `POST /v1/messages`

```json
{
  "idempotencyKey": "order-10928-confirmation",
  "userId": "customer-42",
  "team": "payments",
  "category": "transactional",
  "country": "US",
  "priority": "transactional",
  "recipients": { "email": "customer@example.com" },
  "channels": [{
    "channel": "email",
    "content": {
      "subject": "Order confirmed",
      "text": "Your order 10928 is confirmed."
    }
  }],
  "metadata": { "orderId": "10928" }
}
```

Required fields: nonempty `idempotencyKey`, `userId`, `team`, `category`, a two-character `country`, `recipients`, and at least one entry in `channels`. Priority defaults to `normal`; accepted wire priorities are `critical`, `transactional`, `normal`, and `marketing`. Recipient validity and routing configuration must fit the selected channel.

| Channel | Recipient | Content |
| :--- | :--- | :--- |
| `email` | `recipients.email` | Required `subject`; optional `html`, `text`, `render` |
| `sms` | `recipients.phone` | Required `text` |
| `whatsapp` | `recipients.whatsapp` | Optional `text`, `template`, `language`, `variables`; usable payload depends on the provider |
| `telegram` | `recipients.telegramChatId` | Required `text`; optional `parseMode` (`HTML`, `MarkdownV2`) |
| `slack` | `recipients.slack.channelId` | Required `text`; optional `blocks` |
| `fcm` | `recipients.fcmTokens` | Required `title`, `body`; optional string-valued `data` |
| `apns` | `recipients.apnsTokens` | Required `title`, `body`; optional `badge`, `sound`, `data` |

These are accepted send channel discriminators. A provider catalog entry or SDK enum does not add another accepted REST channel. Check [provider capability evidence](operations/provider-capability-matrix.md) separately from the schema.

Optional message fields include `campaignId`, `scheduledAt`, `expiresAt`, `template`, `variables`, `fallback`, `cascade`, and `metadata`. Scheduling and expiry use ISO timestamps. `template` is an inline object with fields such as `subject`, `html`, or `text`; email `content.render` uses a registered template name plus optional version, locale, and props.

Successful immediate acceptance returns `202`:

```json
{
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "state": "accepted",
  "createdAt": "2026-10-10T12:00:00.000Z"
}
```

Explicitly future-scheduled requests return `state: "scheduled"` and `scheduledAt`. They are accepted for future processing, without a promise of exact delivery time. Public message identifiers are opaque `msg_<ULID>` values.

### Bulk: `POST /v1/messages/bulk`

The body is `{ "messages": [<complete send request>, ...] }`, with **1–500 items**. The controller also accepts a top-level array. Each message needs its own idempotency key and all required send fields. There is no shared top-level channel or priority.

The `202` envelope contains each item's outcome, including errors:

```json
{
  "total": 1,
  "items": [{
    "index": 0,
    "statusCode": 202,
    "body": {
      "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
      "state": "accepted",
      "createdAt": "2026-10-10T12:00:00.000Z"
    }
  }]
}
```

Inspect each `statusCode` and `body`; the outer HTTP status is not proof that every item was accepted. Invalid request schemas fail before processing. SDK bulk wrappers currently normalize these outcomes and may discard error details; use raw REST responses when partial failure reporting matters.

### Inspect a message

- `GET /v1/messages/:messageId`: aggregate state plus channel summaries.
- `GET /v1/messages/:messageId?include=timeline`: include chronological events. The current query check is exactly `include=timeline`.
- `GET /v1/messages/:messageId/timeline`: return `{ messageId, timeline }`.
- `GET /v1/messages/:messageId/trace`: return the delivery summary and `waterfall` spans.

An initial status response can look like:

```json
{
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "state": "accepted",
  "userId": "customer-42",
  "team": "payments",
  "category": "transactional",
  "country": "US",
  "createdAt": "2026-10-10T12:00:00.000Z",
  "channels": [{ "channel": "email", "state": "accepted", "providerAttempts": 0 }]
}
```

Channel summaries can add `provider`, `acceptedAt`, `deliveredAt`, `openedAt`, `readAt`, and `lastError: { code, category }`. Timeline entries contain `channel`, `event`, and `at`. Trace responses contain `messageId`, `state`, `team`, `category`, `totalDurationMs`, `summary`, and `waterfall`; span fields include `spanId`, `name`, `status`, `startOffsetMs`, `durationMs`, and optional `details`.

### Template preview: `POST /v1/messages/templates/preview`

```json
{
  "template": { "subject": "Hello {{name}}", "text": "Order {{orderId}} is ready." },
  "variables": { "name": "Alex", "orderId": "10928" }
}
```

### Client receipts: `POST /v1/receipts`

```json
{
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "channel": "fcm",
  "event": "read"
}
```

The message must be visible to the authenticated scope. Acceptance returns `202` with `{ "status": "accepted", "received": true }`. Use `event`, rather than `receiptType`, for the receipt kind.

## Failed-message replay

`GET /v1/dlq` lists failed messages with `limit` (default 50, maximum 200) and `offset` (default 0). Team and sandbox visibility follow authentication; a caller cannot broaden its team with a query parameter.

`POST /v1/dlq/replay` accepts `{ "messageIds": [...] }` and returns `{ "replayedCount": ..., "messageIds": [...] }` for eligible replayed failures.

`POST /v1/dlq/replay-mutated` supports:

```json
{
  "messageIds": ["msg_01J0N7C0W7X2R6S8V9Q9B1E4G3"],
  "dryRun": true,
  "mutations": {
    "recipients": { "email": "corrected@example.com" },
    "metadata": { "remediationReason": "Recipient correction" }
  }
}
```

Mutations can contain `recipients`, `channels`, and `metadata`. Dry runs add `dryRunResults` and do not dispatch or test an actual provider route; the reported `simulatedProvider` is currently a placeholder. The schema also accepts `isSandbox`, but authenticated scope takes precedence. Review dry-run output before intentional replay; another execution can incur another charge. Provider overrides and arbitrary payload patches are not fields in the current replay schema.

## Batches, sandbox, and suppressions

| Method and route | Current request/behavior |
| :--- | :--- |
| `POST /v1/batches` | `{ totalCount, metadata? }`; returns `201` with `{ success, batch }` |
| `GET /v1/batches` | List authenticated tenant/team batches |
| `GET /v1/batches/:batchId` | Inspect one batch context |
| `POST /v1/batches/:batchId/pause` | Pause an eligible batch |
| `POST /v1/batches/:batchId/resume` | Resume an eligible paused batch |
| `POST /v1/batches/:batchId/cancel` | Cancel an eligible batch |
| `GET /v1/sandbox/messages` | Up to 100 recent team sandbox records from the last 30 days |
| `DELETE /v1/sandbox/messages` | Delete team sandbox records in that 30-day window |
| `POST /v1/suppressions` | `{ identifier, reason, identifierType?, category?, country?, channel?, startsAt?, endsAt? }` |
| `POST /v1/suppressions/bulk` | `{ items: [<suppression>, ...] }` |
| `GET /v1/suppressions` | Filters: `limit`, `offset`, `channel`, `category`, `reason`, `search` |
| `DELETE /v1/suppressions/:id` | Remove a suppression visible to the key's team |

Suppression requests use `identifier`, not `recipient`. See the controllers for route-specific response objects; response envelopes are not uniform across these resources.

## Customer webhook subscriptions

`POST /v1/webhook-subscriptions` accepts `{ url, events, secret? }` and returns `{ success: true, subscription }`, including a generated secret when omitted. Destinations must use HTTPS on port 443 without credentials/fragments and resolve exclusively to public addresses. Redirects are not followed.

- `GET /v1/webhook-subscriptions`: `{ subscriptions }` for the authenticated tenant/team.
- `DELETE /v1/webhook-subscriptions/:id`: delete a scoped subscription.
- `POST /v1/webhook-subscriptions/:id/test`: queue `ping.test` for matching subscriptions in the authenticated tenant/team. The current implementation does not select only the path's subscription ID. Subscribe to `ping.test` or `*` to receive it.

The current callback envelope is:

```json
{
  "event": "message.delivered",
  "timestamp": "2026-10-10T12:00:01.000Z",
  "data": {
    "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
    "channel": "email",
    "status": "delivered",
    "timestamp": "2026-10-10T12:00:00.000Z"
  }
}
```

Workers emit `message.sent`, receipt-derived `message.<state>` events, and `inbound.message_received`; the test event is `ping.test`. Receipt availability depends on provider support. The outer timestamp is dispatch time; `data` is event-specific. The current envelope does not include a stable event ID.

`X-Convey-Signature` is `t=<unix-seconds>,v1=<hex-hmac>`, signing `timestamp.rawBody` using HMAC-SHA256 and the subscription secret. Verify the exact raw body before parsing and enforce timestamp tolerance. The TypeScript SDK exports `verifyWebhookSignature`; its typed event envelope and framework routing adapters currently expect different field names, so parse the actual `event`, `timestamp`, and `data` fields explicitly.

Delivery uses a 10-second timeout and up to three total attempts for network errors, `429`, or `5xx`, with jitter. Other non-`2xx` responses fail without transient retry. Retry dispatch timestamps/signatures change. Consumers must tolerate duplicates and out-of-order events and make business updates idempotent.

## Provider ingress and administration

`POST /v1/webhooks/:provider` accepts vendor callbacks with provider-specific signature handling. Dedicated status/incoming routes exist at `/v1/webhooks/:provider/status` and `/v1/webhooks/:provider/incoming`; supported verification handshakes use corresponding GET routes. `GET /v1/t/:token` serves an email-open tracking pixel. Do not infer live certification or signature coverage from the provider catalog; consult [provider capabilities](provider-capabilities.md).

`/v1/admin` powers the web console: overview, telemetry, messages, provider configuration, policies, access administration, and reporting. Use [Mission Control documentation](web-ui-mission-control.md), the [access matrix](operations/api-access-matrix.md), and the [admin controller](../apps/server/src/modules/admin/admin.controller.ts) for exact routes and permissions. Tenant and sandbox keys cannot perform platform writes.

## Health and errors

| Route | Behavior |
| :--- | :--- |
| `GET /health` | Database/Redis checks and readiness information; `200` when healthy and ready, otherwise `503` |
| `GET /health/readiness` | Readiness, dependency/partition checks, worker and provider information; `200` or `503` |
| `GET /health/liveness` | `{ status: "alive", uptime, timestamp }` |
| `GET /metrics` | Prometheus text metrics |
| `GET /swagger` | Interactive OpenAPI documentation |

Messaging errors use `{ "error": { "code": "...", "message": "...", "details": ... } }`, where details are optional. Other route families can return different envelopes. There is no universal RFC 7807 error body or guaranteed rate-limit header set.

| Messaging code | HTTP status | Meaning |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | `400` | Invalid schema or domain payload |
| `IDEMPOTENCY_CONFLICT` | `409` | Payload conflict or reservation in progress |
| `NOT_FOUND` | `404` | Message unavailable to the requested scope |
| `SERVICE_UNAVAILABLE` | `503` | Acceptance rejected under overload; includes `Retry-After` |
| `SERVER_ERROR` | `500` | Unexpected single-send failure |

Authentication failures use `401`; access policy rejection uses `403`. Provider delivery failures are asynchronous outcomes after successful acceptance, not a synchronous send HTTP error taxonomy.

The implementation sources are [message schemas](../apps/server/src/modules/messaging/messaging.types.ts), [message controller](../apps/server/src/modules/messaging/messaging.controller.ts), [message service](../apps/server/src/modules/messaging/messaging.service.ts), [customer dispatcher](../apps/server/src/queues/workers/customer-webhook-dispatch.worker.ts), and [server route registration](../apps/server/src/index.ts). Check installed SDK behavior against these contracts until qualification is complete.
