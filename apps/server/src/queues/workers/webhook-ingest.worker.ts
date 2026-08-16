import { Worker } from 'bullmq';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import { messageAttempts, messageEvents, messages } from '../../db/schema';
import { CascadeManager } from '../../modules/messaging/cascade-manager';
import { computePartitionWindow } from '../../modules/messaging/messaging.service';
import {
  EventSource,
  IdentifierType,
  JobName,
  MessageState,
  MetricType,
  QueueName,
} from '../../modules/messaging/messaging.types';
import { ProviderRegistry } from '../../modules/providers/core/provider-registry';
import { WhatsAppSessionTracker } from '../../modules/providers/whatsapp/session-tracker';
import { ReportingService } from '../../modules/reports/reporting.service';
import { SuppressionsService } from '../../modules/suppressions/suppressions.service';
import { buildAttemptTimestampUpdates } from '../../utils/attempts';
import { generateMessageId } from '../../utils/id';
import { logger } from '../../utils/logger';
import { formatBullMQPrefix, formatRedisKey } from '../../utils/redis-keys';
import { redisClient, redisConnectionOptions } from '../connection';
import { callbackQueue, customerWebhookDispatchQueue } from '../queue-definitions';

export function mapStatusToMetric(status: string): MetricType | null {
  switch (status) {
    case MessageState.DELIVERED:
      return MetricType.DELIVERED;
    case MessageState.OPENED:
      return MetricType.OPENED;
    case MessageState.READ:
      return MetricType.READ;
    case MessageState.FAILED:
    case MessageState.BOUNCED:
      return MetricType.FAILED;
    default:
      return null;
  }
}

export function buildWebhookMessageEventRecord(
  attempt: typeof messageAttempts.$inferSelect,
  ev: { providerId?: string; normalizedStatus: string; rawPayload: unknown; timestamp: Date },
  now: Date,
) {
  return {
    id: generateMessageId(),
    messageId: attempt.messageId,
    attemptId: attempt.id,
    channel: attempt.channel,
    providerId: ev.providerId || attempt.providerId,
    type: `delivery.${ev.normalizedStatus}`,
    source: EventSource.WORKER,
    metadata: { raw: ev.rawPayload },
    occurredAt: ev.timestamp,
    createdAt: now,
  };
}

export async function recordWebhookMetric(
  msg: typeof messages.$inferSelect,
  channel: string,
  status: string,
  timestamp: Date,
): Promise<void> {
  const metricType = mapStatusToMetric(status);
  if (!metricType) return;

  try {
    await ReportingService.recordMetric({
      team: msg.team,
      category: msg.category,
      country: msg.country,
      channel,
      metric: metricType,
      timestamp,
    });
  } catch (err) {
    logger.error('WebhookIngest', `Metric recording warning: ${(err as Error).message}`, err as Error);
  }
}

export const TERMINAL_STATES = new Set<string>([
  MessageState.DELIVERED,
  MessageState.FAILED,
  MessageState.BOUNCED,
  MessageState.CANCELLED,
]);

export function resolveTargetMessageState(currentState: string, newStatus: string): string {
  if (TERMINAL_STATES.has(currentState) && !TERMINAL_STATES.has(newStatus)) {
    if (newStatus !== MessageState.OPENED && newStatus !== MessageState.READ) {
      return currentState;
    }
  }
  return newStatus;
}

