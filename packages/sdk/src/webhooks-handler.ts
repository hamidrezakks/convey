/**
 * @convey/sdk - Webhook Framework Adapters & Test Fixtures
 * First-class adapters for Next.js App Router, Express, Cloudflare, and cryptographic test event generators.
 */

import type { ConveyWebhookEvent } from './types';
import { constructWebhookEvent, generateTestSignature } from './utils/crypto';

export type WebhookEventHandler<T = Record<string, unknown>> = (event: ConveyWebhookEvent<T>) => Promise<void> | void;

export type WebhookEventHandlerMap<T = Record<string, unknown>> = {
  [eventType: string]: WebhookEventHandler<T>;
};

export interface WebhookHandlerConfig<T = Record<string, unknown>> {
  /**
   * Convey Webhook Endpoint signing secret (e.g. `whsec_...`).
   */
  secret: string;

  /**
   * Maximum allowed clock drift in seconds.
   * @default 300
   */
  toleranceSeconds?: number;

  /**
   * Event routing map keyed by event type (e.g. `message.delivered`, `message.failed`, `*`).
   */
  handlers?: WebhookEventHandlerMap<T>;

  /**
   * Optional custom error responder.
   */
  onError?: (error: Error, payload: string) => Promise<Response | undefined> | Response | undefined;
}

export interface WebhookHandler<_T = Record<string, unknown>> {
  /**
   * Standard Web Fetch API Handler (for Next.js App Router, Cloudflare Workers, Hono, Elysia).
   */
  handleRequest(request: Request): Promise<Response>;

  /**
   * Node.js / Express middleware handler.
   */
  expressHandler(
    req: { body?: unknown; headers: Record<string, string | string[] | undefined>; rawBody?: string | Uint8Array },
    res: { status: (code: number) => { json: (data: unknown) => void; send: (data: string) => void } },
    next?: (err?: unknown) => void,
  ): Promise<void>;
}

/**
 * Create a framework-agnostic webhook receiver and event dispatcher.
 */
export function createWebhookHandler<T = Record<string, unknown>>(config: WebhookHandlerConfig<T>): WebhookHandler<T> {
  const { secret, toleranceSeconds = 300, handlers = {}, onError } = config;

  async function processEvent(rawBody: string, signature: string): Promise<ConveyWebhookEvent<T>> {
    const event = await constructWebhookEvent<T>(rawBody, signature, secret, toleranceSeconds);

    const typeHandler = handlers[event.type];
    if (typeHandler) {
      await typeHandler(event);
    }

    const wildcardHandler = handlers['*'];
    if (wildcardHandler) {
      await wildcardHandler(event);
    }

    return event;
  }

  return {
    async handleRequest(request: Request): Promise<Response> {
      try {
        const signature = request.headers.get('convey-signature') || request.headers.get('x-convey-signature') || '';

        const rawBody = await request.text();
        const event = await processEvent(rawBody, signature);

        return new Response(JSON.stringify({ received: true, eventId: event.id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        if (onError) {
          const customRes = await onError(err as Error, '');
          if (customRes) return customRes;
        }
        return new Response(JSON.stringify({ error: (err as Error).message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },

    async expressHandler(req, res, next) {
      try {
        const signatureHeader = req.headers['convey-signature'] || req.headers['x-convey-signature'] || '';
        const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader || '';

        let rawBody = '';
        if (typeof req.rawBody === 'string') {
          rawBody = req.rawBody;
        } else if (req.rawBody instanceof Uint8Array) {
          rawBody = new TextDecoder().decode(req.rawBody);
        } else if (typeof req.body === 'string') {
          rawBody = req.body;
        } else if (req.body && typeof req.body === 'object') {
          rawBody = JSON.stringify(req.body);
        }

        const event = await processEvent(rawBody, signature);
        res.status(200).json({ received: true, eventId: event.id });
      } catch (err) {
        if (onError) {
          await onError(err as Error, '');
          return;
        }
        if (next) {
          next(err);
        } else {
          res.status(400).json({ error: (err as Error).message });
        }
      }
    },
  };
}

export interface GenerateTestEventOptions<T = Record<string, unknown>> {
  type: string;
  data: T;
  secret: string;
  timestamp?: number;
  id?: string;
  teamId?: string;
}

/**
 * Generate a cryptographically valid mock webhook event and signature header for local unit testing.
 */
export async function generateTestWebhookEvent<T = Record<string, unknown>>(
  options: GenerateTestEventOptions<T>,
): Promise<{
  rawBody: string;
  signature: string;
  headers: Record<string, string>;
  event: ConveyWebhookEvent<T>;
}> {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const event: ConveyWebhookEvent<T> = {
    id: options.id || `evt_${Math.random().toString(36).substring(2, 11)}`,
    type: options.type,
    createdAt: new Date(timestamp * 1000).toISOString(),
    teamId: options.teamId || 'team_test',
    data: options.data,
  };

  const rawBody = JSON.stringify(event);
  const signature = await generateTestSignature(rawBody, options.secret, timestamp);

  return {
    rawBody,
    signature,
    headers: {
      'Content-Type': 'application/json',
      'convey-signature': signature,
      'x-convey-signature': signature,
    },
    event,
  };
}
