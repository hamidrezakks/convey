import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import { messageAttempts, messageEvents, messages, outbox } from '../../db/schema';
import { redisClient } from '../../queues/connection';
import { getUtcMonthBoundary } from '../../utils/date';
import { DlpScanner } from '../../utils/dlp-scanner';
import { heapMemoryGuard } from '../../utils/heap-guard';
import { generateMessageId, parseMessageIdTimestamp } from '../../utils/id';
import { payloadEncryptionManager } from '../../utils/payload-encryption';
import { shardRouter } from '../../utils/shard-router';
import { TraceContext } from '../../utils/trace-context';
import { trafficGovernor } from '../../utils/traffic-governor';
import { tenantSlaManager } from '../policies/tenant-sla';
import { RateCardRegistry, smartProviderRouter } from '../providers/core/smart-router';
import { IdempotencyService } from './idempotency.service';
import {
  AttemptState,
  Channel,
  type DeliveryTraceResponse,
  DomainValidationError,
  MessageState,
  OutboxState,
  OutboxType,
  ReservationStatus,
  type SendMessageRequest,
  SpanStatus,
  SystemOverloadError,
  TenantTier,
  type TraceSpan,
} from './messaging.types';
import { TemplateEngine } from './template-engine';

export function resolveRecipientId(recipients: SendMessageRequest['recipients'], userId?: string): string | undefined {
  if (userId) return userId;
  if (typeof recipients.email === 'string' && recipients.email) return recipients.email;
  if (typeof recipients.phone === 'string' && recipients.phone) return recipients.phone;
  if (typeof recipients.whatsapp === 'string' && recipients.whatsapp) return recipients.whatsapp;
  if (typeof recipients.telegramChatId === 'string' && recipients.telegramChatId) return recipients.telegramChatId;
  if (typeof recipients.slack?.channelId === 'string' && recipients.slack.channelId) return recipients.slack.channelId;
  if (Array.isArray(recipients.fcmTokens) && recipients.fcmTokens.length > 0) return recipients.fcmTokens[0];
  if (Array.isArray(recipients.apnsTokens) && recipients.apnsTokens.length > 0) return recipients.apnsTokens[0];
  return undefined;
}

export function validateChannelRecipients(
  channels: SendMessageRequest['channels'],
  recipients: SendMessageRequest['recipients'],
): string | null {
  for (const channelReq of channels) {
    const channel = channelReq.channel;
    if (channel === Channel.EMAIL && !recipients.email) {
      return 'Valid email address is required for email channel';
    }
    if (channel === Channel.SMS && !recipients.phone) {
      return 'Valid phone number is required for SMS channel';
    }
    if (channel === Channel.WHATSAPP && !recipients.whatsapp && !recipients.phone) {
      return 'Valid WhatsApp phone number is required for WhatsApp channel';
    }
    if (channel === Channel.FCM && (!recipients.fcmTokens || recipients.fcmTokens.length === 0)) {
      return 'At least one FCM token is required for FCM channel';
    }
    if (channel === Channel.APNS && (!recipients.apnsTokens || recipients.apnsTokens.length === 0)) {
      return 'At least one APNs token is required for APNs channel';
    }
    if (channel === Channel.TELEGRAM && !recipients.telegramChatId) {
      return 'Valid Telegram chat ID is required for Telegram channel';
    }
    if (channel === Channel.SLACK && !recipients.slack?.channelId) {
      return 'Valid Slack channel ID is required for Slack channel';
    }
  }
  return null;
}

import { QuietHoursEngine } from '../policies/quiet-hours';

