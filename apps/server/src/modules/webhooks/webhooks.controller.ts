import type { Elysia } from 'elysia';
import { WebhooksDocs } from '../../openapi';
import { normalizeHeaders } from '../../utils/http';
import { TraceContext } from '../../utils/trace-context';
import { guardApiRequest, verifyApiAuth } from '../auth/auth.middleware';
import type { TenantScope } from '../auth/tenant-scope';
import { jsonErrorResponse, jsonResponse } from '../messaging/messaging.controller';
import { ClientReceiptSchema, ErrorCode, WebhookStatus } from '../messaging/messaging.types';
import { ScopedMessagingService } from '../messaging/scoped-messaging.service';
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
      .get(
        '/v1/webhooks/:provider',
        { detail: WebhooksDocs.hubHandshake },
        ({ params, query }: { params: { provider: string }; query?: Record<string, string | undefined> }) => {
          return handleHubChallengeVerification(params.provider, query || {});
        },
      )
      .get(
        '/v1/webhooks/:provider/status',
        { detail: WebhooksDocs.hubStatusHandshake },
        ({ params, query }: { params: { provider: string }; query?: Record<string, string | undefined> }) => {
          return handleHubChallengeVerification(params.provider, query || {});
        },
      )
      .get(
        '/v1/webhooks/:provider/incoming',
        { detail: WebhooksDocs.hubIncomingHandshake },
        ({ params, query }: { params: { provider: string }; query?: Record<string, string | undefined> }) => {
          return handleHubChallengeVerification(params.provider, query || {});
        },
      )
      .get(
        '/v1/webhooks/:provider/inbound',
        { detail: WebhooksDocs.hubInboundHandshake },
        ({ params, query }: { params: { provider: string }; query?: Record<string, string | undefined> }) => {
          return handleHubChallengeVerification(params.provider, query || {});
        },
      )

      // --- Dedicated WhatsApp Status Webhook (Delivery / Read / Failure Receipts) ---
      .post(
        '/v1/webhooks/:provider/status',
        { parse: 'text', detail: WebhooksDocs.ingestStatus },
        async ({
          params,
          body,
          headers,
          request,
        }: {
          params: { provider: string };
          body: unknown;
          headers?: Record<string, string | undefined>;
          request?: Request;
        }) => {
          const rawHeaders = normalizeHeaders(headers || {});
          const result = await WebhooksService.ingestWebhook(
            params.provider,
            body,
            rawHeaders,
            request,
            WebhookFlowType.STATUS,
          );
          return jsonResponse({ status: result.status, received: true }, resolveWebhookHttpStatus(result.status));
        },
      )

      // --- Dedicated WhatsApp Incoming Messages (2-Way Session Customer Replies) ---
      .post(
        '/v1/webhooks/:provider/incoming',
        { parse: 'text', detail: WebhooksDocs.ingestIncoming },
        async ({
          params,
          body,
          headers,
          request,
        }: {
          params: { provider: string };
          body: unknown;
          headers?: Record<string, string | undefined>;
          request?: Request;
        }) => {
          const rawHeaders = normalizeHeaders(headers || {});
          const result = await WebhooksService.ingestWebhook(
            params.provider,
            body,
            rawHeaders,
            request,
            WebhookFlowType.INCOMING,
          );
          return jsonResponse({ status: result.status, received: true }, resolveWebhookHttpStatus(result.status));
        },
      )

      // Inbound alias for WhatsApp incoming
      .post(
        '/v1/webhooks/:provider/inbound',
        { parse: 'text', detail: WebhooksDocs.ingestInboundAlias },
        async ({
          params,
          body,
          headers,
          request,
        }: {
          params: { provider: string };
          body: unknown;
          headers?: Record<string, string | undefined>;
          request?: Request;
        }) => {
          const rawHeaders = normalizeHeaders(headers || {});
          const result = await WebhooksService.ingestWebhook(
            params.provider,
            body,
            rawHeaders,
            request,
            WebhookFlowType.INCOMING,
          );
          return jsonResponse({ status: result.status, received: true }, resolveWebhookHttpStatus(result.status));
        },
      )

      // --- Unified Inbound Provider Webhook (SendGrid, Twilio, Resend, Cequens, Infobip, etc.) ---
      .post(
        '/v1/webhooks/:provider',
        { parse: 'text', detail: WebhooksDocs.ingestProviderWebhook },
        async ({
          params,
          body,
          headers,
          request,
        }: {
          params: { provider: string };
          body: unknown;
          headers?: Record<string, string | undefined>;
          request?: Request;
        }) => {
          const rawHeaders = normalizeHeaders(headers || {});
          const result = await WebhooksService.ingestWebhook(params.provider, body, rawHeaders, request);
          return jsonResponse({ status: result.status, received: true }, resolveWebhookHttpStatus(result.status));
        },
      )

      // --- Email Open Tracking Pixel (1x1 Transparent GIF) ---
      .get(
        '/v1/t/:token',
        { detail: WebhooksDocs.openTrackingPixel },
        async ({ params }: { params: { token: string } }) => {
          await WebhooksService.ingestTrackingPixel(params.token);
          return buildPixelGifResponse();
        },
      )

      // --- Client Delivery Receipts (In-App SDKs / Mobile Client Read Receipts) ---
      .post(
        '/v1/receipts',
        { detail: WebhooksDocs.clientReceipt },
        async ({ body, headers }: { body: unknown; headers?: Record<string, string | undefined> }) => {
          const denied = await guardApiRequest(headers || {}, 'POST');
          if (denied) return denied;
          const incomingTrace = headers?.traceparent;
          const traceCtx = TraceContext.extractOrCreate({ traceparent: incomingTrace });

          const parseResult = ClientReceiptSchema.safeParse(body);
          if (!parseResult.success) {
            return jsonErrorResponse(
              ErrorCode.INVALID_PAYLOAD,
              'Invalid client receipt payload',
              400,
              parseResult.error.issues,
              TraceContext.formatHeader(traceCtx),
            );
          }

          const scope = (await verifyApiAuth(headers || {})) as TenantScope;
          if (!(await ScopedMessagingService.getMessageStatus(scope, parseResult.data.messageId)))
            return jsonErrorResponse('NOT_FOUND', 'Message not found', 404);
          await WebhooksService.ingestClientReceipt(parseResult.data);
          return jsonResponse(
            { status: WebhookStatus.ACCEPTED, received: true },
            202,
            TraceContext.formatHeader(traceCtx),
          );
        },
      )
  );
}
