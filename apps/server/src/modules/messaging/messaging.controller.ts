import type { Elysia } from 'elysia';
import type { z } from 'zod';
import { env } from '../../config/env';
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
      .post('/bulk', async ({ body, headers }: { body: unknown; headers: Record<string, string | undefined> }) => {
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
      })
      .post('/', async ({ body, headers }: { body: unknown; headers: Record<string, string | undefined> }) => {
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
      })
      .get(
        '/:messageId',
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
