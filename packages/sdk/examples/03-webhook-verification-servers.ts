/**
 * @convey/sdk Example 03: Cryptographic Webhook Ingestion Across Server Frameworks
 *
 * Demonstrates timing-safe HMAC-SHA256 signature verification and typed event
 * deserialization in Elysia, Next.js App Router, Express, and native fetch/Cloudflare Workers.
 */

import { Convey, ConveySecurityError, type ConveyWebhookEvent } from '../src';

const WEBHOOK_SECRET = process.env.CONVEY_WEBHOOK_SECRET || 'whsec_sample_secret_key_8899aabbcc';

// =========================================================================
// 1. Next.js App Router (app/api/webhooks/convey/route.ts)
// =========================================================================
export async function POST(req: Request) {
  const signature = req.headers.get('x-convey-signature');
  if (!signature) {
    return new Response('Missing x-convey-signature header', { status: 401 });
  }

  // IMPORTANT: Read raw body text BEFORE JSON parsing for valid HMAC computation
  const rawBody = await req.text();

  try {
    const event = await Convey.webhooks.constructEvent<{
      messageId: string;
      provider?: string;
      deliveredAt?: string;
      costUsd?: number;
    }>(rawBody, signature, WEBHOOK_SECRET, 300); // 300s clock skew tolerance

    console.log(`[Next.js] Verified Webhook Event: ${event.type} for Message: ${event.data.messageId}`);

    switch (event.type) {
      case 'message.delivered':
        console.log(`Delivered via ${event.data.provider} at ${event.data.deliveredAt}`);
        break;
      case 'message.failed':
        console.warn(`Message failed delivery: ${event.data.messageId}`);
        break;
      case 'message.opened':
        console.log(`Recipient opened message: ${event.data.messageId}`);
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof ConveySecurityError) {
      console.error('[Next.js] Webhook Security Breach / Bad Signature:', err.message);
      return new Response('Invalid webhook signature', { status: 403 });
    }
    return new Response('Internal webhook processing error', { status: 500 });
  }
}

// =========================================================================
// 2. Elysia Web Framework Pattern
// =========================================================================
export interface ElysiaAppLike {
  post: (path: string, handler: (ctx: { request: Request; set: { status: number } }) => Promise<unknown>) => unknown;
}

export function registerElysiaWebhook(app: ElysiaAppLike) {
  app.post('/webhooks/convey', async ({ request, set }: { request: Request; set: { status: number } }) => {
    const signature = request.headers.get('x-convey-signature') || '';
    const rawBody = await request.text();

    try {
      const event = await Convey.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
      console.log(`[Elysia] Ingested event ${event.id} of type ${event.type}`);
      return { success: true };
    } catch (err) {
      set.status = 400;
      return { error: (err as Error).message };
    }
  });
}

// =========================================================================
// 3. Express.js Server Pattern (with express.raw({ type: 'application/json' }))
// =========================================================================
export interface ExpressAppLike {
  post: (
    path: string,
    handler: (
      req: { headers: Record<string, string | string[] | undefined>; body: string | Uint8Array },
      res: { status: (code: number) => { json: (data: unknown) => void; send: (msg: string) => void } },
    ) => Promise<void>,
  ) => unknown;
}

export function registerExpressWebhook(app: ExpressAppLike) {
  app.post('/webhooks/convey', async (req, res) => {
    const rawSig = req.headers['x-convey-signature'];
    const signature = Array.isArray(rawSig) ? rawSig[0] : rawSig || '';
    const rawPayload = req.body;

    try {
      const event = await Convey.webhooks.constructEvent(rawPayload, signature, WEBHOOK_SECRET);
      console.log(`[Express] Ingested event: ${event.id}`);
      res.status(200).json({ received: true });
    } catch (err) {
      res.status(400).send(`Webhook verification failed: ${(err as Error).message}`);
    }
  });
}

// =========================================================================
// 4. Cloudflare Workers / Deno Standard Fetch Handler
// =========================================================================
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'POST' && new URL(request.url).pathname === '/webhooks/convey') {
      const signature = request.headers.get('x-convey-signature') || '';
      const rawBody = await request.text();

      const isValid = await Convey.webhooks.verifySignature(rawBody, signature, WEBHOOK_SECRET);
      if (!isValid) {
        return new Response('Unauthorized Signature', { status: 401 });
      }

      const event: ConveyWebhookEvent = JSON.parse(rawBody);
      console.log(`[Edge Worker] Processed ${event.type}`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },
};
