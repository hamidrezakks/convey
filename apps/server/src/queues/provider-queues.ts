import { type Job, Queue, Worker } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { messageAttempts, messageEvents } from '../db/schema';
import { Channel } from '../modules/messaging/messaging.types';
import type { ProviderSendJobData, ProviderWebhookJobData } from '../modules/providers/core/provider-module';
import { ProviderRegistry } from '../modules/providers/core/provider-registry';
import { buildAttemptTimestampUpdates } from '../utils/attempts';
import { generateMessageId } from '../utils/id';
import { logger } from '../utils/logger';
import { formatBullMQPrefix, formatPubSubChannel, formatRedisKey } from '../utils/redis-keys';
import { type BunNativeRedis, redisClient, redisConnectionOptions } from './connection';
import { callbackQueue } from './queue-definitions';
import { processProviderSendJob } from './workers/provider-send.worker';

const sendQueueMap = new Map<string, Queue>();
const sendWorkerMap = new Map<string, Worker>();

const webhookQueueMap = new Map<string, Queue>();
const webhookWorkerMap = new Map<string, Worker>();

const CANONICAL_CHANNELS: Channel[] = [Channel.EMAIL, Channel.SMS, Channel.PUSH, Channel.CHAT, Channel.TOOL];

/**
 * DEDICATED SENDING QUEUE PER PROVIDER
 * Queue Name: `{provider-send-${providerId}}`
 */
export function getProviderSendQueue(providerId: string): Queue {
  let queue = sendQueueMap.get(providerId);
  if (!queue) {
    queue = new Queue(`provider-send-${providerId}`, {
      connection: redisConnectionOptions,
      prefix: formatBullMQPrefix(),
    });
    sendQueueMap.set(providerId, queue);
  }
  return queue;
}

export function ensureProviderSendWorker(providerId: string, options?: { force?: boolean }): Worker | undefined {
  let worker = sendWorkerMap.get(providerId);
  if (worker) return worker;

  const isSetup = ProviderRegistry.hasSetup(providerId);
  if (!isSetup && !options?.force) {
    logger.debug('ProviderQueues', `Skipping send worker registration for unconfigured provider '${providerId}'`);
    return undefined;
  }

  worker = new Worker(
    `provider-send-${providerId}`,
    async (job) => {
      await processProviderSendJob({
        ...(job.data as ProviderSendJobData),
        providerId,
      });
    },
    {
      connection: redisConnectionOptions,
      prefix: formatBullMQPrefix(),
    },
  );

  sendWorkerMap.set(providerId, worker);
  logger.info('ProviderQueues', `Registered send worker for provider '${providerId}'`);
  return worker;
}

/**
 * DEDICATED RECEIVING WEBHOOK QUEUE PER PROVIDER
 * Queue Name: `{provider-webhook-${providerId}}`
 */
export function getProviderWebhookQueue(providerId: string): Queue {
  let queue = webhookQueueMap.get(providerId);
  if (!queue) {
    queue = new Queue(`provider-webhook-${providerId}`, {
      connection: redisConnectionOptions,
      prefix: formatBullMQPrefix(),
    });
    webhookQueueMap.set(providerId, queue);
  }
  return queue;
}

export function parseWebhookPayload(
  mod: ReturnType<typeof ProviderRegistry.getModule>,
  providerId: string,
  payload: unknown,
  headers: Record<string, string>,
) {
  if (mod?.webhook?.parsePayload) {
    return mod.webhook.parsePayload(payload, headers);
  }

  for (const ch of CANONICAL_CHANNELS) {
    const adapter = ProviderRegistry.get(ch, providerId);
    if (adapter?.parseWebhook) {
      const events = adapter.parseWebhook(payload, headers);
      if (events.length > 0) return events;
    }
  }

  return [];
}

export async function resolveAttemptForProviderMessage(providerId: string, providerMessageId: string) {
  const cachedMap = await redisClient.get(formatRedisKey(`provmsg:${providerId}:${providerMessageId}`));
  if (cachedMap) {
    const parts = cachedMap.split('|');
    return {
      messageId: parts[0],
      attemptId: parts[1],
      attemptCreatedAt: new Date(parts[2]),
      attemptChannel: (parts[3] || Channel.EMAIL) as Channel,
    };
  }

  const attempts = await db
    .select()
    .from(messageAttempts)
    .where(and(eq(messageAttempts.providerId, providerId), eq(messageAttempts.providerMessageId, providerMessageId)));

  if (attempts.length > 0) {
    return {
      messageId: attempts[0].messageId,
      attemptId: attempts[0].id,
      attemptCreatedAt: attempts[0].createdAt,
      attemptChannel: attempts[0].channel as Channel,
    };
  }

  return null;
}

