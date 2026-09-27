import { Worker } from 'bullmq';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import { messageAttempts, messages } from '../../db/schema';
import { computePartitionWindow } from '../../modules/messaging/messaging.service';
import { AttemptOrigin, AttemptState, type Channel, JobName, QueueName } from '../../modules/messaging/messaging.types';
import { getDefaultProviderForChannel, ProviderRegistry } from '../../modules/providers/core/provider-registry';
import { formatBullMQPrefix } from '../../utils/redis-keys';
import { redisConnectionOptions } from '../connection';
import { ensureProviderSendWorker, getProviderSendQueue } from '../provider-queues';

export interface FallbackRetryJobData {
  publicId: string;
  budgetExecutionId?: string;
  triggerChannel: string;
  triggerEvent: string;
  targetChannels: Array<{ channel: string; providerId?: string; content?: Record<string, unknown> }>;
}

export function checkFallbackTriggerEligible(
  attempts: ReadonlyArray<typeof messageAttempts.$inferSelect>,
  triggerChannel: string,
  triggerEvent: string,
): boolean {
  const triggerAttempts = attempts.filter((a) => a.channel === triggerChannel);
  const isDelivered = triggerAttempts.some(
    (a) => a.state === AttemptState.DELIVERED || a.state === AttemptState.OPENED || a.state === AttemptState.READ,
  );
  if ((triggerEvent === 'not_delivered' || triggerEvent === 'not_read') && isDelivered) {
    return false; // Webhook arrived! Skip fallback.
  }
  return true;
}

export function resolveFallbackContent(
  msg: typeof messages.$inferSelect,
  channel: Channel,
  targetContent?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (targetContent) return targetContent;
  const channelList = msg.channels as Array<{ channel: string; content: Record<string, unknown> }>;
  return channelList.find((c) => c.channel === channel)?.content;
}

export async function processFallbackRetryJob(data: FallbackRetryJobData): Promise<void> {
  const { publicId, triggerChannel, triggerEvent, targetChannels } = data;
  const { startDate, endDate } = computePartitionWindow(publicId);

  // 1. Reload Durable State with Partition Pruning for Race Safety
  const attempts = await db
    .select()
    .from(messageAttempts)
    .where(
      and(
        eq(messageAttempts.messageId, publicId),
        gte(messageAttempts.createdAt, startDate),
        lte(messageAttempts.createdAt, endDate),
      ),
    );
  if (!checkFallbackTriggerEligible(attempts, triggerChannel, triggerEvent)) {
    return;
  }

  const msgList = await db
    .select()
    .from(messages)
    .where(and(eq(messages.publicId, publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)));
  if (!msgList.length) return;
  const msg = msgList[0];
  if ((data.budgetExecutionId ?? '') !== (msg.metadata?._budgetExecutionId ?? '')) return;

  // 2. Dispatch Fallback Channels to Dedicated Per-Provider Sending Queues
  for (const [targetIndex, target] of targetChannels.entries()) {
    const channel = target.channel as Channel;
    const fallbackContent = resolveFallbackContent(msg, channel, target.content);

    if (fallbackContent) {
      const adapters = ProviderRegistry.getByChannel(channel);
      const providerId = target.providerId || adapters[0]?.id || getDefaultProviderForChannel(channel);

      const sendQueue = getProviderSendQueue(providerId);
      ensureProviderSendWorker(providerId);

      await sendQueue.add(
        JobName.SEND_PROVIDER,
        {
          publicId,
          channel,
          content: fallbackContent,
          recipient: msg.recipients,
          budgetExecutionId: data.budgetExecutionId,
          budgetStep: `fallback-${triggerChannel}-${triggerEvent}-${targetIndex}`,
          origin: AttemptOrigin.FALLBACK,
          attemptNo: 1,
        },
        {},
      );
    }
  }
}

import { CascadeManager } from '../../modules/messaging/cascade-manager';
import { processProviderSendJob } from './provider-send.worker';

export const fallbackRetryWorker = new Worker(
  QueueName.FALLBACK_RETRY,
  async (job) => {
    if (job.name === JobName.PROCESS_CASCADE_STEP || (job.data as { stepIndex?: number })?.stepIndex !== undefined) {
      const { publicId, stepIndex, budgetExecutionId } = job.data as {
        publicId: string;
        stepIndex: number;
        budgetExecutionId?: string;
      };
      const { startDate, endDate } = computePartitionWindow(publicId);
      const [current] = await db
        .select()
        .from(messages)
        .where(
          and(eq(messages.publicId, publicId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
        );
      if (!current || (budgetExecutionId ?? '') !== (current.metadata?._budgetExecutionId ?? '')) return;
      await CascadeManager.executeCascadeStep(publicId, stepIndex, async (stepData) => {
        const channel = stepData.channel as Channel;
        const adapters = ProviderRegistry.getByChannel(channel);
        const providerId = stepData.providerId || adapters[0]?.id || getDefaultProviderForChannel(channel);

        const sendQueue = getProviderSendQueue(providerId);
        ensureProviderSendWorker(providerId);

        const sendJobData = {
          publicId,
          channel,
          content: stepData.content || {},
          recipient: (job.data as { recipient?: Record<string, unknown> })?.recipient || {},
          budgetExecutionId,
          budgetStep: `cascade-${stepIndex}`,
          origin: AttemptOrigin.FALLBACK,
          attemptNo: 1,
        };

        await sendQueue.add(JobName.SEND_PROVIDER, sendJobData, {});
        if (process.env.NODE_ENV === 'test') {
          await processProviderSendJob({
            ...sendJobData,
            providerId,
          });
        }
      });
      return;
    }

    await processFallbackRetryJob(job.data as FallbackRetryJobData);
  },
  {
    connection: redisConnectionOptions,
    prefix: formatBullMQPrefix(),
  },
);
