# Convey SDK API Reference

Complete method-by-method, parameter-by-parameter API reference for `@convey/sdk` with production TypeScript samples.

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
import { Convey, ConveyClient, ConveyEnvironment } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  environment: ConveyEnvironment.PRODUCTION, // 'us', 'eu', 'staging', 'local', 'sandbox'
  // Or explicit: baseUrl: 'https://api.convey.dev'
  timeoutMs: 10000,                    // 10s request timeout
  maxRetries: 3,                       // Max exponential backoff retry attempts
  teamId: 'growth-team',               // Optional default team ID
});
```

### `ConveyClientOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiKey` | `string` | **Required** | The Convey secret API key (`sk_live_...` or `sk_test_...`). |
| `baseUrl` | `string` | **Mandatory** | Base URL of the Convey server (or resolved via `environment` / `CONVEY_BASE_URL`). |
| `environment` | `ConveyEnvironment \| string` | `undefined` | Canonical environment preset (`PRODUCTION`, `US`, `EU`, `STAGING`, `LOCAL`, `SANDBOX`). |
| `timeoutMs` | `number` | `10000` | Request timeout in milliseconds. |
| `maxRetries` | `number` | `3` | Maximum automatic retries for HTTP 429 and transient 5xx responses. |
| `rateLimiter` | `TokenBucketRateLimiter \| RateLimiterOptions` | `undefined` | Client-side rate smoother. |
| `middlewares` | `ConveyMiddleware[]` | `[]` | Request/response interceptor pipeline. |
| `logger` | `ConveyLogger` | `undefined` | Structured logger with automatic token redaction. |
| `isSandbox` | `boolean` | `false` | Enables test sandbox mode (automatically true if `apiKey` starts with `sk_test_`). |
| `teamId` | `string` | `undefined` | Default team ID attached to requests. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom `fetch` function override. |

### `RequestOptions` (Per-Request Override)

All resource methods accept an optional `options?: RequestOptions` object as their final argument:

| Option | Type | Description |
| :--- | :--- | :--- |
| `timeoutMs` | `number` | Overrides client timeout for this specific call. |
| `maxRetries` | `number` | Overrides client max retries for this call. |
| `idempotencyKey` | `string` | Explicit idempotency token (defaults to auto-generated monotonic ULID). |
| `traceparent` | `string` | Explicit parent W3C traceparent (`00-<trace_id>-<span_id>-<flags>`). |
| `isSandbox` | `boolean` | Overrides sandbox mode for this call. |
| `signal` | `AbortSignal` | External cancellation signal. |
| `headers` | `Record<string, string>` | Additional headers for this specific call. |

---

## Messages Resource

Accessible via `convey.messages`.

### `send(request, options?)`
Dispatches a single omnichannel message into the transactional outbox pipeline.

```typescript
// Sample 1: Transactional Email
const emailRes = await convey.messages.send({
  channel: 'EMAIL',
  recipient: 'user@example.com',
  priority: 'HIGH',
  content: {
    subject: 'Order Confirmation #9901',
    body: '<p>Thank you for your order!</p>',
  },
  category: 'TRANSACTIONAL',
  idempotencyKey: 'order_9901_confirmation',
});

// Sample 2: Urgent SMS OTP
const smsRes = await convey.messages.send({
  channel: 'SMS',
  recipient: '+14155552671',
  priority: 'CRITICAL',
  content: {
    body: 'Your verification code is 884-129.',
  },
});

// Sample 3: WhatsApp with Template Variables
const waRes = await convey.messages.send({
  channel: 'WHATSAPP',
  recipient: '+447911123456',
  content: {
    templateId: 'shipping_update_v1',
    variables: { tracking_number: 'TRK-98765' },
  },
});
```

### `sendBulk(messages, options?)`
High-throughput bulk message dispatch into the transactional outbox pipeline in a single network round-trip.

```typescript
const bulk = await convey.messages.sendBulk([
  {
    channel: 'EMAIL',
    recipient: 'alice@corp.com',
    content: { subject: 'Monthly Summary', body: '<p>Hi Alice</p>' },
  },
  {
    channel: 'EMAIL',
    recipient: 'bob@corp.com',
    content: { subject: 'Monthly Summary', body: '<p>Hi Bob</p>' },
  },
]);

console.log(`Accepted ${bulk.total} messages.`);
```

### `get(messageId, options?)`
Retrieve the current lifecycle status and attempt records for a message.

```typescript
const message = await convey.messages.get('msg_01J9X8K72M9NPQR4567890ABCD');
console.log(`Status: ${message.status}, CreatedAt: ${message.createdAt}`);
```

### `getTimeline(messageId, options?)`
Query chronological provider delivery attempts and status transitions.

```typescript
const timeline = await convey.messages.getTimeline('msg_01J9X8K72M9NPQR4567890ABCD');
for (const step of timeline.timeline) {
  console.log(`[${step.timestamp}] ${step.status} via ${step.provider} (${step.latencyMs}ms)`);
}
```

### `getTrace(messageId, options?)`
Query the W3C distributed trace APM waterfall for a message.

```typescript
const trace = await convey.messages.getTrace('msg_01J9X8K72M9NPQR4567890ABCD');
console.log(`Traceparent: ${trace.traceparent}, Total Duration: ${trace.totalDurationMs}ms`);
```

### `previewTemplate(request, options?)`
Preview dynamic parameter substitutions against a template before dispatch.

```typescript
const preview = await convey.messages.previewTemplate({
  template: 'Hello {{name}}, your balance is {{amount | currency: "USD"}}.',
  variables: { name: 'Sarah', amount: 149.5 },
  recipient: 'sarah@example.com',
});

