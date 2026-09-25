import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../db';
import { messageAttempts, messages, outbox } from '../../db/schema';
import { getUtcMonthBoundary } from '../../utils/date';
import { generateMessageId, parseMessageIdTimestamp } from '../../utils/id';
import type { TenantScope } from '../auth/tenant-scope';
import { type ChannelRequest, MessageState, OutboxState, OutboxType, type Recipients } from './messaging.types';

export interface DlqFilterParams {
  isSandbox?: boolean;
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
    if (params.isSandbox !== undefined) conditions.push(eq(messages.isSandbox, params.isSandbox));
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

    if (!failedMessages.length) {
      return {
        total: 0,
        items: [],
      };
    }

    const messageIds = failedMessages.map((msg) => msg.publicId);

    // Single batched query across all attempts in current page (eliminates N+1 query waterfall)
    const attempts = await db
      .select()
      .from(messageAttempts)
      .where(
        and(
          inArray(messageAttempts.messageId, messageIds),
          gte(messageAttempts.createdAt, startDate),
          lte(messageAttempts.createdAt, endDate),
        ),
      )
      .orderBy(desc(messageAttempts.createdAt));

    const attemptsByMessageId = new Map<string, typeof messageAttempts.$inferSelect>();
    for (const att of attempts) {
      if (!attemptsByMessageId.has(att.messageId)) {
        attemptsByMessageId.set(att.messageId, att);
      }
    }

    const items = failedMessages.map((msg) => {
      const lastAttempt = attemptsByMessageId.get(msg.publicId);
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
    });

    return {
      total: items.length,
      items,
    };
  },

  async replayFailedMessages(publicIds: string[], scope?: TenantScope): Promise<DlqReplayResult> {
    if (!publicIds.length) {
      return { replayedCount: 0, messageIds: [] };
    }

    const now = new Date();
    const replayedIds: string[] = [];

    // Group message IDs by monthly partition to prune scans and batch queries
    const partitionMap = new Map<string, { startDate: Date; endDate: Date; ids: string[] }>();
    for (const publicId of publicIds) {
      const createdDate = parseMessageIdTimestamp(publicId);
      const { startDate, endDate } = getUtcMonthBoundary(createdDate);
      const partKey = `${startDate.getTime()}_${endDate.getTime()}`;
      let group = partitionMap.get(partKey);
      if (!group) {
        group = { startDate, endDate, ids: [] };
        partitionMap.set(partKey, group);
      }
      group.ids.push(publicId);
    }

    for (const group of partitionMap.values()) {
      const msgList = await db
        .select()
        .from(messages)
        .where(
          and(
            inArray(messages.publicId, group.ids),
            eq(messages.state, MessageState.FAILED),
            ...(scope ? [eq(messages.team, scope.team), eq(messages.isSandbox, scope.isSandbox)] : []),
            gte(messages.createdAt, group.startDate),
            lte(messages.createdAt, group.endDate),
          ),
        );

      for (const msg of msgList) {
        const publicId = msg.publicId;
        const outboxId = generateMessageId();

        const replayed = await db.transaction(async (tx) => {
          const updated = await tx
            .update(messages)
            .set({
              state: MessageState.ACCEPTED,
              completedAt: null,
              updatedAt: now,
            })
            .where(
              and(
                eq(messages.publicId, publicId),
                eq(messages.state, MessageState.FAILED),
                gte(messages.createdAt, group.startDate),
                lte(messages.createdAt, group.endDate),
              ),
            )
            .returning({ id: messages.id });
          if (!updated.length) return false;

          const outboxRecord: typeof outbox.$inferInsert = {
            id: outboxId,
            messageId: publicId,
            type: OutboxType.MESSAGE_DISPATCH,
            payload: { publicId, internalId: msg.id, team: msg.team, priority: msg.priority },
            state: OutboxState.PENDING,
            availableAt: now,
            createdAt: now,
          };

          await tx.insert(outbox).values(outboxRecord);
          return true;
        });

        if (replayed) replayedIds.push(publicId);
      }
    }

    return {
      replayedCount: replayedIds.length,
      messageIds: replayedIds,
    };
  },

  async replayMutatedMessages(
    params: {
      messageIds: string[];
      mutations?: {
        recipients?: Partial<Recipients>;
        channels?: ChannelRequest[];
        metadata?: Record<string, unknown>;
      };
      isSandbox?: boolean;
      dryRun?: boolean;
    },
    scope?: TenantScope,
  ): Promise<{
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
          and(
            eq(messages.publicId, publicId),
            eq(messages.state, MessageState.FAILED),
            gte(messages.createdAt, startDate),
            lte(messages.createdAt, endDate),
            ...(scope ? [eq(messages.team, scope.team), eq(messages.isSandbox, scope.isSandbox)] : []),
          ),
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

      const replayed = await db.transaction(async (tx) => {
        const updated = await tx
          .update(messages)
          .set({
            recipients: mergedRecipients,
            channels: mergedChannels,
            metadata: mergedMetadata,
            isSandbox: scope?.isSandbox ?? params.isSandbox ?? msg.isSandbox,
            state: MessageState.ACCEPTED,
            completedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(messages.publicId, publicId),
              eq(messages.state, MessageState.FAILED),
              gte(messages.createdAt, startDate),
              lte(messages.createdAt, endDate),
              ...(scope ? [eq(messages.team, scope.team), eq(messages.isSandbox, scope.isSandbox)] : []),
            ),
          )
          .returning({ id: messages.id });
        if (!updated.length) return false;

        const outboxRecord: typeof outbox.$inferInsert = {
          id: outboxId,
          messageId: publicId,
          type: OutboxType.MESSAGE_DISPATCH,
          payload: { publicId, internalId: msg.id, team: msg.team, priority: msg.priority },
          state: OutboxState.PENDING,
          availableAt: now,
          createdAt: now,
        };

        await tx.insert(outbox).values(outboxRecord);
        return true;
      });

      if (replayed) replayedIds.push(publicId);
    }

    return {
      replayedCount: replayedIds.length,
      messageIds: replayedIds,
      ...(params.dryRun ? { dryRunResults } : {}),
    };
  },
};