export async function processNormalizedWebhookEvent(
  ev: {
    providerId: string;
    providerMessageId: string;
    normalizedStatus: string;
    errorCode?: string;
    errorMessage?: string;
    rawPayload: unknown;
    timestamp: Date;
  },
  providerId: string,
  now: Date,
): Promise<void> {
  const attemptInfo = await resolveAttemptForProviderMessage(providerId, ev.providerMessageId);
  if (!attemptInfo) return;

  const { messageId, attemptId, attemptCreatedAt, attemptChannel } = attemptInfo;

  await db
    .update(messageAttempts)
    .set(buildAttemptTimestampUpdates(ev.normalizedStatus, ev.timestamp, now))
    .where(and(eq(messageAttempts.id, attemptId), eq(messageAttempts.createdAt, attemptCreatedAt)));

  await db.insert(messageEvents).values({
    id: generateMessageId(),
    messageId,
    attemptId,
    channel: attemptChannel,
    providerId: ev.providerId,
    type: `delivery.${ev.normalizedStatus}`,
    source: 'webhook',
    metadata: { raw: ev.rawPayload },
    occurredAt: ev.timestamp,
    createdAt: now,
  });

  await callbackQueue.add('send-callback', {
    messageId,
    channel: attemptChannel,
    event: ev.normalizedStatus,
    timestamp: ev.timestamp.toISOString(),
  });
}

export function ensureProviderWebhookWorker(providerId: string, options?: { force?: boolean }): Worker | undefined {
  let worker = webhookWorkerMap.get(providerId);
  if (worker) return worker;

  const isSetup = ProviderRegistry.hasSetup(providerId);
  if (!isSetup && !options?.force) {
    logger.debug('ProviderQueues', `Skipping webhook worker registration for unconfigured provider '${providerId}'`);
    return undefined;
  }

  worker = new Worker(
    `provider-webhook-${providerId}`,
    async (job) => {
      const mod = ProviderRegistry.getModule(providerId);
      if (mod?.workers?.processWebhook) {
        return await mod.workers.processWebhook(job as Job<ProviderWebhookJobData>);
      }

      const now = new Date();
      const { payload, headers } = job.data as {
        payload: unknown;
        headers: Record<string, string>;
      };

      const normalizedEvents = parseWebhookPayload(mod, providerId, payload, headers);
      for (const ev of normalizedEvents) {
        await processNormalizedWebhookEvent(ev, providerId, now);
      }
    },
    {
      connection: redisConnectionOptions,
      prefix: formatBullMQPrefix(),
    },
  );

  webhookWorkerMap.set(providerId, worker);
  logger.info('ProviderQueues', `Registered webhook worker for provider '${providerId}'`);
  return worker;
}

export function setupConfiguredProviderWorkers(configMap?: Record<string, Record<string, unknown>>): number {
  const configured = ProviderRegistry.getConfiguredProviders(configMap);
  let count = 0;

  for (const item of configured) {
    const sendWorker = ensureProviderSendWorker(item.providerId, { force: true });
    if (sendWorker) count++;
    ensureProviderWebhookWorker(item.providerId, { force: true });
  }

  logger.info(
    'ProviderQueues',
    `Pre-initialized workers for ${configured.length} configured providers (Total send workers: ${sendWorkerMap.size})`,
  );
  return count;
}

const CONFIG_CHANNEL = formatPubSubChannel('provider-config-events');
const NODE_INSTANCE_ID = generateMessageId();
const reconfigLockMap = new Map<string, Promise<void>>();
let pubSubSubscriber: BunNativeRedis | undefined;

export async function publishProviderConfigUpdate(
  providerId: string,
  newConfig: Record<string, unknown>,
): Promise<void> {
  try {
    const payload = JSON.stringify({
      providerId,
      newConfig,
      originNodeId: NODE_INSTANCE_ID,
      timestamp: Date.now(),
    });
    await redisClient.publish(CONFIG_CHANNEL, payload);
    logger.info('ProviderQueues', `Broadcasted config reload event for provider '${providerId}' across Redis cluster`);
  } catch (err: unknown) {
    logger.error('ProviderQueues', `Failed to broadcast provider config update for '${providerId}'`, {
      error: (err as Error).message,
    });
  }
}

