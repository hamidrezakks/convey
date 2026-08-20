import { type Job, Worker } from 'bullmq';
import { and, eq, gte, lte, or } from 'drizzle-orm';
import { db } from '../../db';
import { messageEvents, messages, providerRoutes } from '../../db/schema';
import { computePartitionWindow } from '../../modules/messaging/messaging.service';
import {
  AttemptOrigin,
  type Channel,
  type ChannelRequest,
  EventSource,
  EventType,
  MessageState,
  type Recipients,
} from '../../modules/messaging/messaging.types';
import { PolicyEngine } from '../../modules/policies/policy-engine';
import { providerCircuitBreaker } from '../../modules/providers/core/circuit-breaker';
import { ProviderRegistry } from '../../modules/providers/core/provider-registry';
import { getDefaultProviderForChannel, smartProviderRouter } from '../../modules/providers/core/smart-router';
import { SuppressionsService } from '../../modules/suppressions/suppressions.service';

import { generateMessageId } from '../../utils/id';
import { logger } from '../../utils/logger';
import { type EncryptedPayload, payloadEncryptionManager } from '../../utils/payload-encryption';
import { extractRecipientIdentifiers } from '../../utils/recipients';
import { formatBullMQPrefix, formatRedisKey } from '../../utils/redis-keys';
import { redisClient, redisConnectionOptions } from '../connection';
import { ensureProviderSendWorker, getProviderSendQueue } from '../provider-queues';
import { dispatchBulkQueue, dispatchHighQueue, dispatchNormalQueue, dispatchQueue } from '../queue-definitions';
import { processProviderSendJob } from './provider-send.worker';

export { getDefaultProviderForChannel };

export async function resolveProviderForChannel(
  team: string,
  category: string,
  country: string,
  channel: Channel,
  requestedProviderId?: string,
): Promise<string> {
  if (requestedProviderId && providerCircuitBreaker.canExecute(requestedProviderId)) {
    return requestedProviderId;
  }

  const cacheKey = formatRedisKey(`route:${team}:${category}:${country}:${channel}`);
  const cachedRoute = await redisClient.get(cacheKey);
  if (cachedRoute && providerCircuitBreaker.canExecute(cachedRoute)) {
    return cachedRoute;
  }

  const dbRoutes = await db
    .select()
    .from(providerRoutes)
    .where(
      and(
        eq(providerRoutes.team, team),
        eq(providerRoutes.channel, channel),
        or(eq(providerRoutes.country, country), eq(providerRoutes.country, 'ALL')),
        or(eq(providerRoutes.category, category), eq(providerRoutes.category, 'ALL')),
      ),
    );

  if (dbRoutes.length > 0) {
    const primaryId = dbRoutes[0].primaryProviderId;
    if (providerCircuitBreaker.canExecute(primaryId)) {
      await redisClient.set(cacheKey, primaryId, 'EX', 60);
      return primaryId;
    }

    if (dbRoutes[0].secondaryProviderId && providerCircuitBreaker.canExecute(dbRoutes[0].secondaryProviderId)) {
      const secondaryId = dbRoutes[0].secondaryProviderId;
      logger.warn(
        'MessageDispatch',
        `Primary provider '${primaryId}' circuit OPEN. Failing over to secondary provider '${secondaryId}'`,
      );
      return secondaryId;
    }
  }

  const smartOptimalId = smartProviderRouter.selectOptimalProvider(channel, requestedProviderId);
  if (smartOptimalId && providerCircuitBreaker.canExecute(smartOptimalId)) {
    await redisClient.set(cacheKey, smartOptimalId, 'EX', 60);
    return smartOptimalId;
  }

  const defaultId = getDefaultProviderForChannel(channel);
  if (providerCircuitBreaker.canExecute(defaultId)) {
    await redisClient.set(cacheKey, defaultId, 'EX', 60);
    return defaultId;
  }

  const configuredAdapters = ProviderRegistry.getConfiguredAdaptersByChannel(channel);
  const healthyAdapters = configuredAdapters.filter((a) => providerCircuitBreaker.canExecute(a.id));
  const fallbackId = healthyAdapters[0]?.id || defaultId;

  await redisClient.set(cacheKey, fallbackId, 'EX', 60);
  return fallbackId;
}

import { CascadeManager } from '../../modules/messaging/cascade-manager';
import type { CascadeConfig } from '../../modules/messaging/messaging.types';

