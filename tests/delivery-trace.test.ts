import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { Channel, MessagePriority } from '../src/modules/messaging/messaging.types';
import { createFreshTestDb } from './helpers/fresh-db-runner';

describe('Delivery Trace APM Waterfall & Timeline API', () => {
  it('should accept message and compute end-to-end delivery trace waterfall', async () => {
    const freshDb = await createFreshTestDb();

    // 1. Accept message
    const sendRes = await app.handle(
      new Request('http://localhost/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `trace-test-${Date.now()}`,
          userId: 'user_trace_123',
          team: 'auth-team',
          category: 'AUTHENTICATION',
          country: 'US',
          priority: MessagePriority.CRITICAL,
          recipients: { email: 'trace-user@example.com' },
          channels: [{ channel: Channel.EMAIL, content: { subject: '2FA Code', text: 'Your code is 123456' } }],
        }),
      }),
    );

    expect(sendRes.status).toBe(202);
    const sendBody = (await sendRes.json()) as { messageId: string };
    const messageId = sendBody.messageId;

    // 2. Query delivery trace endpoint
    const traceRes = await app.handle(
      new Request(`http://localhost/v1/messages/${messageId}/trace`, {
        method: 'GET',
      }),
    );

    expect(traceRes.status).toBe(200);
    const trace = (await traceRes.json()) as {
      messageId: string;
      team: string;
      category: string;
      totalDurationMs: number;
      summary: { ingestedAt: string; chosenProvider: string };
      waterfall: Array<{ name: string }>;
    };

    expect(trace.messageId).toBe(messageId);
    expect(trace.team).toBe('auth-team');
    expect(trace.category).toBe('AUTHENTICATION');
    expect(trace.totalDurationMs).toBeGreaterThan(0);
    expect(trace.summary).toBeDefined();
    expect(trace.summary.ingestedAt).toBeDefined();
    expect(trace.summary.chosenProvider).toBeDefined();

    // Verify waterfall structure
    expect(Array.isArray(trace.waterfall)).toBe(true);
    expect(trace.waterfall.length).toBeGreaterThanOrEqual(3);

    const spanNames = trace.waterfall.map((s: { name: string }) => s.name);
    expect(spanNames.some((n: string) => n.includes('API Ingestion'))).toBe(true);
    expect(spanNames.some((n: string) => n.includes('Transactional Outbox'))).toBe(true);
    expect(spanNames.some((n: string) => n.includes('Policy & MAB Router'))).toBe(true);

    await freshDb.cleanup();
  });

  it('should return 404 for non-existent message trace', async () => {
    const res = await app.handle(
      new Request('http://localhost/v1/messages/msg_01J8F6K2B4E9R8V7W6X5Y4Z999/trace', {
        method: 'GET',
      }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