export async function processWebhookEvent(params: {
  providerId: string;
  payload: unknown;
  headers: Record<string, string>;
  now: Date;
}): Promise<void> {
  const { providerId, payload, headers, now } = params;

  const mod = ProviderRegistry.getModule(providerId);
  if (!mod?.webhook) return;

  let ev: {
    providerId?: string;
    providerMessageId: string;
    normalizedStatus: string;
    timestamp: Date;
    rawPayload: unknown;
  } | null = null;

  if (mod.webhook.parseWebhookEvent) {
    ev = mod.webhook.parseWebhookEvent({ rawBody: payload, headers });
  } else if (mod.webhook.parsePayload) {
    const events = mod.webhook.parsePayload(payload, headers);
    ev = events[0] || null;
  }

  if (!ev) return;

  const rawPayloadObj = ev.rawPayload as Record<string, unknown> | undefined;
  if (rawPayloadObj?.isInboundUserMessage && typeof rawPayloadObj.senderPhone === 'string') {
    await WhatsAppSessionTracker.recordInboundMessage(ev.providerId || providerId, rawPayloadObj.senderPhone);
  }

  const effectiveProviderId = ev.providerId || providerId;
  let attempt: typeof messageAttempts.$inferSelect | undefined;

  // Fast-path: Check Redis reverse index first to avoid full partition scan
  const cachedAttempt = await redisClient.get(formatRedisKey(`provmsg:${effectiveProviderId}:${ev.providerMessageId}`));
  if (cachedAttempt) {
    const [cMsgId, _cAttemptId, _cCreatedIso] = cachedAttempt.split('|');
    const { startDate: cStartDate, endDate: cEndDate } = computePartitionWindow(cMsgId);
    const attempts = await db
      .select()
      .from(messageAttempts)
      .where(
        and(
          eq(messageAttempts.messageId, cMsgId),
          gte(messageAttempts.createdAt, cStartDate),
          lte(messageAttempts.createdAt, cEndDate),
        ),
      )
      .orderBy(desc(messageAttempts.createdAt))
      .limit(1);
    attempt = attempts[0];
  }

  if (!attempt) {
    const fallbackStart = new Date(now.getTime() - 60 * 86_400 * 1000);
    let attempts = await db
      .select()
      .from(messageAttempts)
      .where(
        and(
          eq(messageAttempts.providerMessageId, ev.providerMessageId),
          gte(messageAttempts.createdAt, fallbackStart),
          lte(messageAttempts.createdAt, now),
        ),
      )
      .orderBy(desc(messageAttempts.createdAt))
      .limit(1);

    if (!attempts.length && ev.providerMessageId) {
      const isPublicId = ev.providerMessageId.startsWith('msg_');
      const { startDate: pStart, endDate: pEnd } = isPublicId
        ? computePartitionWindow(ev.providerMessageId)
        : { startDate: fallbackStart, endDate: now };

      attempts = await db
        .select()
        .from(messageAttempts)
        .where(
          and(
            eq(messageAttempts.messageId, ev.providerMessageId),
            gte(messageAttempts.createdAt, pStart),
            lte(messageAttempts.createdAt, pEnd),
          ),
        )
        .orderBy(desc(messageAttempts.createdAt))
        .limit(1);
    }
    attempt = attempts[0];
  }

  if (!attempt) return;

  const { startDate, endDate } = computePartitionWindow(attempt.messageId);
  const partitionWhere = and(
    eq(messages.publicId, attempt.messageId),
    gte(messages.createdAt, startDate),
    lte(messages.createdAt, endDate),
  );

  const msgList = await db.select().from(messages).where(partitionWhere);
  const currentMsgState = msgList[0]?.state || MessageState.ACCEPTED;

  const targetState = resolveTargetMessageState(currentMsgState, ev.normalizedStatus);
  const isTerminalStatus = TERMINAL_STATES.has(targetState);

  const updatedMsg = await db.transaction(async (tx) => {
    await tx
      .update(messageAttempts)
      .set(buildAttemptTimestampUpdates(ev.normalizedStatus, ev.timestamp, now))
      .where(
        and(
          eq(messageAttempts.id, attempt.id),
          gte(messageAttempts.createdAt, startDate),
          lte(messageAttempts.createdAt, endDate),
        ),
      );

    const updatedMessages = await tx
      .update(messages)
      .set({
        state: targetState,
        ...(isTerminalStatus ? { completedAt: ev.timestamp } : {}),
        updatedAt: now,
      })
      .where(partitionWhere)
      .returning();

    await tx.insert(messageEvents).values(buildWebhookMessageEventRecord(attempt, ev, now));

    return updatedMessages[0];
  });

  if (updatedMsg) {
    await recordWebhookMetric(updatedMsg, attempt.channel, ev.normalizedStatus, ev.timestamp);
    if (
      ev.normalizedStatus === MessageState.DELIVERED ||
      ev.normalizedStatus === MessageState.OPENED ||
      ev.normalizedStatus === MessageState.READ
    ) {
      await CascadeManager.cancelRemainingSteps(attempt.messageId);
    }

    const inboundText = ((rawPayloadObj?.body || rawPayloadObj?.Body || rawPayloadObj?.text || '') as string).trim();
    const senderIdentifier = (
      (rawPayloadObj?.senderPhone || rawPayloadObj?.From || rawPayloadObj?.from || '') as string
    ).trim();

    if (inboundText && senderIdentifier) {
      const normalizedKeyword = inboundText
        .toUpperCase()
        .replace(/[!.,?;:]/g, '')
        .trim();
      const optOutKeywords = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END', 'OPTOUT', 'STOPALL']);
      const optInKeywords = new Set(['START', 'UNSTOP', 'YES']);

      if (optOutKeywords.has(normalizedKeyword)) {
        await SuppressionsService.addSuppression({
          team: updatedMsg.team,
          identifier: senderIdentifier,
          identifierType: senderIdentifier.includes('@') ? IdentifierType.EMAIL : IdentifierType.PHONE,
          reason: 'inbound_opt_out',
          channel: attempt.channel,
        });
        logger.info(
          'WebhookIngest',
          `Recipient '${senderIdentifier}' auto-suppressed via keyword '${normalizedKeyword}'`,
        );
      } else if (optInKeywords.has(normalizedKeyword)) {
        const existingSupp = await SuppressionsService.findSuppressionByIdentifier(updatedMsg.team, senderIdentifier);
        if (existingSupp) {
          await SuppressionsService.deleteSuppression(updatedMsg.team, existingSupp.id);
          logger.info(
            'WebhookIngest',
            `Recipient '${senderIdentifier}' un-suppressed via keyword '${normalizedKeyword}'`,
          );
        }
      }

      await customerWebhookDispatchQueue
        .add('dispatch-webhook', {
          team: updatedMsg.team,
          event: 'inbound.message_received',
          data: {
            from: senderIdentifier,
            body: inboundText,
            channel: attempt.channel,
            providerId,
            receivedAt: ev.timestamp.toISOString(),
          },
        })
        .catch(() => {});
    }
  }

  await callbackQueue.add('send-callback', {
    messageId: attempt.messageId,
    channel: attempt.channel,
    event: ev.normalizedStatus,
    timestamp: ev.timestamp.toISOString(),
  });
}

export const webhookIngestWorker = new Worker(
  QueueName.WEBHOOK_INGEST,
  async (job) => {
    const now = new Date();

    if (job.name === JobName.PROCESS_WEBHOOK) {
      const { providerId, payload, headers } = job.data as {
        providerId: string;
        payload: unknown;
        headers: Record<string, string>;
      };
      await processWebhookEvent({ providerId, payload, headers, now });
    }
  },
  {
    connection: redisConnectionOptions,
    prefix: formatBullMQPrefix(),
  },
);
