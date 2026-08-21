import type { Elysia } from 'elysia';
import type { z } from 'zod';
import { env } from '../../config/env';
import {
  CommonHeaders,
  MessageRequestExamples,
  StandardResponseExamples,
  StandardSecurityRequirement,
} from '../../openapi/openapi.docs';
import { TraceContext } from '../../utils/trace-context';
import { verifyApiAuth } from '../auth/auth.middleware';
import { IdempotencyConflictError } from './idempotency.service';
import { MessagingService } from './messaging.service';
import {
  BulkSendMessageRequestSchema,
  DomainValidationError,
  ErrorCode,
  SendMessageRequestSchema,
  SystemOverloadError,
  TemplatePreviewRequestSchema,
} from './messaging.types';
import { TemplateEngine } from './template-engine';

export function jsonResponse(body: unknown, status = 200, traceHeader?: string): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (traceHeader) {
    headers.traceparent = traceHeader;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

export function jsonErrorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
  traceHeader?: string,
): Response {
  return jsonResponse(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    status,
    traceHeader,
  );
}

export function formatZodValidationDetails(issues: z.ZodIssue[]) {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  }));
}

export function messagingController(app: Elysia) {
  return app.group('/v1/messages', (app) =>
    app
      .beforeHandle(async ({ headers }: { headers: Record<string, string | undefined> }) => {
        const auth = await verifyApiAuth(headers, env.CONVEY_REQUIRE_AUTH);
        if (auth.errorResponse) {
          return auth.errorResponse;
        }
      })
      .post(
        '/bulk',
        {
          detail: {
            tags: ['Messages'],
            summary: 'High-Throughput Bulk Message Dispatch',
            description:
              'Accepts up to 500 individualized message payloads in a single HTTP batch with per-item idempotency and atomic outbox writes.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            requestBody: {
              required: true,
              description: 'Array of up to 500 individualized multi-channel send message requests',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BulkSendMessageRequest' },
                  examples: {
                    bulk_marketing_broadcast: {
                      summary: 'Bulk Promotional Campaign',
                      description: 'Dispatches multi-recipient marketing campaign to SMS and Email channels.',
                      value: {
                        messages: [
                          {
                            idempotencyKey: 'bulk_promo_usr_001',
                            userId: 'usr_001',
                            team: 'marketing',
                            category: 'marketing',
                            country: 'AE',
                            recipients: { phone: '+971501110001' },
                            channels: [{ channel: 'sms', content: { text: 'Flash Sale: 20% off today only!' } }],
                          },
                          {
                            idempotencyKey: 'bulk_promo_usr_002',
                            userId: 'usr_002',
                            team: 'marketing',
                            category: 'marketing',
                            country: 'AE',
                            recipients: { email: 'user002@example.com' },
                            channels: [
                              {
                                channel: 'email',
                                content: { subject: 'Flash Sale 20% Off', text: 'Shop today and get 20% off!' },
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '202': {
                description: 'Bulk messages successfully validated and ingested into outbox',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/BulkSendMessageAcceptedResponse' },
                    examples: {
                      accepted: {
                        summary: 'Bulk Ingestion Accepted',
                        value: {
                          total: 2,
                          items: [
                            {
                              index: 0,
                              statusCode: 202,
                              body: {
                                messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3',
                                state: 'accepted',
                                acceptedAt: '2026-08-21T10:00:00.000Z',
                              },
                            },
                            {
                              index: 1,
                              statusCode: 202,
                              body: {
                                messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G4',
                                state: 'accepted',
                                acceptedAt: '2026-08-21T10:00:00.000Z',
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
              '400': {
                description: 'Validation Error in Bulk Payload',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: {
                      validation_error: StandardResponseExamples.bad_request_validation,
                    },
                  },
                },
              },
              '401': {
                description: 'Unauthorized',
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
        async ({ body, headers }: { body: unknown; headers: Record<string, string | undefined> }) => {
          const trace = TraceContext.extractOrCreate(headers);
          const traceHeader = TraceContext.formatHeader(trace);
          const auth = await verifyApiAuth(headers, env.CONVEY_REQUIRE_AUTH);

          const rawList = Array.isArray(body) ? { messages: body } : body;
          const parsed = BulkSendMessageRequestSchema.safeParse(rawList);
          if (!parsed.success) {
            const details = formatZodValidationDetails(parsed.error.issues);
            return jsonErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              'Invalid bulk message request',
              400,
              details,
              traceHeader,
            );
          }

          const results = await MessagingService.acceptBulkMessages(parsed.data.messages, auth.isSandbox);
          return jsonResponse({ total: results.length, items: results }, 202, traceHeader);
        },
      )
      .post(
        '/',
        {
          detail: {
            tags: ['Messages'],
            summary: 'Accept Single Multi-Channel Message (< 15ms Fast-Path)',
            description:
              'Accepts a single omnichannel notification request into the transactional outbox pipeline within sub-15ms latency with Redis 1-RTT idempotency caching.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            requestBody: {
              required: true,
              description: 'Omnichannel message dispatch request with channel content and recipient bindings',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SendMessageRequest' },
                  examples: MessageRequestExamples,
                },
              },
            },
            responses: {
              '202': {
                description: 'Message accepted into transactional outbox for asynchronous dispatch',
                headers: {
                  traceparent: {
                    description: 'W3C TraceContext propagation header',
                    schema: { type: 'string' },
                  },
                },
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/SendMessageAcceptedResponse' },
                    examples: {
                      immediate: StandardResponseExamples.accepted_immediate,
                      scheduled: StandardResponseExamples.accepted_scheduled,
                      sandbox: StandardResponseExamples.accepted_sandbox,
                    },
                  },
                },
              },
              '400': {
                description: 'Invalid Request Schema or Missing Required Channel Payload',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: {
                      validation_error: StandardResponseExamples.bad_request_validation,
                    },
                  },
                },
              },
              '401': {
                description: 'Missing or Invalid API Key / Bearer Authentication',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: {
                      unauthorized: StandardResponseExamples.unauthorized,
                    },
                  },
                },
              },
              '409': {
                description: 'Idempotency Key Conflict (Reused with Mismatched Payload Hash)',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: {
                      conflict: StandardResponseExamples.idempotency_conflict,
                    },
                  },
                },
              },
              '422': {
                description: 'Recipient is Suppressed (Hard Bounce / Unsubscribe / Spam Complaint)',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: {
                      suppressed: StandardResponseExamples.suppression_blocked,
                    },
                  },
                },
              },
              '429': {
                description: 'Tenant or Category Rate Limit Quota Exceeded',
                headers: {
                  'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string' } },
                },
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: {
                      rate_limited: StandardResponseExamples.rate_limited,
                    },
                  },
                },
              },
              '500': {
                description: 'Internal System or Outbox Transaction Error',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: {
                      server_error: StandardResponseExamples.server_error,
                    },
                  },
                },
              },
              '503': {
                description: 'Service Unavailable or Circuit Breakers Tripped (Load Shedding Active)',
                headers: {
                  'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'string' } },
                },
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: {
                      service_unavailable: StandardResponseExamples.service_unavailable,
                    },
                  },
                },
              },
            },
          },
        },
        async ({ body, headers }: { body: unknown; headers: Record<string, string | undefined> }) => {
          const trace = TraceContext.extractOrCreate(headers);
          const traceHeader = TraceContext.formatHeader(trace);
          const auth = await verifyApiAuth(headers, env.CONVEY_REQUIRE_AUTH);

          const parsed = SendMessageRequestSchema.safeParse(body);
          if (!parsed.success) {
            const details = formatZodValidationDetails(parsed.error.issues);
            return jsonErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid message request', 400, details, traceHeader);
          }

          try {
            const result = await MessagingService.acceptMessage(parsed.data, auth.isSandbox);
            return jsonResponse(result.body, result.statusCode, traceHeader);
          } catch (err: unknown) {
            if (err instanceof IdempotencyConflictError) {
              return jsonErrorResponse(ErrorCode.IDEMPOTENCY_CONFLICT, err.message, 409, undefined, traceHeader);
            }
            if (err instanceof SystemOverloadError) {
              const res = jsonErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, err.message, 503, undefined, traceHeader);
              res.headers.set('Retry-After', String(err.retryAfterSeconds));
              return res;
            }
            if (err instanceof DomainValidationError) {
              return jsonErrorResponse(ErrorCode.VALIDATION_ERROR, err.message, 400, undefined, traceHeader);
            }
            return jsonErrorResponse(
              ErrorCode.SERVER_ERROR,
              (err as Error).message || 'Internal dispatch failure',
              500,
              undefined,
              traceHeader,
            );
          }
        },
      )
      .get(
        '/:messageId',
        {
          detail: {
            tags: ['Messages'],
            summary: 'Get Real-Time Aggregate Message Status',
            description:
              'Queries message status, delivery timestamps, per-channel provider attempts, and optional event timeline.',
            security: StandardSecurityRequirement,
            parameters: [
              {
                name: 'messageId',
                in: 'path',
                required: true,
                description: 'Opaque public ULID message identifier (`msg_<ULID>`)',
                schema: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
              },
              {
                name: 'include',
                in: 'query',
                required: false,
                description: 'Comma-separated relationships to embed (e.g. `timeline`)',
                schema: { type: 'string', enum: ['timeline'], example: 'timeline' },
              },
            ],
            responses: {
              '200': {
                description: 'Message status query result',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/MessageStatusResponse' },
                    examples: {
                      delivered_status: {
                        summary: 'Delivered WhatsApp Status',
                        value: {
                          messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3',
                          state: 'delivered',
                          userId: 'usr_99182',
                          team: 'payments',
                          category: 'transactional',
                          country: 'AE',
                          createdAt: '2026-08-21T10:00:00.000Z',
                          completedAt: '2026-08-21T10:00:01.250Z',
                          channels: [
                            {
                              channel: 'whatsapp',
                              state: 'delivered',
                              provider: 'whatsapp-business',
                              attempts: 1,
                              deliveredAt: '2026-08-21T10:00:01.250Z',
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Message Not Found in Monthly Partition Window',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: { not_found: StandardResponseExamples.not_found },
                  },
                },
              },
            },
          },
        },
        async ({
          params: { messageId },
          query,
          headers,
        }: {
          params: { messageId: string };
          query: Record<string, string | undefined>;
          headers: Record<string, string | undefined>;
        }) => {
          const trace = TraceContext.extractOrCreate(headers);
          const traceHeader = TraceContext.formatHeader(trace);

          const includeTimeline = query?.include === 'timeline';
          const status = await MessagingService.getMessageStatus(messageId, includeTimeline);

          if (!status) {
            return jsonErrorResponse(
              ErrorCode.NOT_FOUND,
              `Message ${messageId} not found`,
              404,
              undefined,
              traceHeader,
            );
          }

          return jsonResponse(status, 200, traceHeader);
        },
      )
      .get(
        '/:messageId/timeline',
        {
          detail: {
            tags: ['Messages'],
            summary: 'Get Chronological Message Audit Timeline',
            description: 'Retrieves complete append-only lifecycle events (accepted, dispatched, delivered, read, bounced).',
            security: StandardSecurityRequirement,
            parameters: [
              {
                name: 'messageId',
                in: 'path',
                required: true,
                description: 'Opaque public ULID message identifier (`msg_<ULID>`)',
                schema: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
              },
            ],
            responses: {
              '200': {
                description: 'Chronological timeline events array',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        messageId: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
                        timeline: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              type: { type: 'string', example: 'message.accepted' },
                              providerId: { type: 'string', example: 'whatsapp-business' },
                              occurredAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:00.000Z' },
                            },
                          },
                        },
                      },
                      required: ['messageId', 'timeline'],
                    },
                    examples: {
                      timeline: {
                        summary: 'Standard Lifecycle Timeline',
                        value: {
                          messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3',
                          timeline: [
                            { type: 'message.accepted', occurredAt: '2026-08-21T10:00:00.000Z' },
                            { type: 'routing.resolved', providerId: 'whatsapp-business', occurredAt: '2026-08-21T10:00:00.045Z' },
                            { type: 'provider.dispatch', providerId: 'whatsapp-business', occurredAt: '2026-08-21T10:00:00.120Z' },
                            { type: 'delivery.delivered', providerId: 'whatsapp-business', occurredAt: '2026-08-21T10:00:00.890Z' },
                            { type: 'message.read', providerId: 'whatsapp-business', occurredAt: '2026-08-21T10:01:15.000Z' },
                          ],
                        },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Message Not Found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: { not_found: StandardResponseExamples.not_found },
                  },
                },
              },
            },
          },
        },
        async ({
          params: { messageId },
          headers,
        }: {
          params: { messageId: string };
          headers: Record<string, string | undefined>;
        }) => {
          const trace = TraceContext.extractOrCreate(headers);
          const traceHeader = TraceContext.formatHeader(trace);

          const status = await MessagingService.getMessageStatus(messageId, true);
          if (!status) {
            return jsonErrorResponse(
              ErrorCode.NOT_FOUND,
              `Message ${messageId} not found`,
              404,
              undefined,
              traceHeader,
            );
          }

          return jsonResponse({ messageId, timeline: status.timeline || [] }, 200, traceHeader);
        },
      )
      .get(
        '/:messageId/trace',
        {
          detail: {
            tags: ['Messages'],
            summary: 'Get W3C Delivery Trace APM Waterfall',
            description:
              'Retrieves distributed execution waterfall spans showing latency breakdown across HTTP ingestion, outbox persistence, worker queue latency, L1 policy checks, cost optimizer ranking, and provider wire calls.',
            security: StandardSecurityRequirement,
            parameters: [
              {
                name: 'messageId',
                in: 'path',
                required: true,
                description: 'Opaque public ULID message identifier (`msg_<ULID>`)',
                schema: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
              },
            ],
            responses: {
              '200': {
                description: 'Full-fidelity W3C trace waterfall and delivery hop summary',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/DeliveryTraceResponse' },
                    examples: {
                      trace_waterfall: {
                        summary: 'Trace Waterfall Summary',
                        value: {
                          messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3',
                          state: 'delivered',
                          team: 'payments',
                          category: 'transactional',
                          totalDurationMs: 245.8,
                          summary: {
                            ingestedAt: '2026-08-21T10:00:00.000Z',
                            completedAt: '2026-08-21T10:00:00.245Z',
                            deliveredAt: '2026-08-21T10:00:00.245Z',
                            chosenProvider: 'twilio',
                            costUsd: 0.0075,
                            attemptsCount: 1,
                          },
                          waterfall: [
                            { spanId: 'span_01', name: 'http.ingest', status: 'OK', startOffsetMs: 0, durationMs: 4.1 },
                            { spanId: 'span_02', name: 'outbox.persist', status: 'OK', startOffsetMs: 4.1, durationMs: 6.2 },
                            { spanId: 'span_03', name: 'queue.latency', status: 'OK', startOffsetMs: 10.3, durationMs: 18.5 },
                            { spanId: 'span_04', name: 'l1_policy.check', status: 'OK', startOffsetMs: 28.8, durationMs: 1.2 },
                            { spanId: 'span_05', name: 'cost_optimizer.rank', status: 'OK', startOffsetMs: 30.0, durationMs: 2.3 },
                            { spanId: 'span_06', name: 'provider.network_rtt', status: 'OK', startOffsetMs: 32.3, durationMs: 213.5 },
                          ],
                        },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Message Trace Not Found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                    examples: { not_found: StandardResponseExamples.not_found },
                  },
                },
              },
            },
          },
        },
        async ({
          params: { messageId },
          headers,
        }: {
          params: { messageId: string };
          headers: Record<string, string | undefined>;
        }) => {
          const trace = TraceContext.extractOrCreate(headers);
          const traceHeader = TraceContext.formatHeader(trace);

          const traceReport = await MessagingService.getMessageDeliveryTrace(messageId);
          if (!traceReport) {
            return jsonErrorResponse(
              ErrorCode.NOT_FOUND,
              `Message ${messageId} not found for trace evaluation`,
              404,
              undefined,
              traceHeader,
            );
          }

          return jsonResponse(traceReport, 200, traceHeader);
        },
      )
      .post(
        '/templates/preview',
        {
          detail: {
            tags: ['Messages'],
            summary: 'Preview Dynamic Template Rendering Engine',
            description: 'Executes server-side template compilation and rendering preview with mock variable dictionary.',
            security: StandardSecurityRequirement,
            requestBody: {
              required: true,
              description: 'Template specification and variable bindings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      template: {
                        type: 'object',
                        properties: {
                          subject: { type: 'string', example: 'Hello {{recipientName}}!' },
                          html: { type: 'string', example: '<h1>Welcome, {{recipientName}}!</h1><p>Your code is: {{code}}</p>' },
                          text: { type: 'string', example: 'Welcome {{recipientName}}! Your code is: {{code}}' },
                        },
                        required: ['html'],
                      },
                      variables: {
                        type: 'object',
                        example: { recipientName: 'Jane', code: '998811' },
                      },
                      recipient: {
                        $ref: '#/components/schemas/RecipientSchema',
                      },
                    },
                    required: ['template'],
                  },
                  examples: {
                    preview_example: {
                      summary: 'Template Preview Execution',
                      value: {
                        template: {
                          subject: 'Welcome to Convey, {{recipientName}}!',
                          html: '<h2>Hello {{recipientName}}</h2><p>Your activation code is <strong>{{code}}</strong>.</p>',
                          text: 'Hello {{recipientName}}, your activation code is {{code}}.',
                        },
                        variables: { recipientName: 'Ahmed', code: '772211' },
                        recipient: { email: 'ahmed@example.com' },
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Rendered template content with subject, HTML, and text',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        subject: { type: 'string', example: 'Welcome to Convey, Ahmed!' },
                        html: { type: 'string', example: '<h2>Hello Ahmed</h2><p>Your activation code is <strong>772211</strong>.</p>' },
                        text: { type: 'string', example: 'Hello Ahmed, your activation code is 772211.' },
                      },
                    },
                  },
                },
              },
              '400': {
                description: 'Invalid Template Payload',
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
        async ({ body, headers }: { body: unknown; headers: Record<string, string | undefined> }) => {
          const trace = TraceContext.extractOrCreate(headers);
          const traceHeader = TraceContext.formatHeader(trace);

          const parsed = TemplatePreviewRequestSchema.safeParse(body);
          if (!parsed.success) {
            return jsonErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              'Invalid template preview payload',
              400,
              formatZodValidationDetails(parsed.error.issues),
              traceHeader,
            );
          }

          const rendered = TemplateEngine.render(parsed.data.template, parsed.data.variables, parsed.data.recipient);
          return jsonResponse(rendered, 200, traceHeader);
        },
      ),
  );
}
