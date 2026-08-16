import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { DlqService } from '../src/modules/messaging/dlq.service';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { Channel, MessagePriority, MessageState } from '../src/modules/messaging/messaging.types';

describe('Dead Letter Queue (DLQ) & Replay Engine', () => {
  let failedMessageId: string;

  beforeAll(async () => {
    // Create a message that is marked as FAILED
    const acceptRes = await MessagingService.acceptMessage({
      idempotencyKey: `dlq_key_${Date.now()}_${Math.random()}`,
      userId: 'usr_dlq_123',
      team: 'team_dlq_test',
      category: 'transactional',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { email: 'dlq_test@example.com' },
      channels: [{ channel: Channel.EMAIL, content: { subject: 'DLQ Test' } }],
    });

    failedMessageId = (acceptRes.body as Record<string, unknown>).messageId as string;

    // Simulate marking as FAILED in DB
    const { db } = await import('../src/db');
    const { messages } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.update(messages).set({ state: MessageState.FAILED }).where(eq(messages.publicId, failedMessageId));
  });

  it('lists failed messages via DlqService', async () => {
    const listRes = await DlqService.listFailedMessages({ team: 'team_dlq_test' });
    expect(listRes.total).toBeGreaterThanOrEqual(1);
    const item = listRes.items.find((i) => i.messageId === failedMessageId);
    expect(item).toBeDefined();
    expect(item?.team).toBe('team_dlq_test');
  });

  it('exposes GET /v1/dlq endpoint', async () => {
    const response = await app.handle(new Request('http://localhost/v1/dlq?team=team_dlq_test'));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { total: number; items: Array<{ messageId: string }> };
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.some((i) => i.messageId === failedMessageId)).toBe(true);
  });

  it('replays failed message via POST /v1/dlq/replay endpoint', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/dlq/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: [failedMessageId] }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { replayedCount: number; messageIds: string[] };
    expect(body.replayedCount).toBe(1);
    expect(body.messageIds).toContain(failedMessageId);
  });
});
