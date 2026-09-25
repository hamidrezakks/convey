import type { Elysia } from 'elysia';
import { z } from 'zod';
import { DlqDocs } from '../../openapi';
import { TraceContext } from '../../utils/trace-context';
import { guardApiRequest } from '../auth/auth.middleware';
import { DlqService } from './dlq.service';
import { DlqMutatedReplaySchema } from './messaging.types';

const DlqQuerySchema = z.object({
  team: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const DlqReplaySchema = z.object({
  messageIds: z.array(z.string()).min(1, 'messageIds array must contain at least 1 message ID'),
});

export function dlqController(app: Elysia) {
  return app.group('/v1/dlq', (app) =>
    app
      .beforeHandle(({ headers, request }) => guardApiRequest(headers, request.method))
      .get(
        '/',
        { detail: DlqDocs.listFailedMessages },
        async ({
          query,
          headers,
        }: {
          query: Record<string, string | undefined>;
          headers: Record<string, string | undefined>;
        }) => {
          const trace = TraceContext.extractOrCreate(headers);
          const traceHeader = TraceContext.formatHeader(trace);

          const parsed = DlqQuerySchema.safeParse(query);
          if (!parsed.success) {
            return new Response(
              JSON.stringify({
                error: { code: 'INVALID_REQUEST', message: 'Invalid query parameters', details: parsed.error.issues },
              }),
              { status: 400, headers: { 'Content-Type': 'application/json', traceparent: traceHeader } },
            );
          }

          const { team, limit, offset } = parsed.data;
          const result = await DlqService.listFailedMessages({ team, limit, offset });
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json', traceparent: traceHeader },
          });
        },
      )
      .post(
        '/replay',
        { detail: DlqDocs.replayFailedMessages },
        async ({ body, headers }: { body: unknown; headers: Record<string, string | undefined> }) => {
          const trace = TraceContext.extractOrCreate(headers);
          const traceHeader = TraceContext.formatHeader(trace);

          const parsed = DlqReplaySchema.safeParse(body);
          if (!parsed.success) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'INVALID_REQUEST',
                  message: 'messageIds array is required',
                  details: parsed.error.issues,
                },
              }),
              { status: 400, headers: { 'Content-Type': 'application/json', traceparent: traceHeader } },
            );
          }

          const result = await DlqService.replayFailedMessages(parsed.data.messageIds);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json', traceparent: traceHeader },
          });
        },
      )
      .post(
        '/replay-mutated',
        { detail: DlqDocs.replayMutatedMessages },
        async ({ body, headers }: { body: unknown; headers: Record<string, string | undefined> }) => {
          const trace = TraceContext.extractOrCreate(headers);
          const traceHeader = TraceContext.formatHeader(trace);

          const parsed = DlqMutatedReplaySchema.safeParse(body);
          if (!parsed.success) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'INVALID_REQUEST',
                  message: 'Invalid mutated replay payload',
                  details: parsed.error.issues,
                },
              }),
              { status: 400, headers: { 'Content-Type': 'application/json', traceparent: traceHeader } },
            );
          }

          const result = await DlqService.replayMutatedMessages(parsed.data);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json', traceparent: traceHeader },
          });
        },
      ),
  );
}
