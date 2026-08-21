import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db';
import { messages, outbox } from '../../db/schema';
import { MessageState, OutboxState, OutboxType } from '../../modules/messaging/messaging.types';
import { generateMessageId } from '../../utils/id';
import { createTaskLoop } from '../../utils/task-loop';

export function buildPromotedOutboxRecord(msg: typeof messages.$inferSelect, now: Date) {
  return {
    id: generateMessageId(),
    messageId: msg.publicId,
    type: OutboxType.MESSAGE_DISPATCH,
    payload: { publicId: msg.publicId, priority: msg.priority },
    state: OutboxState.PENDING,
    availableAt: msg.scheduledAt || now,
    createdAt: now,
  };
}

export async function promoteScheduledMessages(batchSize = 500): Promise<number> {
  const now = new Date();
  const horizonDate = new Date(now.getTime() + env.BULLMQ_SCHEDULING_HORIZON_SECONDS * 1000);
  const horizonPastDate = new Date(now.getTime() - 180 * 86_400 * 1000);

  return await db.transaction(async (tx) => {
    const scheduledMsgs = await tx
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.state, MessageState.SCHEDULED),
          gte(messages.createdAt, horizonPastDate),
          lte(messages.scheduledAt, horizonDate),
        ),
      )
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (!scheduledMsgs.length) {
      return 0;
    }

    const publicIds = scheduledMsgs.map((msg) => msg.publicId);
    await tx
      .update(messages)
      .set({ state: MessageState.ACCEPTED, updatedAt: now })
      .where(and(inArray(messages.publicId, publicIds), gte(messages.createdAt, horizonPastDate)));

    const outboxRecords = scheduledMsgs.map((msg) => buildPromotedOutboxRecord(msg, now));

    await tx.insert(outbox).values(outboxRecords);

    return scheduledMsgs.length;
  });
}

const scheduledPromoterTaskLoop = createTaskLoop(promoteScheduledMessages, 500, 'scheduled promoter loop');

export function startScheduledPromoterLoop(intervalMs = 5000) {
  scheduledPromoterTaskLoop.start(intervalMs);
}

export function stopScheduledPromoterLoop() {
  scheduledPromoterTaskLoop.stop();
}
