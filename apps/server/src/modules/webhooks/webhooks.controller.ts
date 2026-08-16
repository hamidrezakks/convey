import type { Elysia } from 'elysia';
import { normalizeHeaders } from '../../utils/http';
import { jsonErrorResponse, jsonResponse } from '../messaging/messaging.controller';
import { ClientReceiptSchema, ErrorCode, WebhookStatus } from '../messaging/messaging.types';
import { WebhooksService } from './webhooks.service';

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

import { TraceContext } from '../../utils/trace-context';

export function webhooksController(app: Elysia) {
  return app
    .post('/v1/webhooks/:provider', async ({ params: { provider }, body, headers, request }) => {
      const headerMap = normalizeHeaders(headers);
      const trace = TraceContext.extractOrCreate(headerMap);
      const traceHeader = TraceContext.formatHeader(trace);

      const result = await WebhooksService.ingestWebhook(provider, body, headerMap, request);
      const statusCode = resolveWebhookHttpStatus(result.status);
      return jsonResponse(result, statusCode, traceHeader);
    })
    .get('/v1/t/:token', async ({ params: { token } }) => {
      WebhooksService.ingestTrackingPixel(token).catch((err) => {
        console.error('Error ingesting tracking pixel:', err);
      });

      return buildPixelGifResponse();
    })
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
    });
}
