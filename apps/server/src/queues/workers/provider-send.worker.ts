import type { MessagePriority } from '@convey/shared';
import { type Job, Worker } from 'bullmq';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../db';
import { messageAttempts, messageEvents, messages, providers } from '../../db/schema';
import { computePartitionWindow } from '../../modules/messaging/messaging.service';
import {
  AttemptOrigin,
  type Channel,
  EventSource,
  EventType,
  MessageState,
  MetricType,
} from '../../modules/messaging/messaging.types';
import { BudgetService } from '../../modules/policies/budget.service';
import { estimateBudgetRecipients, estimateBudgetUnits } from '../../modules/policies/budget-estimate';
import { LeakyBucketGovernor } from '../../modules/policies/leaky-bucket';
import { PolicyEngine } from '../../modules/policies/policy-engine';
import { providerCircuitBreaker } from '../../modules/providers/core/circuit-breaker';
import { ProviderRegistry } from '../../modules/providers/core/provider-registry';
import type { UnifiedRecipient } from '../../modules/providers/core/provider-types';
import { ErrorCategory } from '../../modules/providers/core/provider-types';
import { sandboxAdapter } from '../../modules/providers/core/sandbox-adapter';
import { getProviderRate, smartProviderRouter } from '../../modules/providers/core/smart-router';
import { applyWhatsAppSessionOptimization } from '../../modules/providers/whatsapp/session-interceptor';
import { ReportingService } from '../../modules/reports/reporting.service';
import { WebhookSubscriptionsService } from '../../modules/webhooks/webhook-subscriptions.service';
import { AdaptiveConcurrencyController } from '../../utils/adaptive-concurrency';
import { statisticalAnomalyDetector } from '../../utils/anomaly-detector';
import { chaosEngine } from '../../utils/chaos-engine';
import { FullJitterRetry } from '../../utils/full-jitter-retry';
import { generateMessageId } from '../../utils/id';
import { logger } from '../../utils/logger';
import { decryptProviderCredentials } from '../../utils/payload-encryption';
import { formatBullMQPrefix, formatRedisKey } from '../../utils/redis-keys';

export const adaptiveConcurrency = new AdaptiveConcurrencyController();

import { redisClient, redisConnectionOptions } from '../connection';
import { getProviderSendQueue } from '../provider-queues';
import { fallbackRetryQueue } from '../queue-definitions';

export interface SendJobData {
  attemptId?: string;
  budgetExecutionId?: string;
  budgetStep?: string;
  publicId: string;
  channel: Channel;
  tenantId?: string;
  team?: string;
  category?: string;
  country?: string;
  recipient?: UnifiedRecipient | Record<string, unknown> | string;
  content?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  traceparent?: string;
  priority?: MessagePriority;
  providerId?: string;
  origin: AttemptOrigin;
  attemptNo: number;
}

const providerConfigCache = new Map<string, { config: Record<string, unknown> | undefined; expiresAt: number }>();
const MAX_PROVIDER_CONFIG_CACHE = 1000;

export function invalidateProviderConfigCache(providerId?: string) {
  if (providerId) {
    providerConfigCache.delete(providerId);
  } else {
    providerConfigCache.clear();
  }
}

export async function getCachedProviderConfig(targetProviderId: string): Promise<Record<string, unknown> | undefined> {
  const now = Date.now();
  const cached = providerConfigCache.get(targetProviderId);
  if (cached && cached.expiresAt > now) {
    return cached.config;
  }

  const dbProviderList = await db.select().from(providers).where(eq(providers.id, targetProviderId)).limit(1);
  let providerConfig: Record<string, unknown> | undefined;
  if (dbProviderList.length > 0) {
    const creds = decryptProviderCredentials(dbProviderList[0].credentials);
    const cfg = (dbProviderList[0].config as Record<string, unknown>) || {};
    providerConfig = { ...cfg, ...creds };
  }
  if (providerConfigCache.size >= MAX_PROVIDER_CONFIG_CACHE) {
    const firstKey = providerConfigCache.keys().next().value;
    if (firstKey) providerConfigCache.delete(firstKey);
  }
  providerConfigCache.set(targetProviderId, { config: providerConfig, expiresAt: now + 10_000 });
  return providerConfig;
}

export function resolveProviderAdapter(channel: Channel, providerId?: string) {
  return providerId
    ? ProviderRegistry.getModuleByChannel(channel, providerId)?.adapter
    : ProviderRegistry.getByChannel(channel)[0];
}

