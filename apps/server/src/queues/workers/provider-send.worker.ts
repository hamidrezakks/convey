import { Worker } from 'bullmq';
import { and, eq, gte, lte } from 'drizzle-orm';
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
import { LeakyBucketGovernor } from '../../modules/policies/leaky-bucket';
import { PolicyEngine } from '../../modules/policies/policy-engine';
import { tenantSlaManager } from '../../modules/policies/tenant-sla';
import { providerCircuitBreaker } from '../../modules/providers/core/circuit-breaker';
import { ProviderRegistry } from '../../modules/providers/core/provider-registry';
import { ErrorCategory } from '../../modules/providers/core/provider-types';
import { sandboxAdapter } from '../../modules/providers/core/sandbox-adapter';
import { smartProviderRouter } from '../../modules/providers/core/smart-router';
import { applyWhatsAppSessionOptimization } from '../../modules/providers/whatsapp/session-interceptor';
import { ReportingService } from '../../modules/reports/reporting.service';
import { WebhookSubscriptionsService } from '../../modules/webhooks/webhook-subscriptions.service';
import { AdaptiveConcurrencyController } from '../../utils/adaptive-concurrency';
import { statisticalAnomalyDetector } from '../../utils/anomaly-detector';
import { chaosEngine } from '../../utils/chaos-engine';
import { FullJitterRetry } from '../../utils/full-jitter-retry';
import { generateMessageId } from '../../utils/id';
import { logger } from '../../utils/logger';
import { formatBullMQPrefix, formatRedisKey } from '../../utils/redis-keys';

export const adaptiveConcurrency = new AdaptiveConcurrencyController();

import { redisClient, redisConnectionOptions } from '../connection';
import { getProviderSendQueue } from '../provider-queues';
import { fallbackRetryQueue } from '../queue-definitions';

export interface SendJobData {
  publicId: string;
  channel: Channel;
  providerId?: string;
  content: Record<string, unknown>;
  recipient: Record<string, unknown>;
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
    providerConfig =
      (dbProviderList[0].credentials as Record<string, unknown>) ||
      (dbProviderList[0].config as Record<string, unknown>);
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
}): Promise<void> {
  const { data, adapterId, providerMessageId, latencyMs, msg, attemptId, now } = params;
  providerCircuitBreaker.recordSuccess(adapterId);
  smartProviderRouter.recordProviderFeedback(adapterId, latencyMs, true);
  adaptiveConcurrency.recordExecution(latencyMs);
  statisticalAnomalyDetector.recordLatency(adapterId, latencyMs);
  statisticalAnomalyDetector.analyze(adapterId, latencyMs);
  tenantSlaManager.recordDeliveryLatency(msg.team, latencyMs);

  // Populate O(1) Redis Reverse Index for instant Webhook ingestion without DB partition scans
  if (providerMessageId) {
    const redisKey = formatRedisKey(`provmsg:${adapterId}:${providerMessageId}`);
    const payload = `${data.publicId}|${attemptId}|${now.toISOString()}|${data.channel}`;
    redisClient.set(redisKey, payload, 'EX', 86400 * 7).catch(() => {});
  }

  await db.insert(messageAttempts).values({
    id: attemptId,
    messageId: data.publicId,
    channel: data.channel,
    providerId: adapterId,
    attemptNo: data.attemptNo,
    origin: data.origin,
    state: MessageState.DELIVERED,
    providerMessageId,
    deliveredAt: now,
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
    type: EventType.DELIVERY_DELIVERED,
    source: EventSource.WORKER,
    metadata: { providerMessageId },
    occurredAt: now,
    createdAt: now,
  });

  const { startDate, endDate } = computePartitionWindow(data.publicId);
  await db
    .update(messages)
    .set({ state: MessageState.DELIVERED, completedAt: now, updatedAt: now })
    .where(
      and(eq(messages.publicId, data.publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
    );

  await PolicyEngine.recordLedger({
    messageId: data.publicId,
    team: msg.team,
    amountUsd: 0.005,
    channel: data.channel,
    providerId: adapterId,
  }).catch((err) => {
    logger.error('ProviderSend', `Financial ledger recording failed for message '${data.publicId}'`, {
      error: (err as Error).message,
      team: msg.team,
      channel: data.channel,
    });
  });

  await ReportingService.recordMetric({
    team: msg.team,
    category: msg.category,
    country: msg.country,
    channel: data.channel,
    metric: MetricType.DELIVERED,
    timestamp: now,
  }).catch((err) => {
    logger.warn('ProviderSend', `Metric recording dropped for message '${data.publicId}': ${(err as Error).message}`);
  });

  await WebhookSubscriptionsService.triggerEventForTenant(msg.team, msg.team, 'message.delivered', {
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
  providerCircuitBreaker.recordFailure(adapterId, true);

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
    type: EventType.ATTEMPT_FAILED,
    source: EventSource.WORKER,
    metadata: { error, attemptsExhausted: isTransient },
    occurredAt: now,
    createdAt: now,
  });

  const { startDate, endDate } = computePartitionWindow(data.publicId);
  await db
    .update(messages)
    .set({ state: MessageState.FAILED, completedAt: now, updatedAt: now })
    .where(
      and(eq(messages.publicId, data.publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
    );

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
        recipient: data.recipient,
        content: data.content,
        metadata: msg.metadata as Record<string, unknown> | undefined,
      },
      providerConfig,
    );

    const result = await adapter.send(sendOptions, providerConfig);

    const latencyMs = Math.round(performance.now() - startTime);

    if (result.success) {
      await handleSendSuccess({
        data,
        adapterId: adapter.id,
        providerMessageId: result.providerMessageId,
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
  async (job) => {
    await processProviderSendJob(job.data as SendJobData);
  },
  {
    connection: redisConnectionOptions,
    prefix: formatBullMQPrefix(),
  },
);