export function listenProviderConfigUpdates(): void {
  if (pubSubSubscriber || process.env.NODE_ENV === 'test') return;
  try {
    pubSubSubscriber = redisClient.duplicate();

    pubSubSubscriber.subscribe(CONFIG_CHANNEL, (err: unknown) => {
      if (err) {
        logger.error('ProviderQueues', 'Failed to subscribe to provider config event channel', {
          error: (err as Error).message,
        });
      } else {
        logger.info('ProviderQueues', `Subscribed to cluster provider config events channel ${CONFIG_CHANNEL}`);
      }
    });

    pubSubSubscriber.on('message', (channel: string, message: string) => {
      if (channel !== CONFIG_CHANNEL) return;
      try {
        const data = JSON.parse(message);
        if (data.originNodeId === NODE_INSTANCE_ID) return;

        logger.info('ProviderQueues', `Received cluster hot reload event for provider '${data.providerId}'`);
        hotReloadProviderWorker(data.providerId, data.newConfig, { broadcast: false });
      } catch (err: unknown) {
        logger.error('ProviderQueues', 'Error processing cluster provider config event', {
          error: (err as Error).message,
        });
      }
    });
  } catch (err: unknown) {
    logger.error('ProviderQueues', 'Failed to initialize PubSub subscriber for provider config events', {
      error: (err as Error).message,
    });
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function executeHotReload(
  providerId: string,
  newConfig: Record<string, unknown>,
  shouldBroadcast: boolean,
): Promise<boolean> {
  const isWorkable = ProviderRegistry.isWorkable(providerId, newConfig);
  if (!isWorkable) {
    logger.warn(
      'ProviderQueues',
      `Hot reload rejected for provider '${providerId}': new configuration failed validation`,
    );
    return false;
  }

  const result = await ProviderRegistry.reconfigureProvider(providerId, newConfig);

  if (result.unchanged) {
    logger.debug('ProviderQueues', `Configuration for provider '${providerId}' unchanged, skipping worker pause`);
    return true;
  }

  if (!result.success) {
    if (result.rolledBack) {
      logger.warn(
        'ProviderQueues',
        `Provider '${providerId}' reconfiguration failed (${result.error}), safely rolled back to Last-Known-Good-Config`,
      );
    } else {
      logger.error('ProviderQueues', `Hot reload failed for provider '${providerId}': ${result.error}`);
    }
    return false;
  }

  const worker = sendWorkerMap.get(providerId);
  if (worker) {
    logger.info('ProviderQueues', `Pausing worker for provider '${providerId}' for graceful hot reload...`);
    await withTimeout(worker.pause(), 2000, undefined);
    worker.resume();
    logger.info('ProviderQueues', `Resumed worker for provider '${providerId}' with updated configuration`);
  } else {
    ensureProviderSendWorker(providerId, { force: true });
  }

  if (shouldBroadcast && process.env.NODE_ENV !== 'test') {
    await publishProviderConfigUpdate(providerId, newConfig);
  }

  return true;
}

/**
 * GRACEFUL HOT RELOAD FOR PROVIDER CONFIGURATION
 * 1. Serializes reloads per provider via per-provider mutex lock (reconfigLockMap).
 * 2. Validates new config via ProviderRegistry.isWorkable(providerId, newConfig).
 * 3. Pauses worker gracefully so in-flight jobs finish cleanly and new jobs stay queued in Redis.
 * 4. Reconfigures provider instance atomically via ProviderRegistry.reconfigureProvider(providerId, newConfig).
 * 5. Resumes worker cleanly.
 * 6. Option to broadcast event across cluster via Redis PubSub.
 * Zero Message Loss: Messages remain safely buffered in the Redis BullMQ queue during worker pause.
 */
export async function hotReloadProviderWorker(
  providerId: string,
  newConfig: Record<string, unknown>,
  options?: { broadcast?: boolean },
): Promise<boolean> {
  const existingLock = reconfigLockMap.get(providerId) || Promise.resolve();
  let releaseLock: () => void = () => {};
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  reconfigLockMap.set(
    providerId,
    existingLock.then(() => newLock),
  );

  try {
    await existingLock;
    return await executeHotReload(providerId, newConfig, options?.broadcast !== false);
  } finally {
    releaseLock();
  }
}

export async function closeAllProviderQueues(): Promise<void> {
  if (pubSubSubscriber) {
    await pubSubSubscriber.quit().catch(() => {});
    pubSubSubscriber = undefined;
  }
  for (const worker of sendWorkerMap.values()) {
    await worker.close();
  }
  for (const queue of sendQueueMap.values()) {
    await queue.close();
  }
  for (const worker of webhookWorkerMap.values()) {
    await worker.close();
  }
  for (const queue of webhookQueueMap.values()) {
    await queue.close();
  }
  sendWorkerMap.clear();
  sendQueueMap.clear();
  webhookWorkerMap.clear();
  webhookQueueMap.clear();
  reconfigLockMap.clear();
  logger.info('ProviderQueues', 'All provider queues and workers closed cleanly');
}
