# Convey Node/Bun SDK (`@convey/sdk`)

Official zero-dependency, high-throughput TypeScript/JavaScript SDK for the **Convey** communication service. Runs natively in **Node.js (v18+)**, **Bun (1.x+)**, and Edge runtimes (**Cloudflare Workers, Deno, Next.js Edge**).

[![NPM Version](https://img.shields.io/npm/v/@convey/sdk.svg)](https://www.npmjs.com/package/@convey/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Features

- ⚡ **Zero Runtime Dependencies**: Built entirely on standard Web APIs (`fetch`, `AbortSignal`, `crypto.subtle` / `node:crypto`). Micro-footprint (<15KB).
- 🛡️ **Deterministic Resiliency**: Built-in full-jitter exponential backoff and automatic HTTP 429 `Retry-After` header parsing.
- 🔁 **Idempotency by Default**: Transparent or explicit `Idempotency-Key` (ULID) generation preventing duplicate dispatches on network retries.
- 🌊 **Auto-Pagination Streaming**: Native `for await...of` async iterators for memory-efficient processing of huge datasets.
- 🕵️ **W3C Distributed Tracing**: Automatic generation and propagation of W3C `traceparent` child spans.
- 🔐 **Timing-Safe Webhook Verification**: Cryptographic HMAC-SHA256 verification with replay tolerance window protection.
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

## Quickstart

```typescript
import { Convey } from '@convey/sdk';

// Initialize client
const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!, // e.g. 'sk_live_...'
  baseUrl: 'http://localhost:3000',    // optional, defaults to CONVEY_BASE_URL
});

// Send an email
const message = await convey.messages.send({
  channel: 'EMAIL',
  recipient: 'customer@example.com',
  priority: 'HIGH',
  content: {
    subject: 'Welcome to our platform!',
    body: '<h1>Welcome, Alex!</h1><p>We are thrilled to have you onboard.</p>',
  },
  category: 'ONBOARDING',
});

console.log(`Accepted: ${message.publicId} (${message.status})`);
```

---

## Omnichannel Dispatches

### WhatsApp 24-Hour Free Session Optimization / OTP
```typescript
const whatsapp = await convey.messages.send({
  channel: 'WHATSAPP',
  recipient: '+14155552671',
  priority: 'CRITICAL',
  content: {
    body: 'Your Convey verification code is *920-184*. Valid for 5 minutes.',
    templateId: 'otp_v1',
    variables: { code: '920184' },
  },
  category: 'AUTH',
});
```

### SMS with Smart GSM Packing
```typescript
const sms = await convey.messages.send({
  channel: 'SMS',
  recipient: '+14155550199',
  content: {
    body: 'Your delivery driver has arrived.',
  },
});
```

### Push Notifications
```typescript
const push = await convey.messages.send({
  channel: 'PUSH',
  recipient: 'device_token_apns_88f9b2c1...',
  content: {
    subject: 'New Order Received',
    body: 'Order #4892 was just placed.',
  },
  metadata: { deepLink: 'app://orders/4892' },
});
```

### Slack Interactive Notification
```typescript
const slack = await convey.messages.send({
  channel: 'SLACK',
  recipient: 'https://hooks.slack.com/services/T00/B00/XXXX',
  content: {
    body: ':warning: *High Error Rate Detected* in `outbox-relay.worker`',
  },
});
```

---

## High-Throughput Bulk Dispatch

```typescript
const bulk = await convey.messages.sendBulk([
  { channel: 'EMAIL', recipient: 'user1@test.com', content: { subject: 'Digest', body: '...' } },
  { channel: 'EMAIL', recipient: 'user2@test.com', content: { subject: 'Digest', body: '...' } },
  { channel: 'SMS', recipient: '+14155550001', content: { body: 'Alert' } },
]);

console.log(`Accepted ${bulk.total} messages into transactional outbox.`);
```

---

## Lifecycle, Timelines & Distributed Traces

```typescript
const messageId = 'msg_01J9X8K2M4N5P6Q7R8S9T0V1W2';

// 1. Inspect Status
const status = await convey.messages.get(messageId);

// 2. Chronological Provider Attempt Timeline
const { timeline } = await convey.messages.getTimeline(messageId);
for (const step of timeline) {
  console.log(`[${step.status}] provider=${step.provider} attempts=${step.attemptNumber} at ${step.timestamp}`);
}

// 3. W3C Distributed Trace Span Waterfall
const trace = await convey.messages.getTrace(messageId);
console.log(`Traceparent: ${trace.traceparent} | Total Duration: ${trace.totalDurationMs}ms`);
for (const span of trace.spans) {
  console.log(`  └─ Span [${span.status}] ${span.name} (${span.serviceName}) took ${span.durationMs}ms`);
}
```

---

## Auto-Pagination Async Iterators (`for await...of`)

Stream through huge datasets without buffering thousands of items into RAM:

```typescript
// Stream suppressions
for await (const suppression of convey.suppressions.listAutoPaging({ reason: 'SPAM_COMPLAINT' })) {
  console.log(`Suppression: ${suppression.identifier} (${suppression.reason})`);
}

// Or accumulate up to 500 items into an array cleanly:
const list = await convey.suppressions.listAutoPaging().autoPagingToArray(500);
```

---

## Webhook Signature Verification

Convey signs all webhook delivery receipts using HMAC-SHA256.

### Express / Node.js
```typescript
import express from 'express';
import { Convey } from '@convey/sdk';

const app = express();
const WEBHOOK_SECRET = process.env.CONVEY_WEBHOOK_SECRET!;

app.post('/api/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-convey-signature'] as string;
  const rawBody = req.body.toString('utf8');

  try {
    const event = await Convey.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET, 300);

    if (event.type === 'message.delivered') {
      console.log(`Delivered message: ${event.data.messageId} via ${event.data.provider}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(401).send('Webhook signature verification failed');
  }
});
```

### Bun / Elysia / Next.js / Cloudflare Workers
```typescript
import { Convey } from '@convey/sdk';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-convey-signature') || '';

  try {
    const event = await Convey.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.CONVEY_WEBHOOK_SECRET!
    );
    return Response.json({ success: true, eventId: event.id });
  } catch {
    return new Response('Invalid Webhook Signature', { status: 401 });
  }
}
```

---

## Dead-Letter Queue (DLQ) & Mutated Replay

```typescript
// 1. List Failed Messages in DLQ
const dlq = await convey.dlq.list({ team: 'billing_team' });