export function buildMessageAndOutboxRecords(request: SendMessageRequest, now: Date, isSandbox = false) {
  const publicId = generateMessageId();
  const internalId = publicId.replace(/^msg_/, '');

  const quietCheck = QuietHoursEngine.evaluate({
    country: request.country,
    phone: request.recipients?.phone,
    priority: request.priority,
    now,
  });

  const isExplicitlyScheduled = !!request.scheduledAt && new Date(request.scheduledAt) > now;
  const effectiveScheduledAt = request.scheduledAt
    ? new Date(request.scheduledAt)
    : quietCheck.inQuietHours && quietCheck.nextAllowedSendTime
      ? quietCheck.nextAllowedSendTime
      : undefined;

  const initialMessageState = isExplicitlyScheduled ? MessageState.SCHEDULED : MessageState.ACCEPTED;
  const effectivePriority = tenantSlaManager.getRecommendedPriority(request.team, TenantTier.PRO, request.priority);
  const traceCtx = TraceContext.create();
  const recipientId = resolveRecipientId(request.recipients, request.userId);

  let effectiveChannels = request.channels;
  if (request.template) {
    const rendered = TemplateEngine.render(request.template, request.variables || {}, request.recipients);
    effectiveChannels = request.channels.map((chReq) => {
      const content = { ...(chReq.content as Record<string, unknown>) };
      if (chReq.channel === Channel.EMAIL) {
        if (!content.subject && rendered.subject) content.subject = rendered.subject;
        if (!content.html && rendered.html) content.html = rendered.html;
        if (!content.text && rendered.text) content.text = rendered.text;
      } else if (
        chReq.channel === Channel.SMS ||
        chReq.channel === Channel.WHATSAPP ||
        chReq.channel === Channel.TELEGRAM ||
        chReq.channel === Channel.SLACK
      ) {
        if (!content.text && (rendered.text || rendered.body)) {
          content.text = rendered.text || rendered.body;
        }
      }
      return { ...chReq, content } as typeof chReq;
    });
  }

  const messageRecord: typeof messages.$inferInsert = {
    id: internalId,
    publicId,
    userId: request.userId,
    team: request.team,
    category: request.category,
    country: request.country,
    campaignId: request.campaignId,
    state: initialMessageState,
    priority: effectivePriority,
    isSandbox,
    recipients: request.recipients as Record<string, unknown>,
    channels: effectiveChannels,
    fallback: request.fallback as Record<string, unknown> | undefined,
    metadata: {
      ...DlpScanner.sanitizeObject(request.metadata as Record<string, unknown> | undefined),
      ...(request.cascade ? { cascade: request.cascade } : {}),
      ...(quietCheck.inQuietHours ? { quietHoursDeferred: true, recipientTimezone: quietCheck.timezone } : {}),
      ...TraceContext.injectOutboxMetadata(traceCtx),
      _encryptedEnvelope: payloadEncryptionManager.encryptPayload(
        {
          recipients: request.recipients,
          channels: effectiveChannels,
          cascade: request.cascade,
        },
        recipientId,
      ),
    },
    scheduledAt: effectiveScheduledAt,
    expiresAt: request.expiresAt ? new Date(request.expiresAt) : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const shardIndex = shardRouter.getShardIndex(request.team, publicId);
  const queueName = shardRouter.getShardQueueName(request.team, publicId);

  const outboxRecord: typeof outbox.$inferInsert = {
    id: generateMessageId(),
    messageId: publicId,
    shardId: shardIndex,
    type: OutboxType.MESSAGE_DISPATCH,
    payload: {
      publicId,
      internalId,
      team: request.team,
      priority: request.priority,
      shardIndex,
      queueName,
      traceContext: traceCtx,
    },
    state: OutboxState.PENDING,
    availableAt: effectiveScheduledAt || now,
    createdAt: now,
  };

  const responsePayload = {
    messageId: publicId,
    state: initialMessageState,
    createdAt: now.toISOString(),
    ...(isExplicitlyScheduled ? { scheduledAt: effectiveScheduledAt?.toISOString() } : {}),
  };

  return { publicId, internalId, initialMessageState, messageRecord, outboxRecord, responsePayload };
}

export function computePartitionWindow(publicId: string) {
  const createdDate = parseMessageIdTimestamp(publicId);
  return getUtcMonthBoundary(createdDate);
}

export function buildAttemptLastError(latestAttempt?: typeof messageAttempts.$inferSelect) {
  if (!latestAttempt?.errorCode) return undefined;
  return {
    code: latestAttempt.errorCode,
    category: latestAttempt.errorCategory,
  };
}

export function buildChannelStateSummary(
  chReq: { channel: string },
  channelAttempts: ReadonlyArray<typeof messageAttempts.$inferSelect>,
  latestAttempt: typeof messageAttempts.$inferSelect | undefined,
  defaultState: string,
) {
  return {
    channel: chReq.channel,
    state: latestAttempt ? latestAttempt.state : defaultState,
    providerAttempts: channelAttempts.length,
    provider: latestAttempt ? latestAttempt.providerId : undefined,
    acceptedAt: latestAttempt?.providerAcceptedAt?.toISOString(),
    deliveredAt: latestAttempt?.deliveredAt?.toISOString(),
    openedAt: latestAttempt?.openedAt?.toISOString(),
    readAt: latestAttempt?.readAt?.toISOString(),
    lastError: buildAttemptLastError(latestAttempt),
  };
}

export function aggregateChannelStates(
  msgChannels: ReadonlyArray<{ channel: string }>,
  attempts: ReadonlyArray<typeof messageAttempts.$inferSelect>,
  defaultState: string,
) {
  return msgChannels.map((chReq) => {
    const channelAttempts = attempts.filter((a) => a.channel === chReq.channel);
    const sortedAttempts = [...channelAttempts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return buildChannelStateSummary(chReq, channelAttempts, sortedAttempts[0], defaultState);
  });
}

export function buildSingleTimelineEventItem(ev: typeof messageEvents.$inferSelect) {
  return {
    channel: ev.channel,
    event: ev.type,
    at: ev.occurredAt.toISOString(),
  };
}

export function buildTimelineEvents(events: ReadonlyArray<typeof messageEvents.$inferSelect>) {
  return [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()).map(buildSingleTimelineEventItem);
}

export function buildMessageStatusResponse(
  msg: typeof messages.$inferSelect,
  channelStates: ReturnType<typeof aggregateChannelStates>,
  timeline?: ReturnType<typeof buildTimelineEvents>,
) {
  return {
    messageId: msg.publicId,
    state: msg.state,
    userId: msg.userId,
    team: msg.team,
    category: msg.category,
    country: msg.country,
    createdAt: msg.createdAt.toISOString(),
    channels: channelStates,
    ...(timeline ? { timeline } : {}),
  };
}

export async function fetchMessageByPublicId(publicId: string, startDate: Date, endDate: Date) {
  const msgList = await db
    .select()
    .from(messages)
    .where(and(eq(messages.publicId, publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)));
  return msgList[0] ?? null;
}

export async function fetchMessageAttempts(publicId: string, startDate: Date, endDate: Date) {
  return await db
    .select()
    .from(messageAttempts)
    .where(
      and(
        eq(messageAttempts.messageId, publicId),
        gte(messageAttempts.createdAt, startDate),
        lte(messageAttempts.createdAt, endDate),
      ),
    );
}

export async function fetchMessageEvents(publicId: string, startDate: Date, endDate: Date) {
  return await db
    .select()
    .from(messageEvents)
    .where(
      and(
        eq(messageEvents.messageId, publicId),
        gte(messageEvents.occurredAt, startDate),
        lte(messageEvents.occurredAt, endDate),
      ),
    );
}

export async function buildBulkReservations(requests: SendMessageRequest[]) {
  const itemsToReserve = requests
    .map((req, index) => ({ index, req }))
    .filter(({ req }) => !!req.idempotencyKey)
    .map(({ index, req }) => ({
      index,
      team: req.team,
      idempotencyKey: req.idempotencyKey as string,
      requestPayload: req,
    }));

  const reservationMap = new Map<number, { result?: unknown; error?: Error }>();
  if (itemsToReserve.length > 0) {
    const reservations = await IdempotencyService.reserveBulk(
      itemsToReserve.map((item) => ({
        team: item.team,
        idempotencyKey: item.idempotencyKey,
        requestPayload: item.requestPayload,
      })),
    );
    for (let i = 0; i < itemsToReserve.length; i++) {
      const item = itemsToReserve[i];
      const res = reservations[i];
      if (res.error) {
        reservationMap.set(item.index, { error: res.error });
      } else if (res.result) {
        reservationMap.set(item.index, { result: res.result });
      }
    }
  }
  return reservationMap;
}

export async function commitBulkMessagesTransaction(
  messagesToInsert: Array<typeof messages.$inferInsert>,
  outboxToInsert: Array<typeof outbox.$inferInsert>,
  idempotencyToComplete: Array<{ team: string; idempotencyKey: string }>,
) {
  try {
    await db.transaction(async (tx) => {
      await tx.insert(messages).values(messagesToInsert);
      await tx.insert(outbox).values(outboxToInsert);
    });
  } catch (err) {
    if (idempotencyToComplete.length > 0) {
      await IdempotencyService.releaseBulk(
        idempotencyToComplete.map((item) => ({ team: item.team, idempotencyKey: item.idempotencyKey })),
      );
    }
    throw err;
  }
}

export function processSingleBulkMessageItem(
  req: SendMessageRequest,
  index: number,
  res: { result?: unknown; error?: Error } | undefined,
  now: Date,
  isSandbox = false,
) {
  if (res?.error) {
    return {
      type: 'error' as const,
      result: {
        index,
        statusCode: 400,
        body: { error: { code: 'BAD_REQUEST', message: res.error.message } },
      },
    };
  }

  if (res?.result) {
    const resObj = res.result as { status: ReservationStatus; responsePayload?: Record<string, unknown> };
    if (resObj.status === ReservationStatus.COMPLETED && resObj.responsePayload) {
      return {
        type: 'cached' as const,
        result: {
          index,
          statusCode: 202,
          body: resObj.responsePayload,
        },
      };
    }
  }

  const validationError = validateChannelRecipients(req.channels, req.recipients);
  if (validationError) {
    return {
      type: 'validation_error' as const,
      result: {
        index,
        statusCode: 400,
        body: { error: { code: 'BAD_REQUEST', message: validationError } },
      },
    };
  }

  const { publicId, messageRecord, outboxRecord, responsePayload } = buildMessageAndOutboxRecords(req, now, isSandbox);

  return {
    type: 'valid' as const,
    publicId,
    messageRecord,
    outboxRecord,
    responsePayload,
    result: {
      index,
      statusCode: 202,
      body: responsePayload,
    },
  };
}

export const MessagingService = {
  async acceptMessage(request: SendMessageRequest, isSandbox = false) {
    if (trafficGovernor.shouldShed(request.priority) || heapMemoryGuard.shouldThrottle()) {
      throw new SystemOverloadError(
        'System under extreme memory/event-loop saturation; request shed by TrafficGovernor/HeapGuard',
        5,
      );
    }

    const reservation = await IdempotencyService.reserve(request.team, request.idempotencyKey, request);

    if (reservation.status === ReservationStatus.COMPLETED && reservation.responsePayload) {
      return {
        statusCode: 202,
        body: reservation.responsePayload,
      };
    }

    const now = new Date();

    const validationError = validateChannelRecipients(request.channels, request.recipients);
    if (validationError) {
      await IdempotencyService.release(request.team, request.idempotencyKey);
      throw new DomainValidationError(validationError);
    }

    const { publicId, messageRecord, outboxRecord, responsePayload } = buildMessageAndOutboxRecords(
      request,
      now,
      isSandbox,
    );

    try {
      await db.transaction(async (tx) => {
        await tx.insert(messages).values(messageRecord);
        await tx.insert(outbox).values(outboxRecord);
      });
      // Non-blocking fast-path signal to wake outbox workers immediately (<2ms)
      redisClient.publish('convey:outbox:pending', String(outboxRecord.shardId ?? 0)).catch(() => {});
    } catch (err) {
      await IdempotencyService.release(request.team, request.idempotencyKey);
      throw err;
    }

    await IdempotencyService.complete(request.team, request.idempotencyKey, request, publicId, responsePayload);

    return {
      statusCode: 202,
      body: responsePayload,
    };
  },

  async acceptBulkMessages(requests: SendMessageRequest[], isSandbox = false) {
    if (!requests.length) return [];

    const now = new Date();
    const reservationMap = await buildBulkReservations(requests);

    const finalResults = new Array<{ index: number; statusCode: number; body: unknown }>(requests.length);
    const messagesToInsert: Array<typeof messages.$inferInsert> = [];
    const outboxToInsert: Array<typeof outbox.$inferInsert> = [];
    const idempotencyToComplete: Array<{
      team: string;
      idempotencyKey: string;
      requestPayload: unknown;
      messageId: string;
      responsePayload: Record<string, unknown>;
    }> = [];
    const idempotencyToRelease: Array<{ team: string; idempotencyKey: string }> = [];

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      const res = reservationMap.get(i);
      const itemOutcome = processSingleBulkMessageItem(req, i, res, now, isSandbox);

      finalResults[i] = itemOutcome.result;

      if (itemOutcome.type === 'validation_error' && req.idempotencyKey) {
        idempotencyToRelease.push({ team: req.team, idempotencyKey: req.idempotencyKey });
      } else if (itemOutcome.type === 'valid') {
        messagesToInsert.push(itemOutcome.messageRecord);
        outboxToInsert.push(itemOutcome.outboxRecord);

        if (req.idempotencyKey) {
          idempotencyToComplete.push({
            team: req.team,
            idempotencyKey: req.idempotencyKey,
            requestPayload: req,
            messageId: itemOutcome.publicId,
            responsePayload: itemOutcome.responsePayload,
          });
        }
      }
    }

    if (idempotencyToRelease.length > 0) {
      await IdempotencyService.releaseBulk(idempotencyToRelease);
    }

    if (messagesToInsert.length > 0) {
      await commitBulkMessagesTransaction(messagesToInsert, outboxToInsert, idempotencyToComplete);
      redisClient.publish('convey:outbox:pending', '0').catch(() => {});
    }

    if (idempotencyToComplete.length > 0) {
      await IdempotencyService.completeBulk(idempotencyToComplete);
    }

    return finalResults;
  },

  async getMessageStatus(publicId: string, includeTimeline = false) {
    const { startDate, endDate } = computePartitionWindow(publicId);

    const msg = await fetchMessageByPublicId(publicId, startDate, endDate);
    if (!msg) {
      return null;
    }

    const [attempts, events] = await Promise.all([
      fetchMessageAttempts(publicId, startDate, endDate),
      includeTimeline ? fetchMessageEvents(publicId, startDate, endDate) : Promise.resolve([]),
    ]);

    const channelStates = aggregateChannelStates(msg.channels as Array<{ channel: string }>, attempts, msg.state);
    const timeline = includeTimeline ? buildTimelineEvents(events) : undefined;

    return buildMessageStatusResponse(msg, channelStates, timeline);
  },

  async getMessageDeliveryTrace(publicId: string): Promise<DeliveryTraceResponse | null> {
    const { startDate, endDate } = computePartitionWindow(publicId);
    const msg = await fetchMessageByPublicId(publicId, startDate, endDate);
    if (!msg) {
      return null;
    }

    const [attempts, events] = await Promise.all([
      fetchMessageAttempts(publicId, startDate, endDate),
      fetchMessageEvents(publicId, startDate, endDate),
    ]);

    const createdAtMs = msg.createdAt.getTime();
    const sortedAttempts = [...attempts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const sortedEvents = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const waterfall: TraceSpan[] = [];

    // Span 1: Ingestion
    waterfall.push({
      spanId: `span_ingest_${publicId.slice(-6)}`,
      name: 'API Ingestion & Idempotency',
      status: SpanStatus.OK,
      startOffsetMs: 0.0,
      durationMs: 2.5,
      details: {
        team: msg.team,
        category: msg.category,
        priority: msg.priority,
        isSandbox: msg.isSandbox,
      },
    });

    // Span 2: Outbox Relay
    const firstAttemptTime = sortedAttempts[0]?.createdAt.getTime() || createdAtMs + 15;
    const outboxDuration = Math.max(1.0, Math.round((firstAttemptTime - createdAtMs) * 10) / 10);
    waterfall.push({
      spanId: `span_outbox_${publicId.slice(-6)}`,
      name: 'Transactional Outbox Commit & Relay',
      status: SpanStatus.OK,
      startOffsetMs: 2.5,
      durationMs: outboxDuration,
      details: {
        shardRouter: 'CONSISTENT_HASH',
        relaySignal: 'REDIS_FAST_PATH',
      },
    });

    // Span 3: Router Decision
    const primaryChannel = (msg.channels as Array<{ channel: Channel }>)?.[0]?.channel || Channel.EMAIL;
    const routerDecision = smartProviderRouter.getDecisionTrace(primaryChannel);
    waterfall.push({
      spanId: `span_router_${publicId.slice(-6)}`,
      name: 'Policy & MAB Router Evaluation',
      status: SpanStatus.OK,
      startOffsetMs: 2.5 + outboxDuration,
      durationMs: 1.2,
      details: {
        channel: primaryChannel,
        mabDecision: routerDecision,
      },
    });

    // Span 4+: Provider Attempts
    let currentOffset = 2.5 + outboxDuration + 1.2;
    let totalCostUsd = 0;
    for (const attempt of sortedAttempts) {
      const attemptDuration = attempt.deliveredAt
        ? Math.max(10, attempt.deliveredAt.getTime() - attempt.createdAt.getTime())
        : 85.0;
      const providerUnitCost = RateCardRegistry[attempt.providerId.toLowerCase()] ?? 0.001;
      totalCostUsd += providerUnitCost;

      const isAttemptSuccess =
        attempt.state === AttemptState.DELIVERED ||
        attempt.state === AttemptState.OPENED ||
        attempt.state === AttemptState.READ;

      waterfall.push({
        spanId: `span_attempt_${attempt.attemptNo}_${attempt.providerId}`,
        name: `Provider Attempt #${attempt.attemptNo} (${attempt.providerId})`,
        status: isAttemptSuccess ? SpanStatus.OK : SpanStatus.FAILED,
        startOffsetMs: Math.round(currentOffset * 10) / 10,
        durationMs: Math.round(attemptDuration * 10) / 10,
        details: {
          channel: attempt.channel,
          provider: attempt.providerId,
          state: attempt.state,
          errorCode: attempt.errorCode,
          errorMessage: attempt.errorMessage,
          errorCategory: attempt.errorCategory,
          costUsd: providerUnitCost,
        },
      });
      currentOffset += attemptDuration;
    }

    // Span 5+: Timeline Events
    for (const ev of sortedEvents) {
      const eventOffset = Math.max(0, ev.occurredAt.getTime() - createdAtMs);
      waterfall.push({
        spanId: `span_event_${ev.id.slice(-6)}`,
        name: `Event: ${ev.type} (${ev.channel || 'system'})`,
        status: SpanStatus.OK,
        startOffsetMs: Math.round(eventOffset * 10) / 10,
        durationMs: 1.0,
        details: {
          eventType: ev.type,
          source: ev.source,
          channel: ev.channel,
          metadata: ev.metadata as Record<string, unknown>,
        },
      });
    }

    const latestDelivered = sortedAttempts.find((a) => a.deliveredAt)?.deliveredAt;
    const completedAt =
      msg.completedAt?.toISOString() || sortedEvents[sortedEvents.length - 1]?.occurredAt.toISOString();
    const chosenProvider = sortedAttempts[sortedAttempts.length - 1]?.providerId || routerDecision.selected;
    const totalDurationMs =
      Math.round(
        Math.max(currentOffset, latestDelivered ? latestDelivered.getTime() - createdAtMs : currentOffset) * 10,
      ) / 10;

    return {
      messageId: msg.publicId,
      state: msg.state as MessageState,
      team: msg.team,
      category: msg.category,
      totalDurationMs,
      summary: {
        ingestedAt: msg.createdAt.toISOString(),
        completedAt,
        deliveredAt: latestDelivered?.toISOString(),
        chosenProvider,
        costUsd: totalCostUsd > 0 ? totalCostUsd : routerDecision.costUsd,
        attemptsCount: sortedAttempts.length,
      },
      waterfall,
    };
  },
};
