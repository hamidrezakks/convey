import { Worker } from 'bullmq';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import { messageAttempts, messageEvents, messages } from '../../db/schema';

import { CascadeManager } from '../../modules/messaging/cascade-manager';
import { computePartitionWindow } from '../../modules/messaging/messaging.service';
import {
  Channel,
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

// ============================================================================
// Constants & Configuration
// ============================================================================

const OPT_OUT_KEYWORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END', 'OPTOUT', 'STOPALL']);
const OPT_IN_KEYWORDS = new Set(['START', 'UNSTOP', 'YES']);

export const TERMINAL_STATES = new Set<string>([
  MessageState.DELIVERED,
  MessageState.FAILED,
  MessageState.BOUNCED,
  MessageState.CANCELLED,
]);

// ============================================================================
// Domain Types & Interfaces
// ============================================================================

export interface IngestedWebhookEvent {
  providerId?: string;
  providerMessageId: string;
  normalizedStatus: string;
  timestamp: Date;
  rawPayload: unknown;
}

export interface InboundMessageData {
  senderPhone: string;
  inboundText: string;
  team: string;
}

export interface ProcessWebhookParams {
  providerId: string;
  payload: unknown;
  headers: Record<string, string>;
  now: Date;
}

// ============================================================================
// Pure Transformation & Extraction Helpers
// ============================================================================

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

export function resolveTargetMessageState(currentState: string, newStatus: string): string {
  if (TERMINAL_STATES.has(currentState) && !TERMINAL_STATES.has(newStatus)) {
    if (newStatus !== MessageState.OPENED && newStatus !== MessageState.READ) {
      return currentState;
    }
  }
  return newStatus;
}

export function extractWebhookEvents(
  webhookModule: NonNullable<ReturnType<typeof ProviderRegistry.getModule>>['webhook'],
  payload: unknown,
  headers: Record<string, string>,
): IngestedWebhookEvent[] {
  if (!webhookModule) return [];

  if (webhookModule.parseWebhookEvent) {
    const single = webhookModule.parseWebhookEvent({ rawBody: payload, headers });
    return single ? [single] : [];
  }

  if (webhookModule.parsePayload) {
    return webhookModule.parsePayload(payload, headers) || [];
  }

  return [];
}

export function parseInboundMessageData(rawPayloadObj?: Record<string, unknown>): InboundMessageData | null {
  if (!rawPayloadObj) return null;

  const rawPhone = (rawPayloadObj.senderPhone || rawPayloadObj.From || rawPayloadObj.from || '') as string;
  const senderPhone = rawPhone.replace(/^whatsapp:/i, '').trim();

  if (!senderPhone) return null;

  const rawText = (rawPayloadObj.body || rawPayloadObj.Body || rawPayloadObj.text || '') as string;
  const inboundText = rawText.trim();
  const team = (rawPayloadObj.team as string) || 'default';

  return { senderPhone, inboundText, team };
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

// ============================================================================
// Inbound User Flow: WhatsApp 24h Window & Compliance Suppressions
// ============================================================================

export async function handleComplianceKeywords(team: string, senderPhone: string, inboundText: string): Promise<void> {
  if (!inboundText) return;

  const normalizedKeyword = inboundText
    .toUpperCase()
    .replace(/[!.,?;:]/g, '')
    .trim();

  if (OPT_OUT_KEYWORDS.has(normalizedKeyword)) {
    await SuppressionsService.addSuppression({
      team,
      identifier: senderPhone,
      identifierType: senderPhone.includes('@') ? IdentifierType.EMAIL : IdentifierType.PHONE,
      reason: 'inbound_opt_out',
      channel: 'ALL',
    }).catch((err) => logger.warn('WebhookIngest', `Suppression add warning: ${(err as Error).message}`));

    logger.info('WebhookIngest', `Recipient '${senderPhone}' auto-suppressed via keyword '${normalizedKeyword}'`);
  } else if (OPT_IN_KEYWORDS.has(normalizedKeyword)) {
    const existingSupp = await SuppressionsService.findSuppressionByIdentifier(team, senderPhone);
    if (existingSupp) {
      await SuppressionsService.deleteSuppression(team, existingSupp.id).catch((err) =>
        logger.warn('WebhookIngest', `Suppression delete warning: ${(err as Error).message}`),
      );
      logger.info('WebhookIngest', `Recipient '${senderPhone}' un-suppressed via keyword '${normalizedKeyword}'`);
    }
  }
}

export async function handleInboundMessage(params: {
  effectiveProviderId: string;
  ev: IngestedWebhookEvent;
  inboundData: InboundMessageData;
  now: Date;
}): Promise<void> {
  const { effectiveProviderId, ev, inboundData, now } = params;
  const { senderPhone, inboundText, team } = inboundData;

  // 1. Record inbound message to activate/refresh WhatsApp 24h cost optimization window
  await WhatsAppSessionTracker.recordInboundMessage(effectiveProviderId, senderPhone);

  // 2. Handle compliance opt-in/opt-out keywords
  await handleComplianceKeywords(team, senderPhone, inboundText);

  // 3. Record inbound audit event in messageEvents table
  await db
    .insert(messageEvents)
    .values({
      id: generateMessageId(),
      messageId: ev.providerMessageId.startsWith('msg_') ? ev.providerMessageId : `inbound_${Date.now()}`,
      channel: Channel.CHAT,
      providerId: effectiveProviderId,
      type: 'inbound.message',
      source: EventSource.WEBHOOK,
      metadata: { raw: ev.rawPayload, sender: senderPhone, text: inboundText },
      occurredAt: ev.timestamp,
      createdAt: now,
    })
    .catch((err) => logger.warn('WebhookIngest', `Inbound event insert warning: ${(err as Error).message}`));

  // 4. Dispatch inbound message event to customer webhook subscribers
  await customerWebhookDispatchQueue
    .add('dispatch-webhook', {
      team,
      event: 'inbound.message_received',
      data: {
        from: senderPhone,
        body: inboundText,
        channel: Channel.CHAT,
        providerId: effectiveProviderId,
        receivedAt: ev.timestamp.toISOString(),
      },
    })
    .catch(() => {});
}

// ============================================================================
// Status Update Flow: Attempt Correlation & State Transitions
// ============================================================================

export async function findCorrelatedAttempt(
  effectiveProviderId: string,
  providerMessageId: string,
  now: Date,
): Promise<typeof messageAttempts.$inferSelect | undefined> {
  if (!providerMessageId) return undefined;

  // Fast-path: Check Redis reverse index first to avoid full partition scan
  const cachedAttempt = await redisClient.get(formatRedisKey(`provmsg:${effectiveProviderId}:${providerMessageId}`));
  if (cachedAttempt) {
    const [cMsgId, cAttemptId] = cachedAttempt.split('|');
    const { startDate: cStartDate, endDate: cEndDate } = computePartitionWindow(cMsgId);

    const attempts = await db
      .select()
      .from(messageAttempts)
      .where(
        and(
          cAttemptId ? eq(messageAttempts.id, cAttemptId) : eq(messageAttempts.messageId, cMsgId),
          gte(messageAttempts.createdAt, cStartDate),
          lte(messageAttempts.createdAt, cEndDate),
        ),
      )
      .orderBy(desc(messageAttempts.createdAt))
      .limit(1);

    if (attempts[0]) return attempts[0];
  }

  // Fallback path: Query database within recent partition window
  const fallbackStart = new Date(now.getTime() - 60 * 86_400 * 1000);
  let attempts = await db
    .select()
    .from(messageAttempts)
    .where(
      and(
        eq(messageAttempts.providerMessageId, providerMessageId),
        gte(messageAttempts.createdAt, fallbackStart),
        lte(messageAttempts.createdAt, now),
      ),
    )
    .orderBy(desc(messageAttempts.createdAt))
    .limit(1);

  if (attempts.length > 0) return attempts[0];

  // Secondary fallback: Check if providerMessageId is the internal public message ID
  const isPublicId = providerMessageId.startsWith('msg_');
  const { startDate: pStart, endDate: pEnd } = isPublicId
    ? computePartitionWindow(providerMessageId)
    : { startDate: fallbackStart, endDate: now };

  attempts = await db
    .select()
    .from(messageAttempts)
    .where(
      and(
        eq(messageAttempts.messageId, providerMessageId),
        gte(messageAttempts.createdAt, pStart),
        lte(messageAttempts.createdAt, pEnd),
      ),
    )
    .orderBy(desc(messageAttempts.createdAt))
    .limit(1);

  return attempts[0];
}

export async function handleStatusUpdate(
  attempt: typeof messageAttempts.$inferSelect,
  ev: IngestedWebhookEvent,
  now: Date,
): Promise<void> {
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

    const rawPayloadObj =
      typeof ev.rawPayload === 'object' && ev.rawPayload !== null
        ? (ev.rawPayload as Record<string, unknown>)
        : undefined;

    const inboundText = ((rawPayloadObj?.body || rawPayloadObj?.Body || rawPayloadObj?.text || '') as string).trim();
    const senderIdentifier = (
      (rawPayloadObj?.senderPhone || rawPayloadObj?.From || rawPayloadObj?.from || '') as string
    ).trim();

    if (inboundText && senderIdentifier) {
      await handleComplianceKeywords(updatedMsg.team, senderIdentifier, inboundText);
      await customerWebhookDispatchQueue
        .add('dispatch-webhook', {
          team: updatedMsg.team,
          event: 'inbound.message_received',
          data: {
            from: senderIdentifier,
            body: inboundText,
            channel: attempt.channel,
            providerId: attempt.providerId,
            receivedAt: ev.timestamp.toISOString(),
          },
        })
        .catch(() => {});
    }
  }

  await callbackQueue
    .add('send-callback', {
      messageId: attempt.messageId,
      channel: attempt.channel,
      event: ev.normalizedStatus,
      timestamp: ev.timestamp.toISOString(),
    })
    .catch(() => {});
}

// ============================================================================
// Core Event Orchestrators & Worker Lifecycle
// ============================================================================

export async function processSingleWebhookEvent(
  ev: IngestedWebhookEvent,
  defaultProviderId: string,
  now: Date,
): Promise<void> {
  const effectiveProviderId = ev.providerId || defaultProviderId;
  const rawPayloadObj =
    typeof ev.rawPayload === 'object' && ev.rawPayload !== null
      ? (ev.rawPayload as Record<string, unknown>)
      : undefined;

  try {
    // 1. INBOUND CUSTOMER MESSAGE FLOW (powers WhatsApp 24-hour cost optimization window)
    if (rawPayloadObj?.isInboundUserMessage) {
      const inboundData = parseInboundMessageData(rawPayloadObj);
      if (inboundData) {
        await handleInboundMessage({
          effectiveProviderId,
          ev,
          inboundData,
          now,
        });
      }
      return;
    }

    // 2. STATUS UPDATE / DELIVERY RECEIPT FLOW
    const attempt = await findCorrelatedAttempt(effectiveProviderId, ev.providerMessageId, now);
    if (attempt) {
      await handleStatusUpdate(attempt, ev, now);
    }
  } catch (err) {
    logger.error(
      'WebhookIngest',
      `Error processing webhook event for provider '${effectiveProviderId}', msgId '${ev.providerMessageId}': ${(err as Error).message}`,
      err as Error,
    );
  }
}

export async function processWebhookEvent(params: ProcessWebhookParams): Promise<void> {
  const { providerId, payload, headers, now } = params;

  const mod = ProviderRegistry.getModule(providerId);
  if (!mod?.webhook) return;

  const events = extractWebhookEvents(mod.webhook, payload, headers);
  if (!events.length) return;

  // Process all events in the batch with Promise.allSettled for fault isolation
  await Promise.allSettled(events.map((ev) => processSingleWebhookEvent(ev, providerId, now)));
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
