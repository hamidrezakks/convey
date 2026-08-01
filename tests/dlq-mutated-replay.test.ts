import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { Channel, MessagePriority } from '../src/modules/messaging/messaging.types';
import { createFreshTestDb } from './helpers/fresh-db-runner';

describe('DLQ Mutated Replay & Sandbox Station API', () => {
  it('should support dry-run simulation of mutated DLQ replay', async () => {
    const freshDb = await createFreshTestDb();

    // 1. Create message
    const sendRes = await app.handle(
      new Request('http://localhost/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `dlq-mutate-${Date.now()}`,
          userId: 'user_dlq_001',
          team: 'payments-team',
          category: 'PAYMENTS',
          country: 'US',
          priority: MessagePriority.NORMAL,
          recipients: { email: 'bad-email@invalid-domain-xyz.com' },
          channels: [{ channel: Channel.EMAIL, content: { subject: 'Payment Failed', text: 'Retry card' } }],
        }),
      }),
    );

    const sendBody = (await sendRes.json()) as { messageId: string };
    const messageId = sendBody.messageId;

    // 2. Perform dry-run mutated replay
    const dryRunRes = await app.handle(
      new Request('http://localhost/v1/dlq/replay-mutated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageIds: [messageId],
          mutations: {
            recipients: { email: 'corrected.email@valid.com' },
          },
          isSandbox: true,
          dryRun: true,
        }),
      }),
    );

    expect(dryRunRes.status).toBe(200);
    const dryRunBody = (await dryRunRes.json()) as {
      replayedCount: number;
      dryRunResults: Array<{ status: string; simulatedProvider: string }>;
    };
    expect(dryRunBody.replayedCount).toBe(1);
    expect(dryRunBody.dryRunResults).toBeDefined();
    expect(dryRunBody.dryRunResults[0].status).toBe('SIMULATED_ACCEPTANCE');
    expect(dryRunBody.dryRunResults[0].simulatedProvider).toBe('sandbox');

    // 3. Perform live mutated replay
    const replayRes = await app.handle(
      new Request('http://localhost/v1/dlq/replay-mutated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageIds: [messageId],
          mutations: {
            recipients: { email: 'corrected.email@valid.com' },
          },
          isSandbox: false,
          dryRun: false,
        }),
      }),
    );

    expect(replayRes.status).toBe(200);
    const replayBody = (await replayRes.json()) as { replayedCount: number; messageIds: string[] };
    expect(replayBody.replayedCount).toBe(1);
    expect(replayBody.messageIds).toContain(messageId);

    await freshDb.cleanup();
  });
});
