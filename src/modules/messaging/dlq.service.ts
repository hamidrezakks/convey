import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import { messageAttempts, messages, outbox } from '../../db/schema';
import { dispatchQueue } from '../../queues/queue-definitions';
import { getUtcMonthBoundary } from '../../utils/date';
import { generateMessageId, parseMessageIdTimestamp } from '../../utils/id';
import {
  type ChannelRequest,
  JobName,
  MessagePriority,
  MessageState,
  OutboxState,
  OutboxType,
  type Recipients,
} from './messaging.types';

export interface DlqFilterParams {
  team?: string;
  channel?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface DlqReplayResult {
  replayedCount: number;
  messageIds: string[];
}

export const DlqService = {
  async listFailedMessages(params: DlqFilterParams = {}) {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const now = new Date();

    // Default to a 60-day rolling window for partition pruning if dates are omitted
    const startDate = params.startDate ?? new Date(now.getTime() - 60 * 86_400 * 1000);
    const endDate = params.endDate ?? now;

    const conditions = [
      eq(messages.state, MessageState.FAILED),
      gte(messages.createdAt, startDate),
      lte(messages.createdAt, endDate),
    ];
    if (params.team) {
      conditions.push(eq(messages.team, params.team));
    }

    const failedMessages = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    const items = await Promise.all(
      failedMessages.map(async (msg) => {
        const createdDate = parseMessageIdTimestamp(msg.publicId);
        const { startDate, endDate } = getUtcMonthBoundary(createdDate);

        const attempts = await db
          .select()
          .from(messageAttempts)
          .where(
            and(
              eq(messageAttempts.messageId, msg.publicId),
              gte(messageAttempts.createdAt, startDate),
              lte(messageAttempts.createdAt, endDate),
            ),
          )
          .orderBy(desc(messageAttempts.createdAt))
          .limit(1);

        const lastAttempt = attempts[0];
        return {
          messageId: msg.publicId,
          team: msg.team,
          userId: msg.userId,
          category: msg.category,
          country: msg.country,
          priority: msg.priority,
          failedAt: msg.completedAt?.toISOString() || msg.updatedAt.toISOString(),
          lastError: lastAttempt
            ? {
                code: lastAttempt.errorCode,
                category: lastAttempt.errorCategory,
                message: lastAttempt.errorMessage,
                providerId: lastAttempt.providerId,
                attemptNo: lastAttempt.attemptNo,
              }
            : undefined,
        };
      }),
    );

    return {
      total: items.length,
      items,
    };
  },

  async replayFailedMessages(publicIds: string[]): Promise<DlqReplayResult> {
    if (!publicIds.length) {
      return { replayedCount: 0, messageIds: [] };
    }

    const now = new Date();
    const replayedIds: string[] = [];

    for (const publicId of publicIds) {
      const createdDate = parseMessageIdTimestamp(publicId);
      const { startDate, endDate } = getUtcMonthBoundary(createdDate);

      const msgList = await db
        .select()
        .from(messages)
        .where(
          and(eq(messages.publicId, publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
        );

      if (!msgList.length) continue;
      const msg = msgList[0];

      const outboxId = generateMessageId();

      await db.transaction(async (tx) => {
        await tx
          .update(messages)
          .set({
            state: MessageState.ACCEPTED,
            completedAt: null,
            updatedAt: now,
          })
          .where(
            and(eq(messages.publicId, publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
          );

        const outboxRecord: typeof outbox.$inferInsert = {
          id: outboxId,
          messageId: publicId,
          type: OutboxType.MESSAGE_DISPATCH,
          payload: { publicId, internalId: msg.id, team: msg.team, priority: msg.priority },
          state: OutboxState.PROCESSED, // Committed directly to BullMQ
          processedAt: now,
          availableAt: now,
          createdAt: now,
        };

        await tx.insert(outbox).values(outboxRecord);
      });

      await dispatchQueue.add(
        JobName.MESSAGE_DISPATCH,
        { publicId, outboxId },
        {
          priority: msg.priority === MessagePriority.CRITICAL ? 1 : 3,
          jobId: `outbox_${outboxId}`, // Enforces idempotent deduplication in Redis BullMQ
        },
      );

      replayedIds.push(publicId);
    }

    return {
      replayedCount: replayedIds.length,
      messageIds: replayedIds,
    };
  },

  async replayMutatedMessages(params: {
    messageIds: string[];
    mutations?: {
      recipients?: Partial<Recipients>;
      channels?: ChannelRequest[];
      metadata?: Record<string, unknown>;
    };
    isSandbox?: boolean;
    dryRun?: boolean;
  }): Promise<{
    replayedCount: number;
    messageIds: string[];
    dryRunResults?: Array<{
      messageId: string;
      status: string;
      simulatedProvider: string;
      mutatedChannels: ChannelRequest[];
    }>;
  }> {
    if (!params.messageIds.length) {
      return { replayedCount: 0, messageIds: [] };
    }

    const now = new Date();
    const replayedIds: string[] = [];
    const dryRunResults: Array<{
      messageId: string;
      status: string;
      simulatedProvider: string;
      mutatedChannels: ChannelRequest[];
    }> = [];

    for (const publicId of params.messageIds) {
      const createdDate = parseMessageIdTimestamp(publicId);
      const { startDate, endDate } = getUtcMonthBoundary(createdDate);

      const msgList = await db
        .select()
        .from(messages)
        .where(
          and(eq(messages.publicId, publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
        );

      if (!msgList.length) continue;
      const msg = msgList[0];

      const mergedRecipients = {
        ...(msg.recipients as Record<string, unknown>),
        ...(params.mutations?.recipients || {}),
      };

      const mergedChannels = params.mutations?.channels || (msg.channels as ChannelRequest[]);
      const mergedMetadata = {
        ...(msg.metadata as Record<string, unknown>),
        ...(params.mutations?.metadata || {}),
        replayedAt: now.toISOString(),
      };

      const simulatedProvider = params.isSandbox ? 'sandbox' : 'ses';

      if (params.dryRun) {
        dryRunResults.push({
          messageId: publicId,
          status: 'SIMULATED_ACCEPTANCE',
          simulatedProvider,
          mutatedChannels: mergedChannels,
        });
        replayedIds.push(publicId);
        continue;
      }

      const outboxId = generateMessageId();

      await db.transaction(async (tx) => {
        await tx
          .update(messages)
          .set({
            recipients: mergedRecipients,
            channels: mergedChannels,
            metadata: mergedMetadata,
            isSandbox: params.isSandbox ?? msg.isSandbox,
            state: MessageState.ACCEPTED,
            completedAt: null,
            updatedAt: now,
          })
          .where(
            and(eq(messages.publicId, publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
          );

        const outboxRecord: typeof outbox.$inferInsert = {
          id: outboxId,
          messageId: publicId,
          type: OutboxType.MESSAGE_DISPATCH,
          payload: { publicId, internalId: msg.id, team: msg.team, priority: msg.priority },
          state: OutboxState.PROCESSED,
          processedAt: now,
          availableAt: now,
          createdAt: now,
        };

        await tx.insert(outbox).values(outboxRecord);
      });

      await dispatchQueue.add(
        JobName.MESSAGE_DISPATCH,
        { publicId, outboxId },
        {
          priority: msg.priority === MessagePriority.CRITICAL ? 1 : 3,
          jobId: `outbox_mutated_${outboxId}`,
        },
      );

      replayedIds.push(publicId);
    }

    return {
      replayedCount: replayedIds.length,
      messageIds: replayedIds,
      ...(params.dryRun ? { dryRunResults } : {}),
    };
  },
};
