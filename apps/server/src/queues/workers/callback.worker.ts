import { Worker } from 'bullmq';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import { messages } from '../../db/schema';
import { computePartitionWindow } from '../../modules/messaging/messaging.service';
import { JobName, MessageState, QueueName } from '../../modules/messaging/messaging.types';
import { logger } from '../../utils/logger';
import { formatBullMQPrefix } from '../../utils/redis-keys';
import { redisConnectionOptions } from '../connection';
import { fallbackRetryQueue } from '../queue-definitions';

export interface CallbackJobData {
  messageId: string;
  channel: string;
  event: string;
  timestamp: string;
}

export async function processCallbackJob(data: CallbackJobData): Promise<void> {
  const { messageId, channel, event, timestamp } = data;
  logger.info('CallbackWorker', `Processed status callback for ${messageId} (${channel}: ${event}) at ${timestamp}`);

  // Trigger automated fallback if delivery failed or bounced and fallback rules are defined
  if (event === MessageState.FAILED || event === MessageState.BOUNCED) {
    const { startDate, endDate } = computePartitionWindow(messageId);
    const msgList = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.publicId, messageId), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)),
      );
    if (msgList.length > 0 && msgList[0].fallback) {
      const fallbackConfig = msgList[0].fallback as {
        triggerChannel?: string;
        triggerEvent?: string;
        targetChannels?: Array<{ channel: string; providerId?: string; content?: Record<string, unknown> }>;
      };

      if (
        fallbackConfig.targetChannels &&
        fallbackConfig.targetChannels.length > 0 &&
        (!fallbackConfig.triggerChannel || fallbackConfig.triggerChannel === channel)
      ) {
        logger.warn(
          'CallbackWorker',
          `Callback '${event}' on channel '${channel}' triggering fallback pipeline for message '${messageId}'`,
        );

        await fallbackRetryQueue.add(JobName.FALLBACK_RETRY, {
          publicId: messageId,
          triggerChannel: channel,
          triggerEvent: event,
          targetChannels: fallbackConfig.targetChannels,
        });
      }
    }
  }
}

export const callbackWorker = new Worker(
  QueueName.CALLBACK,
  async (job) => {
    await processCallbackJob(job.data as CallbackJobData);
  },
  {
    connection: redisConnectionOptions,
    prefix: formatBullMQPrefix(),
  },
);
