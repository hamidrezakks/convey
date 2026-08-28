# Convey Node/Bun SDK (`@convey/sdk`)

Official zero-dependency, high-throughput TypeScript/JavaScript SDK for the **Convey** communication service. Runs natively in **Node.js (v18+)**, **Bun (1.x+)**, and Edge runtimes (**Cloudflare Workers, Deno, Next.js Edge**).

[![NPM Version](https://img.shields.io/npm/v/@convey/sdk.svg)](https://www.npmjs.com/package/@convey/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Features

- ⚡ **Zero Runtime Dependencies**: Built entirely on standard Web APIs (`fetch`, `AbortSignal`, `crypto.subtle` / `node:crypto`). Micro-footprint (<15KB).
- 🌐 **Mandatory Base URL & Canonical Environments**: Explicit base URL resolution (`baseUrl`, `environment` presets `PRODUCTION`, `US`, `EU`, `STAGING`, `LOCAL`, `SANDBOX`, or `CONVEY_BASE_URL` env). No ambiguous defaults.
- 🏗️ **Fluent Builders**: Chainable DSL for constructing and dispatching single messages (`client.message().to(...).email(...).send()`) and staged batch chunks.
- ⏱️ **Lifecycle Polling Awaiters**: Async awaiters for message delivery (`waitForDelivery`) and campaign batch processing (`waitForCompletion`) with signal cancellation.
- 🛡️ **Deterministic Resiliency & Rate Limiting**: Built-in full-jitter exponential backoff, HTTP 429 `Retry-After` handling, and client-side Token Bucket rate pacing.
- 🔌 **Middleware & Request Interceptors**: Pipeline for request mutation, telemetry tracing, response logging, and error hooks.
- 🪵 **Structured Logging**: Zero-dependency logger with automatic sensitive token redaction (`apiKey`, authorization headers, credentials).
- 🔁 **Idempotency by Default**: Transparent or explicit `Idempotency-Key` (ULID) generation preventing duplicate dispatches on network retries.
- 🌊 **Auto-Pagination Streaming**: Native `for await...of` async iterators for memory-efficient processing of huge datasets.
- 🕵️ **W3C Distributed Tracing**: Automatic generation and propagation of W3C `traceparent` child spans.
- 🔐 **Timing-Safe Webhook Handlers**: Universal framework adapters (Next.js App Router, Hono, Elysia, Cloudflare Workers, Express) and test event fixture generators.
- 🧪 **First-Class Sandbox Mode**: Zero-cost test simulations and mock provider inspections.

---

## Installation

```bash
# Bun
bun add @convey/sdk

# npm
npm install @convey/sdk

# pnpm
pnpm add @convey/sdk

# yarn
yarn add @convey/sdk
```

---

## Initialization

Convey requires an explicit base URL or environment preset to prevent misrouted communications.

```typescript
import { Convey, ConveyEnvironment } from '@convey/sdk';

// 1. Using Environment Preset (Recommended)
const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  environment: ConveyEnvironment.PRODUCTION, // or 'us', 'eu', 'staging', 'local', 'sandbox'
});

// 2. Using Explicit Base URL
const customClient = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: 'https://api.convey.dev',
  timeoutMs: 10000,
  maxRetries: 3,
  rateLimiter: { maxRequestsPerSecond: 100, maxBurst: 20 },
});
```

---

## Fluent Message Builder DSL

Construct and dispatch omnichannel messages with an ergonomic, chainable builder:

```typescript
// Dispatch directly
const message = await convey
  .message()
  .to('customer@example.com')
  .email({
    subject: 'Your Order #4892 Confirmation',
    html: '<h1>Thank you for your order!</h1><p>We are preparing your shipment.</p>',
  })
  .priority('HIGH')
  .team('orders-team')
  .metadata({ orderId: '4892' })
  .idempotencyKey('order_4892_conf')
  .send();

console.log(`Accepted: ${message.publicId} (${message.status})`);
```

### Channel Shortcuts
```typescript
// SMS
await convey.message().sms({ to: '+14155550199', body: 'Your driver is outside.' }).send();

// WhatsApp
await convey.message().whatsapp({ to: '+14155552671', templateId: 'otp_v1', variables: { code: '123456' } }).send();

// Slack
await convey.message().slack({ channelId: 'C12345', text: '🔥 High error rate alert' }).send();

// Push
await convey.message().push({ token: 'apns_tok_...', title: 'New Message', body: 'You received a notification.' }).send();
```

---

## Staged Batch Dispatching

Queue large numbers of messages and dispatch them in parallel chunks with progress callbacks:

```typescript
const batch = convey.batches.builder(convey.messages);

for (let i = 0; i < 500; i++) {
  batch.add(
    convey.message().to(`user_${i}@example.com`).email({ subject: 'Newsletter', body: '...' })
  );
}

const result = await batch.dispatch({
  chunkSize: 50,
  concurrency: 4,
  onProgress: (completed, total) => {
    console.log(`Dispatched ${completed} / ${total} messages...`);
  },
});
```

---

## Lifecycle Polling & Awaiting Delivery

Wait for asynchronous delivery confirmation or batch campaign completion without writing custom polling loops:

```typescript
// Wait for single message delivery (DELIVERED, FAILED, SUPPRESSED)
const delivery = await convey.messages.waitForDelivery('msg_01J9X8K2M4N5P6Q7R8S9T0V1W2', {
  pollIntervalMs: 500,
  timeoutMs: 30000,
  onPoll: (msg) => console.log(`Current status: ${msg.status}`),
});

console.log(`Final Delivery State: ${delivery.status}`);

// Wait for batch processing to finish
const batchSummary = await convey.batches.waitForCompletion('batch_01J8K9P2X', {
  pollIntervalMs: 1000,
  timeoutMs: 60000,
});
```

---

## Middlewares & Interceptors

Attach custom interceptors to inspect or mutate requests, log responses, or handle exceptions:

```typescript
convey.use({
  name: 'auth-and-metrics',
  onRequest: (ctx) => {
    ctx.headers['x-custom-tenant'] = 'enterprise_acme';
    return ctx;
  },
  onResponse: (ctx) => {
    console.log(`[HTTP] ${ctx.response.status} took ${ctx.durationMs}ms`);
    return ctx;
  },
  onError: (ctx) => {
    console.error(`[HTTP ERROR] attempt=${ctx.attempt} err=${ctx.error.message}`);
  },
});
```

---

## Webhook Framework Adapters & Test Fixtures

### Web Standard (Next.js App Router / Hono / Elysia / Cloudflare Workers)
```typescript
import { Convey } from '@convey/sdk';

const webhookHandler = Convey.webhooks.createHandler({
  secret: process.env.CONVEY_WEBHOOK_SECRET!,
  handlers: {
    'message.delivered': (event) => {
      console.log(`Message delivered: ${event.data.messageId}`);
    },
    'message.failed': (event) => {
      console.warn(`Message failed: ${event.data.messageId}`);
    },
  },
});

export async function POST(req: Request) {
  return webhookHandler.handleRequest(req);
}
```

### Express / Fastify
```typescript
import express from 'express';
import { Convey } from '@convey/sdk';

const app = express();
const handler = Convey.webhooks.createHandler({
  secret: process.env.CONVEY_WEBHOOK_SECRET!,
  handlers: {
    'message.delivered': (event) => console.log(event),
  },
});

app.post('/webhooks/convey', express.raw({ type: 'application/json' }), handler.expressHandler());
```

### Generating Test Fixtures for Unit Tests
```typescript
import { Convey } from '@convey/sdk';

const fixture = await Convey.webhooks.generateTestEvent({
  type: 'message.delivered',
  data: { messageId: 'msg_test_123', recipient: 'alice@example.com' },
  secret: 'whsec_test_secret',
});

// Pass fixture.rawBody and fixture.headers to your test handler
```

---

## Client Scoping & Dynamic Base URL

```typescript
// Clone client scoped to a tenant team
const teamClient = convey.withTeam('finance-dept');

// Clone client with customized options
const devClient = convey.withOptions({
  timeoutMs: 30000,
  maxRetries: 5,
});

// Mutate base URL dynamically
convey.setBaseUrl('https://eu.api.convey.dev');
```

---

## Auto-Pagination Async Iterators (`for await...of`)

Stream through large datasets without loading everything into memory:

```typescript
// Stream suppressions
for await (const suppression of convey.suppressions.listAutoPaging({ reason: 'SPAM_COMPLAINT' })) {
  console.log(`Suppression: ${suppression.identifier} (${suppression.reason})`);
}

// Or slice up to 500 items into an array cleanly:
const list = await convey.suppressions.listAutoPaging().autoPagingToArray(500);
```

---

## Typed Error Handling

```typescript
import {
  ConveyError,
  ConveyConfigurationError,
  ConveyValidationError,
  ConveyRateLimitError,
  ConveyConflictError,
  ConveyAuthenticationError,
  ConveyTimeoutError,
  ConveyNetworkError,
} from '@convey/sdk';

try {
  await convey.messages.send({ ... });
} catch (err) {
  if (err instanceof ConveyConfigurationError) {
    console.error('Invalid configuration or missing base URL:', err.message);
  } else if (err instanceof ConveyValidationError) {
    console.error('Validation failed on request:', err.details);
  } else if (err instanceof ConveyRateLimitError) {
    console.warn(`Rate limited! Retry after ${err.retryAfterSeconds}s`);
  } else if (err instanceof ConveyConflictError) {
    console.error(`Idempotency conflict: ${err.message}`);
  } else if (err instanceof ConveyAuthenticationError) {
    console.error('Invalid or expired API Key');
  } else if (err instanceof ConveyTimeoutError) {
    console.error(`Timeout exceeded (${err.timeoutMs}ms)`);
  } else if (err instanceof ConveyNetworkError) {
    console.error('Network failure:', err.cause);
  }
}
```

---

## License

MIT © [Convey](https://github.com/hamidrezakks/convey)
