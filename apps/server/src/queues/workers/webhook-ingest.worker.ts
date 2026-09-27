import { createHash } from 'node:crypto';
import { Worker } from 'bullmq';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { messageAttempts, messageEvents, messages, outbox, providers } from '../../db/schema';
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
import { ReportingService, recordReceiptMetric } from '../../modules/reports/reporting.service';
import { SuppressionsService } from '../../modules/suppressions/suppressions.service';
import { WebhookSubscriptionsService } from '../../modules/webhooks/webhook-subscriptions.service';
import { buildAttemptTimestampUpdates } from '../../utils/attempts';
import { generateMessageId } from '../../utils/id';
import { logger } from '../../utils/logger';
import { resolveMonotonicState } from '../../utils/message-state';
import { formatBullMQPrefix, formatRedisKey } from '../../utils/redis-keys';
import { redisClient, redisConnectionOptions } from '../connection';

// ============================================================================
// Constants & Configuration
// ============================================================================

const OPT_OUT_KEYWORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END', 'OPTOUT', 'STOPALL']);
const OPT_IN_KEYWORDS = new Set(['START', 'UNSTOP', 'YES']);

export const TERMINAL_STATES = new Set<string>([
  MessageState.DELIVERED,
  MessageState.OPENED,
  MessageState.READ,
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
  return resolveMonotonicState(currentState, newStatus);
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
    providerId: attempt.providerId,
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
    });

    logger.info('WebhookIngest', `Recipient '${senderPhone}' auto-suppressed via keyword '${normalizedKeyword}'`);
  } else if (OPT_IN_KEYWORDS.has(normalizedKeyword)) {
    const existingSupp = await SuppressionsService.findSuppressionByIdentifier(team, senderPhone);
    if (existingSupp) {
      await SuppressionsService.deleteSuppression(team, existingSupp.id);
      logger.info('WebhookIngest', `Recipient '${senderPhone}' un-suppressed via keyword '${normalizedKeyword}'`);
    }
  }
}

export async function handleInboundMessage(params: {
  effectiveProviderId: string;
  ev: IngestedWebhookEvent;
  inboundData: InboundMessageData;
  now: Date;
  messageId?: string;
}): Promise<void> {
  const { effectiveProviderId, ev, inboundData, now } = params;
  const { senderPhone, inboundText, team } = inboundData;

  // 1. Record inbound message to activate/refresh WhatsApp 24h cost optimization window
  await WhatsAppSessionTracker.recordInboundMessage(effectiveProviderId, senderPhone);

  // 2. Handle compliance opt-in/opt-out keywords
  await handleComplianceKeywords(team, senderPhone, inboundText);

  const receiptId = createHash('sha256')
    .update(JSON.stringify([effectiveProviderId, team, ev.providerMessageId, ev.rawPayload]))
    .digest('hex');
  await db.transaction(async (tx) => {
    const inserted = await tx.execute(
      sql`INSERT INTO webhook_event_receipts (id) VALUES (${receiptId}) ON CONFLICT DO NOTHING RETURNING id`,
    );
    if (!inserted.length) return;
    await tx.insert(messageEvents).values({
      id: generateMessageId(),
      messageId: params.messageId || `inbound_${receiptId}`,
      channel: Channel.CHAT,
      providerId: effectiveProviderId,
      type: 'inbound.message',
      source: EventSource.WEBHOOK,
      metadata: { raw: ev.rawPayload, sender: senderPhone, text: inboundText },
      occurredAt: ev.timestamp,
      createdAt: now,
    });
    await WebhookSubscriptionsService.triggerEventForTeam(
      team,
      'inbound.message_received',
      {
        from: senderPhone,
        body: inboundText,
        channel: Channel.CHAT,
        receivedAt: ev.timestamp.toISOString(),
      },
      tx,
    );
  });
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
          eq(messageAttempts.messageId, cMsgId),
          eq(messageAttempts.providerId, effectiveProviderId),
          eq(messageAttempts.providerMessageId, providerMessageId),
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
        eq(messageAttempts.providerId, effectiveProviderId),
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
        eq(messageAttempts.providerId, effectiveProviderId),
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

  await db.transaction(async (tx) => {
    const [msg] = await tx.select().from(messages).where(partitionWhere).for('update');
    if (!msg) throw new Error('Receipt message is not yet available');
    const attemptWhere = and(
      eq(messageAttempts.id, attempt.id),
      gte(messageAttempts.createdAt, startDate),
      lte(messageAttempts.createdAt, endDate),
    );
    const [current] = await tx.select().from(messageAttempts).where(attemptWhere).for('update');
    if (!current) throw new Error('Receipt attempt is not yet available');
    const attemptState = resolveMonotonicState(current.state, ev.normalizedStatus);
    if (attemptState === current.state) return;
    await tx
      .update(messageAttempts)
      .set(buildAttemptTimestampUpdates(attemptState, ev.timestamp, now))
      .where(attemptWhere);
    const siblings = await tx
      .select()
      .from(messageAttempts)
      .where(
        and(
          eq(messageAttempts.messageId, attempt.messageId),
          gte(messageAttempts.createdAt, startDate),
          lte(messageAttempts.createdAt, endDate),
        ),
      );
    let targetState = resolveMonotonicState(msg.state, attemptState);
    if (
      [MessageState.FAILED, MessageState.BOUNCED].includes(targetState as MessageState) &&
      siblings.some((s) => !TERMINAL_STATES.has(s.state))
    )
      targetState = msg.state;
    await tx
      .update(messages)
      .set({
        state: targetState,
        ...(TERMINAL_STATES.has(targetState) ? { completedAt: ev.timestamp } : {}),
        updatedAt: now,
      })
      .where(partitionWhere);
    await tx.insert(messageEvents).values(buildWebhookMessageEventRecord(attempt, ev, now));
    const metric = mapStatusToMetric(attemptState);
    if (metric)
      await recordReceiptMetric(tx, {
        team: msg.team,
        category: msg.category,
        country: msg.country,
        channel: attempt.channel,
        metric,
        timestamp: ev.timestamp,
      });
    await WebhookSubscriptionsService.triggerEventForTeam(
      msg.team,
      `message.${attemptState}`,
      {
        messageId: msg.publicId,
        channel: attempt.channel,
        status: attemptState,
        timestamp: ev.timestamp.toISOString(),
      },
      tx,
    );
    await tx.insert(outbox).values({
      id: generateMessageId(),
      messageId: msg.publicId,
      type: 'webhook.callback',
      payload: {
        messageId: msg.publicId,
        channel: attempt.channel,
        event: attemptState,
        timestamp: ev.timestamp.toISOString(),
      },
    });
  });
}