console.log(`Rendered: ${preview.rendered}`); // "Hello Sarah, your balance is $149.50."
```

---

## Batches Resource

Accessible via `convey.batches`.

### `create(request, options?)`
Initialize a large-scale campaign batch container.

```typescript
const batch = await convey.batches.create({
  totalCount: 25000,
  metadata: { campaignName: 'Black Friday 2026' },
});
console.log(`Batch created: ${batch.batch.id}`);
```

### `list(options?)`
List all campaign batches for the team.

```typescript
const batches = await convey.batches.list({ limit: 10 });
```

### `get(batchId, options?)`
Get progress counters and status of a batch.

```typescript
const details = await convey.batches.get('batch_01J9X8K...');
console.log(`Progress: ${details.processedCount} / ${details.totalCount}`);
```

### `pause(batchId, options?)` / `resume(batchId, options?)` / `cancel(batchId, options?)`

```typescript
await convey.batches.pause('batch_01J9X8K...');
await convey.batches.resume('batch_01J9X8K...');
await convey.batches.cancel('batch_01J9X8K...');
```

---

## Suppressions Resource

Accessible via `convey.suppressions`.

### `add(request, options?)`
Add a single recipient suppression rule.

```typescript
await convey.suppressions.add({
  recipient: 'bounced.user@example.com',
  channel: 'EMAIL',
  reason: 'HARD_BOUNCE',
  comment: 'Mailbox does not exist (SMTP 550)',
});
```

### `addBulk(items, options?)`
Bulk register suppression records.

```typescript
await convey.suppressions.addBulk([
  { recipient: 'spam1@domain.com', channel: 'EMAIL', reason: 'SPAM_COMPLAINT' },
  { recipient: 'spam2@domain.com', channel: 'EMAIL', reason: 'UNSUBSCRIBE' },
]);
```

### `list(query?, options?)` & `listAutoPaging(query?, options?)`

```typescript
// Sample 1: Paginated Query
const list = await convey.suppressions.list({ channel: 'EMAIL', limit: 50 });

// Sample 2: Asynchronous Iterator (Stream 50,000 items)
for await (const item of convey.suppressions.listAutoPaging({ limit: 100 })) {
  console.log(`Suppressed: ${item.recipient} (Reason: ${item.reason})`);
}
```

### `delete(id, options?)`
Remove a suppression record.

```typescript
await convey.suppressions.delete('supp_01J9X8K...');
```

---

## Webhooks Resource

Accessible via `convey.webhooks`.

### `subscriptions.create(request, options?)`

```typescript
const sub = await convey.webhooks.subscriptions.create({
  url: 'https://api.mycorp.com/webhooks/convey',
  events: ['message.delivered', 'message.failed', 'message.opened'],
  secret: 'whsec_custom_secret_key_12345',
});
```

### `subscriptions.list(options?)` / `subscriptions.delete(id, options?)` / `subscriptions.test(id, options?)`

```typescript
const subs = await convey.webhooks.subscriptions.list();
await convey.webhooks.subscriptions.test(sub.subscription.id);
await convey.webhooks.subscriptions.delete(sub.subscription.id);
```

### `verifySignature(payload, signature, secret, toleranceSeconds?)`
Verify HMAC-SHA256 signature on an incoming webhook payload.

```typescript
const isValid = await Convey.webhooks.verifySignature(rawBody, signatureHeader, secret, 300);
```

### `constructEvent(payload, signature, secret, toleranceSeconds?)`
Verify signature and deserialize typed webhook payload.

```typescript
const event = await Convey.webhooks.constructEvent<{
  messageId: string;
  provider: string;
}>(rawBody, signatureHeader, secret);

console.log(`Event: ${event.type}, Message: ${event.data.messageId}`);
```

---

## Dead-Letter Queue (DLQ)

Accessible via `convey.dlq`.

### `list(query?, options?)` & `listAutoPaging(query?, options?)`

```typescript
const dlq = await convey.dlq.list({ limit: 20 });
```

### `replay(request, options?)`
Replay failed messages.

```typescript
const replayResult = await convey.dlq.replay({
  messageIds: ['msg_failed_01', 'msg_failed_02'],
});
```

### `replayMutated(request, options?)`
Run dry-run simulation or mutated replay with adjusted recipient or channels.

```typescript
const mutatedReplay = await convey.dlq.replayMutated({
  messageIds: ['msg_failed_01'],
  dryRun: false,
  mutations: {
    recipients: { email: 'corrected.email@domain.com' },
    metadata: { reason: 'User updated email address in portal' },
  },
});
```

---

## Reports & Analytics

Accessible via `convey.reports`.

```typescript
// 1. Overview metrics
const overview = await convey.reports.getOverview({ range: '7d' });

// 2. Team budget utilization
const teams = await convey.reports.getTeams({ range: '30d' });

// 3. Category delivery statistics
const categories = await convey.reports.getCategories({ range: '7d' });

// 4. Campaign funnels
const campaigns = await convey.reports.getCampaigns({ range: '14d' });
```

---

## Admin Studio

Accessible via `convey.admin`.

```typescript
// 1. Live Telemetry Snapshot
const telemetry = await convey.admin.getLiveTelemetry();
console.log(`Throughput: ${telemetry.throughputRps} rps, Heap: ${telemetry.runtimeGuard.heapUsedMb}MB`);

// 2. Provider Health & Circuit Breakers
const providers = await convey.admin.listProviders();
await convey.admin.setCircuitState('resend', 'OPEN'); // Force trip circuit

// 3. Canary Probe
const canary = await convey.admin.triggerCanary();

// 4. Audit Log Ledger
for await (const log of convey.admin.listAuditLogsAutoPaging({ limit: 50 })) {
  console.log(`Audit: [${log.timestamp}] ${log.action} by ${log.actor}`);
}
```

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
