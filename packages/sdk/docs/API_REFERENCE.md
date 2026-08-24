# Convey SDK API Reference

Complete method-by-method, parameter-by-parameter API reference for `@convey/sdk`.

---

## Table of Contents

- [Convey Client (`Convey` / `ConveyClient`)](#convey-client)
- [Messages (`client.messages`)](#messages-resource)
- [Batches (`client.batches`)](#batches-resource)
- [Suppressions (`client.suppressions`)](#suppressions-resource)
- [Webhooks (`client.webhooks`)](#webhooks-resource)
- [Dead-Letter Queue (`client.dlq`)](#dlq-resource)
- [Sandbox (`client.sandbox`)](#sandbox-resource)
- [Reports & Analytics (`client.reports`)](#reports-resource)
- [Admin Studio (`client.admin`)](#admin-resource)
- [Pagination (`AutoPaginator`)](#pagination)
- [Errors Hierarchy](#errors-hierarchy)

---

## Convey Client

Primary entry point for interacting with Convey.

```typescript
import { Convey } from '@convey/sdk';

const convey = new Convey(options: ConveyClientOptions);
```

### `ConveyClientOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiKey` | `string` | **Required** | The Convey secret API key (`sk_live_...` or `sk_test_...`). |
| `baseUrl` | `string` | `process.env.CONVEY_BASE_URL` \|\| `'http://localhost:3000'` | Base URL of the Convey server. |
| `timeoutMs` | `number` | `10000` | Request timeout in milliseconds. |
| `maxRetries` | `number` | `3` | Maximum automatic retries for HTTP 429 and transient 5xx responses. |
| `isSandbox` | `boolean` | `false` | Enables test sandbox mode (automatically true if `apiKey` starts with `sk_test_`). |
| `teamId` | `string` | `undefined` | Default team ID attached to requests. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom `fetch` function override. |
| `defaultHeaders` | `Record<string, string>` | `{}` | Additional headers attached to every outgoing HTTP request. |

### `RequestOptions` (Per-Request Override)

All resource methods accept an optional `options?: RequestOptions` object as their final argument:

| Option | Type | Description |
| :--- | :--- | :--- |
| `timeoutMs` | `number` | Overrides client timeout for this specific call. |
| `maxRetries` | `number` | Overrides client max retries for this call. |
| `idempotencyKey` | `string` | Explicit idempotency token. |
| `traceparent` | `string` | Explicit parent W3C traceparent. |
| `isSandbox` | `boolean` | Overrides sandbox mode for this call. |
| `signal` | `AbortSignal` | External cancellation signal. |
| `headers` | `Record<string, string>` | Additional headers for this specific call. |

---

## Messages Resource

Accessible via `convey.messages`.

### `send(request, options?)`
Dispatches a single message into the transactional outbox pipeline.

- **Parameters**: `request: SendMessageRequest<TVariables, TMetadata>`, `options?: RequestOptions`
- **Returns**: `Promise<MessageAcceptedResponse>`

```typescript
const res = await convey.messages.send({
  channel: 'EMAIL',
  recipient: 'user@example.com',
  priority: 'HIGH', // 'CRITICAL' | 'HIGH' | 'DEFAULT' | 'LOW'
  content: {
    subject: 'Welcome',
    body: '<p>Hello world!</p>',
    templateId: 'tpl_welcome',
    variables: { name: 'Alex' },
  },
  category: 'MARKETING',
  campaignId: 'cmp_onboarding',
  idempotencyKey: 'custom_idemp_key_123',
});
```

### `sendBulk(messages, options?)`
High-throughput bulk message dispatch.

- **Parameters**: `messages: SendMessageRequest[] | { messages: SendMessageRequest[] }`, `options?: RequestOptions`
- **Returns**: `Promise<BulkMessageResponse>` (`{ total: number; items: MessageAcceptedResponse[] }`)

### `get(messageId, options?)`
Retrieve the current lifecycle status and attempt records for a message.

- **Parameters**: `messageId: string`, `options?: RequestOptions`
- **Returns**: `Promise<MessageDetailDto>`

### `getTimeline(messageId, options?)`
Query chronological provider delivery attempts and status transitions.

- **Parameters**: `messageId: string`, `options?: RequestOptions`
- **Returns**: `Promise<MessageTimelineResponse>`

### `getTrace(messageId, options?)`
Query the W3C distributed trace waterfall for a message.

- **Parameters**: `messageId: string`, `options?: RequestOptions`
- **Returns**: `Promise<MessageTraceResponse>`

### `previewTemplate(request, options?)`
Preview variable substitutions against a raw template string.

- **Parameters**: `request: TemplatePreviewRequest`, `options?: RequestOptions`
- **Returns**: `Promise<TemplatePreviewResponse>`

---

## Batches Resource

Accessible via `convey.batches`.

### `create(request, options?)`
Initialize a large-scale campaign batch container.

- **Parameters**: `request: CreateBatchRequest` (`{ totalCount: number; metadata?: Record<string, unknown> }`), `options?: RequestOptions`
- **Returns**: `Promise<CreateBatchResponse>`

### `list(options?)`
List all campaign batches for the team.

- **Returns**: `Promise<ListBatchesResponse>`

### `get(batchId, options?)`
Get progress counters and status of a batch.

- **Parameters**: `batchId: string`, `options?: RequestOptions`
- **Returns**: `Promise<{ success: boolean; batch: BatchDto }>`

### `pause(batchId, options?)`
Pause execution of an in-flight batch.

- **Parameters**: `batchId: string`, `options?: RequestOptions`
- **Returns**: `Promise<BatchActionResponse>`

### `resume(batchId, options?)`
Resume a paused batch.

- **Parameters**: `batchId: string`, `options?: RequestOptions`
- **Returns**: `Promise<BatchActionResponse>`

### `cancel(batchId, options?)`
Cancel a batch.

- **Parameters**: `batchId: string`, `options?: RequestOptions`
- **Returns**: `Promise<BatchActionResponse>`

---

## Suppressions Resource

Accessible via `convey.suppressions`.

### `add(request, options?)`
Add a single recipient suppression rule.

- **Parameters**: `request: AddSuppressionRequest`, `options?: RequestOptions`
- **Returns**: `Promise<{ success: boolean; suppression: SuppressionDto }>`

### `addBulk(items, options?)`
Bulk register suppression records.

- **Parameters**: `items: AddSuppressionRequest[] | { items: AddSuppressionRequest[] }`, `options?: RequestOptions`
- **Returns**: `Promise<{ success: boolean; count: number; suppressions: SuppressionDto[] }>`

### `list(query?, options?)`
List suppressions with filtering.

- **Parameters**: `query?: ListSuppressionsQuery`, `options?: RequestOptions`
- **Returns**: `Promise<ListSuppressionsResponse>`

### `listAutoPaging(query?, options?)`
Auto-paginating async iterator for streaming suppressions.

- **Returns**: `AutoPaginator<SuppressionDto>`

### `delete(id, options?)`
Remove a suppression record.

- **Parameters**: `id: string`, `options?: RequestOptions`
- **Returns**: `Promise<{ success: boolean }>`

---

## Webhooks Resource

Accessible via `convey.webhooks`.

### `subscriptions.create(request, options?)`
Register a callback endpoint.

- **Parameters**: `request: CreateWebhookSubscriptionRequest`, `options?: RequestOptions`
- **Returns**: `Promise<{ success: boolean; subscription: WebhookSubscriptionDto }>`

### `subscriptions.list(options?)`
List active webhook subscriptions.

- **Returns**: `Promise<ListWebhookSubscriptionsResponse>`

### `subscriptions.delete(id, options?)`
Delete a webhook subscription.

- **Parameters**: `id: string`, `options?: RequestOptions`
- **Returns**: `Promise<{ success: boolean }>`

### `subscriptions.test(id, options?)`
Trigger a test ping event.

- **Parameters**: `id: string`, `options?: RequestOptions`
- **Returns**: `Promise<{ success: boolean; message: string }>`

### `verifySignature(payload, signature, secret, toleranceSeconds?)`
Verify HMAC-SHA256 signature on an incoming webhook payload.

- **Parameters**: `payload: string | Uint8Array`, `signature: string`, `secret: string`, `toleranceSeconds = 300`
- **Returns**: `Promise<boolean>`

### `constructEvent(payload, signature, secret, toleranceSeconds?)`
Verify signature and deserialize typed webhook payload.

- **Parameters**: `payload: string | Uint8Array`, `signature: string`, `secret: string`, `toleranceSeconds = 300`
- **Returns**: `Promise<ConveyWebhookEvent>`

---

## Dead-Letter Queue (DLQ)

Accessible via `convey.dlq`.

### `list(query?, options?)`
Query failed messages in DLQ.

- **Parameters**: `query?: ListDlqQuery`, `options?: RequestOptions`
- **Returns**: `Promise<ListDlqResponse>`

### `listAutoPaging(query?, options?)`
Auto-paginating iterator for failed messages.

- **Returns**: `AutoPaginator<MessageDetailDto>`

### `replay(request, options?)`
Replay failed messages.

- **Parameters**: `request: DlqReplayRequest | string[]`, `options?: RequestOptions`
- **Returns**: `Promise<DlqReplayResult>`

### `replayMutated(request, options?)`
Run dry-run simulation or mutated replay with adjusted backoff/concurrency.

- **Parameters**: `request: DlqMutatedReplayRequest`, `options?: RequestOptions`
- **Returns**: `Promise<DlqMutatedReplayResult>`

---

## Reports & Analytics

Accessible via `convey.reports`.

### `getOverview(params?, options?)`
Retrieve multi-channel aggregate metrics and hourly time-series.

### `getTeams(params?, options?)`
Retrieve budget utilization across tenant teams.

### `getCategories(params?, options?)`
Retrieve delivery metrics by category.

### `getCampaigns(params?, options?)`
Retrieve campaign list with funnel summary.

### `getCampaignDetails(campaignId, params?, options?)`
Retrieve campaign funnel, channel breakdown, and hourly timeline.

### `export(type, format, params?, options?)`
Export report in CSV or JSON format.

---

## Admin Studio

Accessible via `convey.admin`.

### `getOverview(options?)`
Operational overview snapshot.

### `getLiveTelemetry(options?)`
Real-time live telemetry snapshot (V8 heap saturation, queue depths, p95 latency, circuit states).

### `listProviders(options?)`
Provider scorecard, latency EMA, and circuit status.

### `setCircuitState(providerId, action, rampPercentage?, options?)`
Manually override circuit breaker state (`'CLOSE' | 'FORCE_OPEN' | 'FORCE_HALF_OPEN'`).

### `triggerCanary(providerId, options?)`
Execute synthetic canary probe on a provider adapter.

### `registerProvider(request, options?)`
Dynamically register new provider credentials and proxy config.

### `listAuditLogs(query?, options?)`
Query SHA-256 tamper-evident audit ledger.

---

## Errors Hierarchy

```
ConveyError (Base)
├── ConveyTimeoutError (timeoutMs)
├── ConveyNetworkError (cause)
├── ConveySecurityError (webhook HMAC failure)
└── ConveyApiError (statusCode, errorCode, details, traceparent, headers, rawBody)
    ├── ConveyValidationError (400)
    ├── ConveyAuthenticationError (401)
    ├── ConveyForbiddenError (403)
    ├── ConveyNotFoundError (404)
    ├── ConveyConflictError (409)
    └── ConveyRateLimitError (429, retryAfterSeconds)
```