// ============================================================================
// Core Event Orchestrators & Worker Lifecycle
// ============================================================================

export async function processSingleWebhookEvent(
  ev: IngestedWebhookEvent,
  defaultProviderId: string,
  now: Date,
): Promise<void> {
  // The verified ingress provider owns correlation; payload fields cannot select another provider.
  const effectiveProviderId = defaultProviderId;
  const rawPayloadObj =
    typeof ev.rawPayload === 'object' && ev.rawPayload !== null
      ? (ev.rawPayload as Record<string, unknown>)
      : undefined;

  try {
    // 1. INBOUND CUSTOMER MESSAGE FLOW (powers WhatsApp 24-hour cost optimization window)
    if (rawPayloadObj?.isInboundUserMessage) {
      const inboundData = parseInboundMessageData(rawPayloadObj);
      if (inboundData) {
        const [provider] = await db.select().from(providers).where(eq(providers.id, effectiveProviderId));
        const config = provider?.config as { inboundTeam?: string } | undefined;
        if (!config?.inboundTeam) throw new Error('Inbound provider requires an operator-configured inboundTeam');
        inboundData.team = config.inboundTeam;
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
    if (!attempt) throw new Error('Receipt arrived before its attempt is available');
    const inboundData = parseInboundMessageData(rawPayloadObj);
    if (inboundData?.inboundText) {
      const { startDate, endDate } = computePartitionWindow(attempt.messageId);
      const [msg] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.publicId, attempt.messageId),
            gte(messages.createdAt, startDate),
            lte(messages.createdAt, endDate),
          ),
        );
      if (!msg) throw new Error('Inbound message owner is not available');
      inboundData.team = msg.team;
      await handleInboundMessage({ effectiveProviderId, ev, inboundData, now, messageId: msg.publicId });
    }
    await handleStatusUpdate(attempt, ev, now);
  } catch (err) {
    logger.error(
      'WebhookIngest',
      `Error processing webhook event for provider '${effectiveProviderId}', msgId '${ev.providerMessageId}': ${(err as Error).message}`,
      err as Error,
    );
    throw err;
  }
}

export async function processWebhookEvent(params: ProcessWebhookParams): Promise<void> {
  const { providerId, payload, headers, now } = params;

  const mod = ProviderRegistry.getModule(providerId);
  if (!mod?.webhook) return;

  const events = extractWebhookEvents(mod.webhook, payload, headers);
  if (!events.length) return;

  // Process all events in the batch with Promise.allSettled for fault isolation
  const results = await Promise.allSettled(events.map((ev) => processSingleWebhookEvent(ev, providerId, now)));
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      'Receipt batch incomplete',
    );
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
