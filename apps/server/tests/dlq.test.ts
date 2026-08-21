import { beforeAll, describe, expect, it } from 'bun:test';
import { db } from '../src/db';
import { messages } from '../src/db/schema';
import { app } from '../src/index';
import { DlqService } from '../src/modules/messaging/dlq.service';
import { Channel, MessagePriority, MessageState } from '../src/modules/messaging/messaging.types';
import { generateMessageId } from '../src/utils/id';

describe('Dead Letter Queue (DLQ) & Replay Engine', () => {
  let failedMessageId: string;
  const testTeam = `team_dlq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    failedMessageId = generateMessageId();
    const now = new Date();

    // Insert directly as FAILED without an outbox row
    await db.insert(messages).values({
      id: failedMessageId,
      publicId: failedMessageId,
      team: testTeam,
      userId: 'usr_dlq_123',
      category: 'transactional',
      country: 'US',
      priority: MessagePriority.NORMAL,
      state: MessageState.FAILED,
      recipients: { email: 'dlq_test@example.com' },
      channels: [{ channel: Channel.EMAIL, content: { subject: 'DLQ Test' } }],
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });
  });

  it('lists failed messages via DlqService', async () => {
    const listRes = await DlqService.listFailedMessages({ team: testTeam });
    expect(listRes.total).toBeGreaterThanOrEqual(1);
    const item = listRes.items.find((i) => i.messageId === failedMessageId);
    expect(item).toBeDefined();
    expect(item?.team).toBe(testTeam);
  });

  it('exposes GET /v1/dlq endpoint', async () => {
    const response = await app.handle(new Request(`http://localhost/v1/dlq?team=${testTeam}`));
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