export async function resolveRouteAndEnqueue(msg: typeof messages.$inferSelect, publicId: string): Promise<void> {
  let channels = msg.channels;
  let recipient = msg.recipients;

  const metadataObj = msg.metadata;
  if (metadataObj?._encryptedEnvelope) {
    const decrypted = payloadEncryptionManager.decryptPayload<{
      recipients: Recipients;
      channels: ChannelRequest[];
      cascade?: CascadeConfig;
    }>(metadataObj._encryptedEnvelope as EncryptedPayload);
    if (decrypted?.recipients && decrypted?.channels) {
      recipient = decrypted.recipients;
      channels = decrypted.channels;
    }
  }

  const cascade = metadataObj?.cascade as CascadeConfig | undefined;
  if (cascade?.enabled && cascade?.steps?.length) {
    await CascadeManager.executeCascadeStep(publicId, 0, async (stepData) => {
      const channel = stepData.channel as Channel;
      const providerId = await resolveProviderForChannel(
        msg.team,
        msg.category,
        msg.country,
        channel,
        stepData.providerId,
      );

      const sendQueue = getProviderSendQueue(providerId);
      ensureProviderSendWorker(providerId, { force: true });

      const sendJobData = {
        publicId,
        channel,
        content: stepData.content || {},
        recipient,
        origin: AttemptOrigin.INITIAL,
        attemptNo: 1,
      };

      await sendQueue.add('send-message', sendJobData, {});
      if (process.env.NODE_ENV === 'test') {
        await processProviderSendJob({
          ...sendJobData,
          providerId,
        });
      }
    });
    return;
  }

  for (const channelReq of channels) {
    const channel = channelReq.channel as Channel;
    const channelReqProviderId =
      'providerId' in channelReq && typeof channelReq.providerId === 'string' ? channelReq.providerId : undefined;
    const providerId = await resolveProviderForChannel(
      msg.team,
      msg.category,
      msg.country,
      channel,
      channelReqProviderId,
    );

    const sendQueue = getProviderSendQueue(providerId);
    ensureProviderSendWorker(providerId, { force: true });

    const sendJobData = {
      publicId,
      channel,
      content: ('content' in channelReq ? channelReq.content : {}) || {},
      recipient,
      origin: AttemptOrigin.INITIAL,
      attemptNo: 1,
    };

    await sendQueue.add('send-message', sendJobData, {});
    if (process.env.NODE_ENV === 'test') {
      await processProviderSendJob({
        ...sendJobData,
        providerId,
      });
    }
  }
}

export async function processDispatchJob(publicId: string): Promise<void> {
  const { startDate, endDate } = computePartitionWindow(publicId);
  const partitionWhere = and(
    eq(messages.publicId, publicId),
    gte(messages.createdAt, startDate),
    lte(messages.createdAt, endDate),
  );

  const msgList = await db.select().from(messages).where(partitionWhere);

  if (msgList.length === 0) {
    return;
  }

  const msg = msgList[0];
  const now = new Date();

  // 1. Policy check: Rate limiting
  const channels = msg.channels;
  const primaryChannel = channels[0]?.channel;

  const rateCheck = await PolicyEngine.checkRateLimit({
    team: msg.team,
    category: msg.category,
    country: msg.country,
    channel: primaryChannel,
  });

  if (!rateCheck.allowed) {
    await db
      .update(messages)
      .set({ state: MessageState.FAILED, completedAt: now, updatedAt: now })
      .where(partitionWhere);

    await db.insert(messageEvents).values({
      id: generateMessageId(),
      messageId: publicId,
      type: EventType.POLICY_RATE_LIMITED,
      source: EventSource.ROUTER,
      metadata: { policyId: rateCheck.policyId, team: msg.team },
      occurredAt: now,
      createdAt: now,
    });
    return;
  }

  // 2. Policy check: Financial Budget
  const budgetCheck = await PolicyEngine.checkBudget(msg.team);
  if (!budgetCheck.allowed) {
    await db
      .update(messages)
      .set({ state: MessageState.FAILED, completedAt: now, updatedAt: now })
      .where(partitionWhere);

    await db.insert(messageEvents).values({
      id: generateMessageId(),
      messageId: publicId,
      type: EventType.POLICY_BUDGET_EXCEEDED,
      source: EventSource.ROUTER,
      metadata: { policyId: budgetCheck.policyId, team: msg.team },
      occurredAt: now,
      createdAt: now,
    });
    return;
  }

  // 3. Suppression check
  const extracted = extractRecipientIdentifiers(msg.recipients, msg.userId);
  const identifiers = extracted.map((e) => e.raw).filter(Boolean);

  if (identifiers.length > 0) {
    const suppCheck = await SuppressionsService.isSuppressed({
      team: msg.team,
      identifiers,
      channel: primaryChannel,
      category: msg.category,
    });

    if (suppCheck.suppressed) {
      await db
        .update(messages)
        .set({ state: MessageState.FAILED, completedAt: now, updatedAt: now })
        .where(partitionWhere);

      await db.insert(messageEvents).values({
        id: generateMessageId(),
        messageId: publicId,
        type: EventType.SUPPRESSION_BLOCKED,
        source: EventSource.ROUTER,
        metadata: { suppressionId: suppCheck.suppressionId, reason: suppCheck.reason },
        occurredAt: now,
        createdAt: now,
      });
      return;
    }
  }

  await db.update(messages).set({ state: MessageState.DISPATCHED, updatedAt: now }).where(partitionWhere);

  await db.insert(messageEvents).values({
    id: generateMessageId(),
    messageId: publicId,
    type: EventType.ROUTING_RESOLVED,
    source: EventSource.ROUTER,
    metadata: { team: msg.team, category: msg.category, channelCount: msg.channels?.length ?? 0 },
    occurredAt: now,
    createdAt: now,
  });

  await resolveRouteAndEnqueue(msg, publicId);
}

export function createMessageDispatchWorker(queue = dispatchQueue, concurrency = 10) {
  return new Worker<{ publicId: string }>(
    queue.name,
    async (job: Job<{ publicId: string }>) => {
      await processDispatchJob(job.data.publicId);
    },
    { connection: redisConnectionOptions, concurrency, prefix: formatBullMQPrefix() },
  );
}

export const messageDispatchWorker = createMessageDispatchWorker(dispatchQueue, 10);
export const messageDispatchHighWorker = createMessageDispatchWorker(dispatchHighQueue, 20);
export const messageDispatchNormalWorker = createMessageDispatchWorker(dispatchNormalQueue, 10);
export const messageDispatchBulkWorker = createMessageDispatchWorker(dispatchBulkQueue, 5);