export async function recordNoProviderAttempt(
  data: SendJobData,
  attemptId: string,
  targetProviderId: string,
  now: Date,
): Promise<void> {
  await db.insert(messageAttempts).values({
    id: attemptId,
    messageId: data.publicId,
    channel: data.channel,
    providerId: targetProviderId,
    attemptNo: data.attemptNo,
    origin: data.origin,
    state: MessageState.FAILED,
    errorCategory: ErrorCategory.PERMANENT,
    errorCode: 'NO_PROVIDER_CONFIGURED',
    errorMessage: `No provider module found for channel ${data.channel}${data.providerId ? ` (provider: ${data.providerId})` : ''}`,
    queuedAt: now,
    startedAt: now,
    failedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export async function handleSendSuccess(params: {
  data: SendJobData;
  adapterId: string;
  providerMessageId?: string;
  latencyMs: number;
  msg: typeof messages.$inferSelect;
  attemptId: string;
  now: Date;
  budgetSettled?: boolean;
}): Promise<void> {
  const { data, adapterId, providerMessageId, latencyMs, msg, attemptId, now } = params;
  providerCircuitBreaker.recordSuccess(adapterId);
  smartProviderRouter.recordProviderFeedback(adapterId, latencyMs, true);
  adaptiveConcurrency.recordExecution(latencyMs);
  statisticalAnomalyDetector.recordLatency(adapterId, latencyMs);
  statisticalAnomalyDetector.analyze(adapterId, latencyMs);

  // A successful send confirms provider acceptance, not recipient delivery.
  await db.insert(messageAttempts).values({
    id: attemptId,
    messageId: data.publicId,
    channel: data.channel,
    providerId: adapterId,
    attemptNo: data.attemptNo,
    origin: data.origin,
    state: MessageState.DISPATCHED,
    providerMessageId,
    latencyMs,
    queuedAt: now,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(messageEvents).values({
    id: generateMessageId(),
    messageId: data.publicId,
    attemptId,
    channel: data.channel,
    providerId: adapterId,
    type: EventType.DELIVERY_ACCEPTED,
    source: EventSource.WORKER,
    metadata: { providerMessageId },
    occurredAt: now,
    createdAt: now,
  });

  const { startDate, endDate } = computePartitionWindow(data.publicId);
  await db
    .update(messages)
    .set({ state: MessageState.DISPATCHED, updatedAt: now })
    .where(
      and(
        eq(messages.publicId, data.publicId),
        gte(messages.createdAt, startDate),
        lte(messages.createdAt, endDate),
        inArray(messages.state, [MessageState.ACCEPTED, MessageState.DISPATCHED]),
      ),
    );

  // Populate O(1) Redis Reverse Index for instant Webhook ingestion without DB partition scans
  if (providerMessageId) {
    const redisKey = formatRedisKey(`provmsg:${adapterId}:${providerMessageId}`);
    const payload = `${data.publicId}|${attemptId}|${now.toISOString()}|${data.channel}`;
    redisClient.set(redisKey, payload, 'EX', 86400 * 7).catch(() => {});
  }

  if (!msg.isSandbox && !params.budgetSettled) {
    const rateInfo = getProviderRate(adapterId);
    await PolicyEngine.recordLedger({
      messageId: data.publicId,
      team: msg.team,
      amount: rateInfo.cost,
      currency: rateInfo.currency,
      amountUsd: rateInfo.cost,
      channel: data.channel,
      providerId: adapterId,
    }).catch((err) => {
      logger.error('ProviderSend', `Financial ledger recording failed for message '${data.publicId}'`, {
        error: (err as Error).message,
        team: msg.team,
        channel: data.channel,
      });
    });
  }

  await ReportingService.recordMetric({
    team: msg.team,
    category: msg.category,
    country: msg.country,
    channel: data.channel,
    metric: MetricType.SENT,
    timestamp: now,
  }).catch((err) => {
    logger.warn('ProviderSend', `Metric recording dropped for message '${data.publicId}': ${(err as Error).message}`);
  });

  await WebhookSubscriptionsService.triggerEventForTenant(msg.team, msg.team, 'message.sent', {
    messageId: msg.publicId,
    channel: data.channel,
    providerId: adapterId,
    providerMessageId,
  }).catch((err) => {
    logger.warn(
      'ProviderSend',
      `Webhook dispatch trigger failed for message '${data.publicId}': ${(err as Error).message}`,
    );
  });
}

export async function handleTransientFailure(params: {
  data: SendJobData;
  adapterId: string;
  error?: { code?: string; message?: string };
  latencyMs: number;
  attemptId: string;
  now: Date;
}): Promise<void> {
  const { data, adapterId, error, latencyMs, attemptId, now } = params;
  providerCircuitBreaker.recordFailure(adapterId, false);
  smartProviderRouter.recordProviderFeedback(adapterId, latencyMs, false);
  statisticalAnomalyDetector.recordLatency(adapterId, latencyMs);
  const nextAttemptNo = data.attemptNo + 1;
  const delayMs = FullJitterRetry.calculateBackoffMs(data.attemptNo, 1000, 30000);

  await db.insert(messageAttempts).values({
    id: attemptId,
    messageId: data.publicId,
    channel: data.channel,
    providerId: adapterId,
    attemptNo: data.attemptNo,
    origin: data.origin,
    state: MessageState.FAILED,
    errorCategory: ErrorCategory.TRANSIENT,
    errorCode: error?.code || 'SERVER_ERROR',
    errorMessage: error?.message || 'Transient provider server error',
    latencyMs,
    queuedAt: now,
    startedAt: now,
    failedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(messageEvents).values({
    id: generateMessageId(),
    messageId: data.publicId,
    attemptId,
    channel: data.channel,
    providerId: adapterId,
    type: EventType.ATTEMPT_RETRYING,
    source: EventSource.WORKER,
    metadata: { attemptNo: data.attemptNo, nextAttemptNo, delayMs, error },
    occurredAt: now,
    createdAt: now,
  });

  const pQueue = getProviderSendQueue(adapterId);
  await pQueue.add(
    `send-${adapterId}`,
    {
      publicId: data.publicId,
      channel: data.channel,
      providerId: adapterId,
      content: data.content,
      recipient: data.recipient,
      budgetExecutionId: data.budgetExecutionId,
      budgetStep: data.budgetStep,
      origin: AttemptOrigin.RETRY,
      attemptNo: nextAttemptNo,
    },
    { delay: delayMs },
  );
}

export async function handlePermanentFailure(params: {
  data: SendJobData;
  adapterId: string;
  error?: { code?: string; message?: string };
  errorCategory: ErrorCategory;
  isTransient: boolean;
  latencyMs: number;
  msg: typeof messages.$inferSelect;
  attemptId: string;
  now: Date;
}): Promise<void> {
  const { data, adapterId, error, errorCategory, isTransient, latencyMs, msg, attemptId, now } = params;
  if (error?.code !== 'BUDGET_EXCEEDED') providerCircuitBreaker.recordFailure(adapterId, true);

  await db.insert(messageAttempts).values({
    id: attemptId,
    messageId: data.publicId,
    channel: data.channel,
    providerId: adapterId,
    attemptNo: data.attemptNo,
    origin: data.origin,
    state: MessageState.FAILED,
    errorCategory,
    errorCode: error?.code || 'SEND_FAILED',
    errorMessage: error?.message || 'Provider failed to deliver message permanently',
    latencyMs,
    queuedAt: now,
    startedAt: now,
    failedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(messageEvents).values({
    id: generateMessageId(),
    messageId: data.publicId,
    attemptId,
    channel: data.channel,
    providerId: adapterId,
    type: error?.code === 'BUDGET_EXCEEDED' ? EventType.POLICY_BUDGET_EXCEEDED : EventType.ATTEMPT_FAILED,
    source: EventSource.WORKER,
    metadata: { error, attemptsExhausted: isTransient },
    occurredAt: now,
    createdAt: now,
  });

  const { startDate, endDate } = computePartitionWindow(data.publicId);
  const currentMsgList = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.publicId, data.publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
    );
  const currentMsg = currentMsgList[0];

  if (currentMsg && currentMsg.state !== MessageState.DELIVERED) {
    await db
      .update(messages)
      .set({ state: MessageState.FAILED, completedAt: now, updatedAt: now })
      .where(
        and(eq(messages.publicId, data.publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
      );
  }

  if (msg.fallback) {
    const fallbackConfig = msg.fallback as {
      rules: Array<{
        when: { channel: string; event: string; afterSeconds?: number };
        send: Array<{ channel: string; content?: Record<string, unknown> }>;
      }>;
    };

    for (const rule of fallbackConfig.rules) {
      if (rule.when.channel === data.channel && rule.when.event === 'failed') {
        await fallbackRetryQueue.add(
          'trigger-fallback',
          {
            publicId: data.publicId,
            budgetExecutionId: data.budgetExecutionId,
            triggerChannel: data.channel,
            triggerEvent: 'failed',
            targetChannels: rule.send,
          },
          {},
        );
      }
    }
  }
}

export async function handleSendException(
  data: SendJobData,
  attemptId: string,
  targetProviderId: string,
  errorMessage: string,
  now: Date,
): Promise<void> {
  await db.insert(messageAttempts).values({
    id: attemptId,
    messageId: data.publicId,
    channel: data.channel,
    providerId: targetProviderId,
    attemptNo: data.attemptNo,
    origin: data.origin,
    state: MessageState.FAILED,
    errorCategory: ErrorCategory.UNKNOWN,
    errorCode: 'EXCEPTION',
    errorMessage,
    queuedAt: now,
    startedAt: now,
    failedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export async function processProviderSendJob(data: SendJobData): Promise<void> {
  const now = new Date();
  const startTime = performance.now();
  const { startDate, endDate } = computePartitionWindow(data.publicId);

  const msgList = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.publicId, data.publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
    );
  if (!msgList.length) return;
  const msg = msgList[0];

  if ((data.budgetExecutionId ?? '') !== (msg.metadata?._budgetExecutionId ?? '')) return;

  if (msg.cancelledAt || (msg.expiresAt && now >= msg.expiresAt)) {
    return;
  }

  const adapter = msg.isSandbox ? sandboxAdapter : resolveProviderAdapter(data.channel, data.providerId);

  const attemptId = generateMessageId();
  const targetProviderId = data.providerId || adapter?.id || 'none';

  if (!adapter) {
    await recordNoProviderAttempt(data, attemptId, targetProviderId, now);
    return;
  }

  try {
    await LeakyBucketGovernor.acquireSlot(targetProviderId, 100);
    await chaosEngine.executeFaultInjection(targetProviderId);

    let providerConfig = await getCachedProviderConfig(targetProviderId);
    if (process.env.NODE_ENV === 'test' && (!providerConfig || Object.keys(providerConfig).length === 0)) {
      providerConfig = {
        apiKey: 'test_mock_key',
        accountSid: 'test_mock_sid',
        region: 'us-east-1',
        webhookUrl: 'https://discord.com/mock',
      };
    }

    const { options: sendOptions } = await applyWhatsAppSessionOptimization(
      targetProviderId,
      {
        id: data.publicId,
        channel: data.channel,
        recipient: (data.recipient || (msg.recipients as UnifiedRecipient) || '') as UnifiedRecipient,
        content: (data.content ||
          data.payload ||
          (msg.channels?.[0]?.content as Record<string, unknown>) ||
          {}) as Record<string, unknown>,
        metadata: msg.metadata as Record<string, unknown> | undefined,
      },
      providerConfig,
    );

    let reservationId: string | undefined;
    if (!msg.isSandbox) {
      const rate = getProviderRate(adapter.id);
      const reservation = await BudgetService.reserve({
        key: JSON.stringify([
          data.publicId,
          data.budgetExecutionId,
          data.budgetStep,
          data.channel,
          adapter.id,
          data.attemptNo,
          data.origin,
        ]),
        messageId: data.publicId,
        team: msg.team,
        channel: data.channel,
        providerId: adapter.id,
        amount: rate.cost * estimateBudgetUnits(sendOptions),
        currency: rate.currency,
      });
      if (!reservation.allowed) {
        if (reservation.reason === 'duplicate') return;
        await handlePermanentFailure({
          data,
          adapterId: adapter.id,
          error: { code: 'BUDGET_EXCEEDED', message: 'Insufficient remaining budget' },
          errorCategory: ErrorCategory.PERMANENT,
          isTransient: false,
          latencyMs: 0,
          msg,
          attemptId,
          now,
        });
        return;
      }
      reservationId = reservation.id;
    }
    // No SQL transaction or lock is held while calling the external provider.
    const result = await adapter.send(sendOptions, providerConfig);
    if (reservationId) {
      if (result.success) await BudgetService.settle(reservationId, 'committed');
      else if (
        estimateBudgetRecipients(sendOptions) === 1 &&
        (result.error?.category === ErrorCategory.PERMANENT || result.error?.category === ErrorCategory.RATE_LIMITED)
      )
        await BudgetService.settle(reservationId, 'released');
      // Timeouts and partial bulk failures can have been accepted remotely. Retain their hold for reconciliation.
    }

    const latencyMs = Math.round(performance.now() - startTime);

    if (result.success) {
      await handleSendSuccess({
        data,
        adapterId: adapter.id,
        providerMessageId: result.providerMessageId,
        budgetSettled: Boolean(reservationId),
        latencyMs,
        msg,
        attemptId,
        now,
      });
    } else {
      const errorCategory = result.error?.category || ErrorCategory.TRANSIENT;
      const isTransient = errorCategory === ErrorCategory.TRANSIENT;

      if (isTransient && data.attemptNo < 3) {
        await handleTransientFailure({ data, adapterId: adapter.id, error: result.error, latencyMs, attemptId, now });
      } else {
        await handlePermanentFailure({
          data,
          adapterId: adapter.id,
          error: result.error,
          errorCategory,
          isTransient,
          latencyMs,
          msg,
          attemptId,
          now,
        });
      }
    }
  } catch (err: unknown) {
    await handleSendException(data, attemptId, targetProviderId, (err as Error).message, now);
  }
}

export const providerSendWorker = new Worker(
  'provider-send',
  async (job: Job<SendJobData>) => {
    await processProviderSendJob(job.data as SendJobData);
  },
  {
    connection: redisConnectionOptions,
    prefix: formatBullMQPrefix(),
  },
);
