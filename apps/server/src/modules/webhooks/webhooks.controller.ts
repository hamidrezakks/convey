import type { Elysia } from 'elysia';
import { normalizeHeaders } from '../../utils/http';
import { TraceContext } from '../../utils/trace-context';
import { jsonErrorResponse, jsonResponse } from '../messaging/messaging.controller';
import { ClientReceiptSchema, ErrorCode, WebhookStatus } from '../messaging/messaging.types';
import { WebhookFlowType, WebhooksService } from './webhooks.service';

const TRANSPARENT_GIF_BUFFER = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export function resolveWebhookHttpStatus(status: WebhookStatus): number {
  return status === WebhookStatus.UNAUTHORIZED ? 401 : 200;
}

export function buildPixelGifResponse(): Response {
  return new Response(TRANSPARENT_GIF_BUFFER, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

function handleHubChallengeVerification(provider: string, query: Record<string, string | undefined>): Response {
  const result = WebhooksService.verifyHubChallenge(provider, query);
  if (result.verified && result.challenge) {
    return new Response(result.challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
  return new Response('Forbidden', { status: 403 });
}

export function webhooksController(app: Elysia) {
  return (
    app
      // --- Meta / WhatsApp Webhook Handshake Verification (GET) ---
      .get('/v1/webhooks/:provider', ({ params: { provider }, query }) => {
        return handleHubChallengeVerification(provider, query as Record<string, string | undefined>);
      })
      .get('/v1/webhooks/:provider/status', ({ params: { provider }, query }) => {
        return handleHubChallengeVerification(provider, query as Record<string, string | undefined>);
      })
      .get('/v1/webhooks/:provider/incoming', ({ params: { provider }, query }) => {
        return handleHubChallengeVerification(provider, query as Record<string, string | undefined>);
      })
      .get('/v1/webhooks/:provider/inbound', ({ params: { provider }, query }) => {
        return handleHubChallengeVerification(provider, query as Record<string, string | undefined>);
      })

      // --- Dedicated WhatsApp Status Update Webhook (POST) ---
      .post('/v1/webhooks/:provider/status', async ({ params: { provider }, body, headers, request }) => {
        const headerMap = normalizeHeaders(headers);
        const trace = TraceContext.extractOrCreate(headerMap);
        const traceHeader = TraceContext.formatHeader(trace);

        const result = await WebhooksService.ingestWebhook(provider, body, headerMap, request, WebhookFlowType.STATUS);
        const statusCode = resolveWebhookHttpStatus(result.status);
        return jsonResponse(result, statusCode, traceHeader);
      })

      // --- Dedicated WhatsApp Incoming Message Webhook (POST) ---
      .post('/v1/webhooks/:provider/incoming', async ({ params: { provider }, body, headers, request }) => {
        const headerMap = normalizeHeaders(headers);
        const trace = TraceContext.extractOrCreate(headerMap);
        const traceHeader = TraceContext.formatHeader(trace);

        const result = await WebhooksService.ingestWebhook(
          provider,
          body,
          headerMap,
          request,
          WebhookFlowType.INCOMING,
        );
        const statusCode = resolveWebhookHttpStatus(result.status);
        return jsonResponse(result, statusCode, traceHeader);
      })
      .post('/v1/webhooks/:provider/inbound', async ({ params: { provider }, body, headers, request }) => {
        const headerMap = normalizeHeaders(headers);
        const trace = TraceContext.extractOrCreate(headerMap);
        const traceHeader = TraceContext.formatHeader(trace);

        const result = await WebhooksService.ingestWebhook(
          provider,
          body,
          headerMap,
          request,
          WebhookFlowType.INCOMING,
        );
        const statusCode = resolveWebhookHttpStatus(result.status);
        return jsonResponse(result, statusCode, traceHeader);
      })

      // --- Unified / General Provider Webhook (POST) ---
      .post('/v1/webhooks/:provider', async ({ params: { provider }, body, headers, request }) => {
        const headerMap = normalizeHeaders(headers);
        const trace = TraceContext.extractOrCreate(headerMap);
        const traceHeader = TraceContext.formatHeader(trace);

        const result = await WebhooksService.ingestWebhook(provider, body, headerMap, request, WebhookFlowType.GENERAL);
        const statusCode = resolveWebhookHttpStatus(result.status);
        return jsonResponse(result, statusCode, traceHeader);
      })

      // --- Open Tracking Pixel (GET) ---
      .get('/v1/t/:token', async ({ params: { token } }) => {
        WebhooksService.ingestTrackingPixel(token).catch((err) => {
          console.error('Error ingesting tracking pixel:', err);
        });

        return buildPixelGifResponse();
      })

      // --- Client In-App Receipts (POST) ---
      .post('/v1/receipts', async ({ body, headers }) => {
        const headerMap = normalizeHeaders(headers);
        const trace = TraceContext.extractOrCreate(headerMap);
        const traceHeader = TraceContext.formatHeader(trace);

        const parsed = ClientReceiptSchema.safeParse(body);
        if (!parsed.success) {
          return jsonErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Invalid client receipt payload',
            400,
            undefined,
            traceHeader,
          );
        }
        await WebhooksService.ingestClientReceipt(parsed.data);
        return jsonResponse({ status: WebhookStatus.ACCEPTED }, 202, traceHeader);
      })
  );
}
