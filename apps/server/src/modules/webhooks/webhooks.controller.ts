import type { Elysia } from 'elysia';
import {
  CommonHeaders,
  StandardResponseExamples,
} from '../../openapi/openapi.docs';
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
      .get(
        '/v1/webhooks/:provider',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'Meta / WhatsApp Webhook Challenge Handshake',
            description: 'Handles Meta WhatsApp Cloud API / Facebook Graph API hub verification handshake request.',
            parameters: [
              { name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } },
              { name: 'hub.mode', in: 'query', required: true, schema: { type: 'string', example: 'subscribe' } },
              { name: 'hub.verify_token', in: 'query', required: true, schema: { type: 'string', example: 'cv_verify_token_123' } },
              { name: 'hub.challenge', in: 'query', required: true, schema: { type: 'string', example: '1158201444' } },
            ],
            responses: {
              '200': {
                description: 'Challenge string returned in plain text on successful verification',
                content: { 'text/plain': { schema: { type: 'string', example: '1158201444' } } },
              },
              '403': { description: 'Invalid verify token or handshake parameters' },
            },
          },
        },
        ({ params: { provider }, query }) => {
          return handleHubChallengeVerification(provider, query as Record<string, string | undefined>);
        },
      )
      .get(
        '/v1/webhooks/:provider/status',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'WhatsApp Dedicated Status Webhook Handshake',
            description: 'Verification handshake for dedicated WhatsApp status callback endpoint.',
            parameters: [
              { name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } },
            ],
          },
        },
        ({ params: { provider }, query }) => {
          return handleHubChallengeVerification(provider, query as Record<string, string | undefined>);
        },
      )
      .get(
        '/v1/webhooks/:provider/incoming',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'WhatsApp Dedicated Incoming Message Webhook Handshake',
            description: 'Verification handshake for dedicated WhatsApp 2-way incoming message endpoint.',
            parameters: [
              { name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } },
            ],
          },
        },
        ({ params: { provider }, query }) => {
          return handleHubChallengeVerification(provider, query as Record<string, string | undefined>);
        },
      )
      .get(
        '/v1/webhooks/:provider/inbound',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'WhatsApp Dedicated Inbound Webhook Handshake',
            description: 'Verification handshake for dedicated WhatsApp inbound endpoint alias.',
            parameters: [
              { name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } },
            ],
          },
        },
        ({ params: { provider }, query }) => {
          return handleHubChallengeVerification(provider, query as Record<string, string | undefined>);
        },
      )

      // --- Dedicated WhatsApp Status Update Webhook (POST) ---
      .post(
        '/v1/webhooks/:provider/status',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'Ingest WhatsApp Dedicated Status Webhook',
            description: 'Ingests WhatsApp delivery and read receipts (delivered, read, failed).',
            headers: CommonHeaders,
            parameters: [
              { name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } },
            ],
            responses: {
              '200': {
                description: 'Status update ingested successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['accepted', 'duplicate_ignored', 'unauthorized'], example: 'accepted' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async ({ params: { provider }, body, headers, request }) => {
          const headerMap = normalizeHeaders(headers);
          const trace = TraceContext.extractOrCreate(headerMap);
          const traceHeader = TraceContext.formatHeader(trace);

          const result = await WebhooksService.ingestWebhook(provider, body, headerMap, request, WebhookFlowType.STATUS);
          const statusCode = resolveWebhookHttpStatus(result.status);
          return jsonResponse(result, statusCode, traceHeader);
        },
      )

      // --- Dedicated WhatsApp Incoming Message Webhook (POST) ---
      .post(
        '/v1/webhooks/:provider/incoming',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'Ingest WhatsApp Dedicated Incoming 2-Way Message',
            description:
              'Ingests customer-initiated 2-way incoming WhatsApp messages, refreshing the 24-hour service window for zero-cost session optimization.',
            headers: CommonHeaders,
            parameters: [
              { name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } },
            ],
            responses: {
              '200': {
                description: 'Inbound message processed and 24h window refreshed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'accepted' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async ({ params: { provider }, body, headers, request }) => {
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
        },
      )
      .post(
        '/v1/webhooks/:provider/inbound',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'Ingest Inbound Message (Alias)',
            description: 'Alias for incoming message ingestion endpoint.',
            parameters: [
              { name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } },
            ],
          },
        },
        async ({ params: { provider }, body, headers, request }) => {
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
        },
      )

      // --- Unified / General Provider Webhook (POST) ---
      .post(
        '/v1/webhooks/:provider',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'Unified Inbound Provider Webhook Ingestion',
            description:
              'Ingests delivery receipts, bounces, spam complaints, and incoming messages from upstream providers (Twilio, SendGrid, Resend, Cequens, Infobip, etc.).',
            headers: CommonHeaders,
            parameters: [
              { name: 'provider', in: 'path', required: true, description: 'Provider identifier slug', schema: { type: 'string', example: 'sendgrid' } },
            ],
            requestBody: {
              required: true,
              description: 'Provider-specific delivery webhook event payload',
              content: {
                'application/json': {
                  examples: {
                    sendgrid_delivered: {
                      summary: 'SendGrid Delivery Receipt',
                      value: [
                        {
                          email: 'customer@example.com',
                          event: 'delivered',
                          sg_message_id: 'sg_10928312.filter',
                          timestamp: 1786500600,
                        },
                      ],
                    },
                    twilio_sms_delivered: {
                      summary: 'Twilio SMS Status Callback',
                      value: {
                        MessageSid: 'SM1234567890abcdef',
                        MessageStatus: 'delivered',
                        To: '+971501234567',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Webhook successfully parsed and enqueued',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'accepted' },
                      },
                    },
                  },
                },
              },
              '401': {
                description: 'Invalid Webhook Cryptographic Signature',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: { unauthorized: StandardResponseExamples.unauthorized },
                  },
                },
              },
            },
          },
        },
        async ({ params: { provider }, body, headers, request }) => {
          const headerMap = normalizeHeaders(headers);
          const trace = TraceContext.extractOrCreate(headerMap);
          const traceHeader = TraceContext.formatHeader(trace);

          const result = await WebhooksService.ingestWebhook(provider, body, headerMap, request, WebhookFlowType.GENERAL);
          const statusCode = resolveWebhookHttpStatus(result.status);
          return jsonResponse(result, statusCode, traceHeader);
        },
      )

      // --- Open Tracking Pixel (GET) ---
      .get(
        '/v1/t/:token',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'Email Open Tracking Pixel (1x1 Transparent GIF)',
            description: 'Zero-footprint 1x1 transparent GIF tracking endpoint for recording email open events.',
            parameters: [
              { name: 'token', in: 'path', required: true, description: 'Encrypted message open tracking token', schema: { type: 'string', example: 'tok_01J0N...' } },
            ],
            responses: {
              '200': {
                description: '1x1 Transparent GIF Image',
                content: {
                  'image/gif': {
                    schema: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
        },
        async ({ params: { token } }) => {
          WebhooksService.ingestTrackingPixel(token).catch((err) => {
            console.error('Error ingesting tracking pixel:', err);
          });

          return buildPixelGifResponse();
        },
      )

      // --- Client In-App Receipts (POST) ---
      .post(
        '/v1/receipts',
        {
          detail: {
            tags: ['Webhooks'],
            summary: 'Ingest Client In-App Delivery / Read Receipts',
            description: 'Ingests delivery, read, or interaction confirmations directly from client mobile applications or SDKs.',
            headers: CommonHeaders,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      messageId: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
                      channel: { type: 'string', example: 'push' },
                      event: { type: 'string', enum: ['delivered', 'read', 'clicked'], example: 'read' },
                    },
                    required: ['messageId'],
                  },
                  examples: {
                    in_app_receipt: {
                      summary: 'Client Read Receipt',
                      value: {
                        messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3',
                        channel: 'push',
                        event: 'read',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '202': {
                description: 'Receipt accepted for processing',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'accepted' },
                      },
                    },
                  },
                },
              },
              '400': {
                description: 'Invalid Receipt Payload',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: { validation_error: StandardResponseExamples.bad_request_validation },
                  },
                },
              },
            },
          },
        },
        async ({ body, headers }) => {
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
        },
      )
  );
}