// 2. Simple Replay (Non-Mutated)
await convey.dlq.replay({
  messageIds: dlq.items.map(m => m.publicId),
});

// 3. Dry-Run Mutated Replay Simulation
const simulation = await convey.dlq.replayMutated({
  dryRun: true,
  filter: {
    errorCategory: 'RATE_LIMIT_429',
    timeRange: 'last_24_hours',
  },
  replayConfig: {
    concurrency: 10,
    backoffJitterMs: 1000,
  },
});
console.log(`Simulation matched: ${simulation.matchedMessagesCount} messages. Risk: ${simulation.simulation?.riskLevel}`);
```

---

## Multi-Dimension Analytics & Reports

```typescript
// Overview Report
const overview = await convey.reports.getOverview({
  startDate: '2026-08-01T00:00:00Z',
  endDate: '2026-08-24T23:59:59Z',
});
console.log(`Delivery Rate: ${overview.summary.deliveryRatePercent}% | Cost: $${overview.summary.totalCostUsd}`);

// Teams Budget Report
const teams = await convey.reports.getTeams();

// Campaign Performance Funnel
const campaign = await convey.reports.getCampaignDetails('cmp_welcome_series');

// Export CSV Report
const csv = await convey.reports.export('campaigns', 'csv', {
  startDate: '2026-08-01T00:00:00Z',
});
```

---

## Admin Studio & Live Telemetry

```typescript
// 1. Real-Time Live Telemetry Snapshot
const telemetry = await convey.admin.getLiveTelemetry();
console.log(`Throughput: ${telemetry.throughputRps} rps | p95 Latency: ${telemetry.latency.p95Ms}ms`);

// 2. Dynamic Circuit Breaker Override
await convey.admin.setCircuitState('sendgrid', 'FORCE_HALF_OPEN', 25);

// 3. Trigger Synthetic Canary Probe
const canary = await convey.admin.triggerCanary('twilio');

// 4. Register a New Provider Dynamically
await convey.admin.registerProvider({
  providerId: 'resend',
  channel: 'EMAIL',
  credentials: { RESEND_API_KEY: 're_123' },
  isPrimary: true,
});
```

---

## Typed Error Handling

```typescript
import {
  ConveyError,
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
  if (err instanceof ConveyValidationError) {
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
  } else if (err instanceof ConveyError) {
    console.error(`Convey API Error [${err.name}]: ${err.message}`);
  }
}
```

---

## Documentation & Guides

- 📖 [Complete API Reference](./docs/API_REFERENCE.md)
- 🍳 [Enterprise Production Cookbook (Next.js, Elysia, Express, Edge)](./docs/COOKBOOK.md)
- 🌐 [Language-Agnostic Porting Specification](./docs/PORTING_SPECIFICATION.md) (Python, Go, Rust, Java, PHP, Ruby)
- 💡 [Runnable TypeScript Examples](./examples/):
  - [01-quickstart-omnichannel.ts](./examples/01-quickstart-omnichannel.ts)
  - [02-bulk-and-batches.ts](./examples/02-bulk-and-batches.ts)
  - [03-webhook-verification-servers.ts](./examples/03-webhook-verification-servers.ts)
  - [04-auto-pagination-streaming.ts](./examples/04-auto-pagination-streaming.ts)
  - [05-dlq-inspection-and-mutated-replay.ts](./examples/05-dlq-inspection-and-mutated-replay.ts)
  - [06-observability-apm-tracing.ts](./examples/06-observability-apm-tracing.ts)
  - [07-analytics-and-admin-studio.ts](./examples/07-analytics-and-admin-studio.ts)

---

## License

MIT © [Convey](https://github.com/hamidrezakks/convey)
