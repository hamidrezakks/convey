# Convey SDK Enterprise Cookbook & Production Patterns

A comprehensive collection of production-grade architectural recipes, framework integrations, and operational patterns for `@convey/sdk`.

---

## Table of Contents
1. [Next.js App Router (14/15) & Server Actions](#1-nextjs-app-router-1415--server-actions)
2. [Elysia & Bun Microservices](#2-elysia--bun-microservices)
3. [Express.js & Fastify API Gateways](#3-expressjs--fastify-api-gateways)
4. [Cloudflare Workers & Edge Runtimes](#4-cloudflare-workers--edge-runtimes)
5. [AWS Lambda & Background Workers](#5-aws-lambda--background-workers)
6. [Resilient Error Handling & Retry Policies](#6-resilient-error-handling--retry-policies)
7. [Distributed Tracing with OpenTelemetry](#7-distributed-tracing-with-opentelemetry)

---

## 1. Next.js App Router (14/15) & Server Actions

### Client Initialization Utility (`src/lib/convey.ts`)

```typescript
// src/lib/convey.ts
import { Convey } from '@convey/sdk';

if (!process.env.CONVEY_API_KEY) {
  throw new Error('Missing CONVEY_API_KEY environment variable');
}

export const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY,
  teamId: process.env.CONVEY_TEAM_ID || 'web-app',
  timeoutMs: 8000,
});
```

### Server Action for User Signup (`src/app/actions/auth.ts`)

```typescript
'use server';

import { convey } from '@/lib/convey';
import { ConveyConflictError, ConveyRateLimitError } from '@convey/sdk';

export async function sendWelcomeNotification(user: { id: string; email: string; name: string }) {
  try {
    const response = await convey.messages.send({
      channel: 'EMAIL',
      recipient: user.email,
      priority: 'HIGH',
      content: {
        subject: `Welcome to our platform, ${user.name}!`,
        body: `<p>Hi ${user.name}, we are excited to have you on board!</p>`,
      },
      metadata: {
        userId: user.id,
        signupSource: 'marketing_landing_page',
      },
      // Deterministic idempotency key per user registration
      idempotencyKey: `user_welcome_${user.id}`,
    });

    return { success: true, messageId: response.publicId };
  } catch (error) {
    if (error instanceof ConveyConflictError) {
      console.info('Welcome email was already dispatched for this user ID.');
      return { success: true, alreadyDispatched: true };
    }
    if (error instanceof ConveyRateLimitError) {
      console.warn(`Throttled by Convey API. Retry after: ${error.retryAfterSeconds}s`);
      return { success: false, error: 'Service temporarily busy. Please retry later.' };
    }
    console.error('Failed to dispatch welcome email:', error);
    return { success: false, error: 'Could not send verification email.' };
  }
}
```

### Route Handler for Webhooks (`src/app/api/webhooks/convey/route.ts`)

```typescript
// src/app/api/webhooks/convey/route.ts
import { Convey, ConveySecurityError } from '@convey/sdk';

const WEBHOOK_SECRET = process.env.CONVEY_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const signature = req.headers.get('x-convey-signature');
  if (!signature) {
    return new Response('Missing signature header', { status: 401 });
  }

  // Read raw text for constant-time HMAC comparison
  const rawBody = await req.text();

  try {
    const event = await Convey.webhooks.constructEvent<{
      messageId: string;
      provider?: string;
      deliveredAt?: string;
    }>(rawBody, signature, WEBHOOK_SECRET);

    console.log(`[Webhook Ingestion] Event ${event.id}: ${event.type} on message ${event.data.messageId}`);

    if (event.type === 'message.delivered') {
      // Update internal database delivery status
    } else if (event.type === 'message.failed') {
      // Alert on-call or update user notification preferences
    }

    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ConveySecurityError) {
      console.error('Invalid webhook cryptographic signature:', error.message);
      return new Response('Invalid signature', { status: 403 });
    }
    return new Response('Internal error', { status: 500 });
  }
}
```

---

## 2. Elysia & Bun Microservices

### High-Throughput Service Controller

```typescript
import { Elysia, t } from 'elysia';
import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: process.env.CONVEY_API_URL || 'http://localhost:3000',
});

export const notificationService = new Elysia({ prefix: '/api/v1' })
  .post(
    '/send-sms-otp',
    async ({ body, set }) => {
      const result = await convey.messages.send({
        channel: 'SMS',
        recipient: body.phone,
        priority: 'CRITICAL',
        content: {
          body: `Your one-time authentication code is: ${body.otp}`,
        },
        category: 'SECURITY',
      });

      set.status = 202;
      return {
        success: true,
        messageId: result.publicId,
        state: result.status,
      };
    },
    {
      body: t.Object({
        phone: t.String(),
        otp: t.String(),
      }),
    },
  )
  .post(
    '/webhooks/convey',
    async ({ request, set }) => {
      const signature = request.headers.get('x-convey-signature') || '';
      const rawPayload = await request.text();

      try {
        const event = await Convey.webhooks.constructEvent(
          rawPayload,
          signature,
          process.env.CONVEY_WEBHOOK_SECRET!,
        );
        return { ok: true, eventId: event.id };
      } catch (err) {
        set.status = 403;
        return { error: (err as Error).message };
      }
    },
  );
```

---

## 3. Express.js & Fastify API Gateways

### Express.js Webhook Middleware Setup

```typescript
import express from 'express';
import { Convey, ConveySecurityError } from '@convey/sdk';

const app = express();
const WEBHOOK_SECRET = process.env.CONVEY_WEBHOOK_SECRET!;

// Use raw body parser strictly for the webhook route
app.post(
  '/webhooks/convey',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['x-convey-signature'] as string;
    const rawBody = req.body; // Buffer

    try {
      const event = await Convey.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
      console.log(`[Express Webhook] Verified event: ${event.type}`);
      res.status(200).json({ status: 'ok' });
    } catch (err) {
      if (err instanceof ConveySecurityError) {
        res.status(403).send('Signature Verification Failed');
      } else {
        res.status(400).send(`Malformed payload: ${(err as Error).message}`);
      }
    }
  },
);

// Standard JSON parser for other routes
app.use(express.json());
```

---

## 4. Cloudflare Workers & Edge Runtimes

```typescript
import { Convey } from '@convey/sdk';

export interface Env {
  CONVEY_API_KEY: string;
  CONVEY_WEBHOOK_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Initializing Convey on the Edge (Zero Dependencies)
    const convey = new Convey({
      apiKey: env.CONVEY_API_KEY,
    });

    if (request.method === 'POST' && url.pathname === '/dispatch-alert') {
      const { email, alertText } = (await request.json()) as { email: string; alertText: string };

      const res = await convey.messages.send({
        channel: 'EMAIL',
        recipient: email,
        priority: 'HIGH',
        content: {
          subject: 'Edge Alert Notification',
          body: `<p>${alertText}</p>`,
        },
      });

      return Response.json({ success: true, messageId: res.publicId });
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/convey') {
      const signature = request.headers.get('x-convey-signature') || '';
      const rawText = await request.text();

      const isValid = await Convey.webhooks.verifySignature(rawText, signature, env.CONVEY_WEBHOOK_SECRET);
      if (!isValid) {
        return new Response('Unauthorized', { status: 401 });
      }

      return Response.json({ processed: true });
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

---

## 5. AWS Lambda & Background Workers

### DLQ Auto-Remediation Worker

```typescript
import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
});

export async function handler() {
  console.log('Starting DLQ inspection & auto-remediation batch...');

  // 1. Stream DLQ items with auto-pagination
  const dlqStream = convey.dlq.listAutoPaging({ limit: 100 });
  const transientFailures: string[] = [];

  for await (const entry of dlqStream) {
    // Collect transient network/timeout failures eligible for replay
    if (entry.failureCategory === 'TRANSIENT' || entry.failureCategory === 'RATE_LIMITED') {
      transientFailures.push(entry.messageId);
    }
  }

  console.log(`Identified ${transientFailures.length} transient failures for auto-replay.`);

  // 2. Replay in chunks of 50
  for (let i = 0; i < transientFailures.length; i += 50) {
    const chunk = transientFailures.slice(i, i + 50);
    const result = await convey.dlq.replay({
      messageIds: chunk,
    });
    console.log(`Replayed chunk ${i / 50 + 1}: ${result.replayedCount} succeeded, ${result.failedCount} failed.`);
  }

  return { statusCode: 200, replayed: transientFailures.length };
}
```

---

## 6. Resilient Error Handling & Retry Policies

```typescript
import {
  Convey,
  ConveyAuthenticationError,
  ConveyConflictError,
  ConveyRateLimitError,
  ConveyTimeoutError,
  ConveyValidationError,
} from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  maxRetries: 4, // 4 exponential backoff attempts on 429 and transient 5xx
});

async function safeDispatch(payload: any) {
  try {
    return await convey.messages.send(payload);
  } catch (error) {
    if (error instanceof ConveyValidationError) {
      console.error('Invalid recipient format or payload structure:', error.details);
      // Do not retry, fix payload or reject request
      return { status: 'rejected_invalid_input', details: error.details };
    }

    if (error instanceof ConveyAuthenticationError) {
      console.error('API Key invalid or expired. Check environment secrets.');
      throw error;
    }

    if (error instanceof ConveyRateLimitError) {
      console.warn(`Rate limited even after retries. Retry in ${error.retryAfterSeconds}s`);
      return { status: 'rate_limited', retryAfter: error.retryAfterSeconds };
    }

    if (error instanceof ConveyConflictError) {
      console.info('Idempotent duplicate send detected; original was accepted.');
      return { status: 'idempotent_duplicate' };
    }

    if (error instanceof ConveyTimeoutError) {
      console.error(`Request deadline (${error.timeoutMs}ms) exceeded.`);
      return { status: 'timeout' };
    }

    throw error;
  }
}
```

---

## 7. Distributed Tracing with OpenTelemetry

```typescript
import { trace, context } from '@opentelemetry/api';
import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
});

export async function sendTracedEmail(recipient: string, subject: string, body: string) {
  const tracer = trace.getTracer('notification-service');

  return tracer.startActiveSpan('dispatch_email_notification', async (span) => {
    try {
      const spanContext = span.spanContext();

      // Format W3C traceparent header: 00-<trace_id>-<span_id>-<trace_flags>
      const traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-01`;

      // SDK automatically stitches a child span and forwards trace context to Convey
      const response = await convey.messages.send(
        {
          channel: 'EMAIL',
          recipient,
          content: { subject, body },
        },
        { traceparent },
      );

      span.setAttribute('convey.message_id', response.publicId);
      span.setAttribute('convey.status', response.status);

      return response;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}
```
