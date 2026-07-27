import { Queue } from 'bullmq';
import { QueueName } from '../modules/messaging/messaging.types';
import { formatBullMQPrefix } from '../utils/redis-keys';
import { redisConnectionOptions } from './connection';

const defaultQueueOptions = {
  connection: redisConnectionOptions,
  prefix: formatBullMQPrefix(),
};

export const dispatchQueue = new Queue(QueueName.MESSAGE_DISPATCH, defaultQueueOptions);
export const dispatchHighQueue = new Queue(QueueName.MESSAGE_DISPATCH_HIGH, defaultQueueOptions);
export const dispatchNormalQueue = new Queue(QueueName.MESSAGE_DISPATCH_NORMAL, defaultQueueOptions);
export const dispatchBulkQueue = new Queue(QueueName.MESSAGE_DISPATCH_BULK, defaultQueueOptions);

// Priority Tier Aliases
export const criticalDispatchQueue = dispatchHighQueue;
export const transactionalDispatchQueue = dispatchNormalQueue;
export const bulkDispatchQueue = dispatchBulkQueue;

export const providerSendQueue = new Queue(QueueName.PROVIDER_SEND, defaultQueueOptions);
export const fallbackRetryQueue = new Queue(QueueName.FALLBACK_RETRY, defaultQueueOptions);
export const webhookIngestQueue = new Queue(QueueName.WEBHOOK_INGEST, defaultQueueOptions);
export const callbackQueue = new Queue(QueueName.CALLBACK, defaultQueueOptions);
export const customerWebhookDispatchQueue = new Queue(QueueName.CUSTOMER_WEBHOOK_DISPATCH, defaultQueueOptions);

export function getQueueForPriority(priority: string) {
  switch (priority) {
    case 'critical':
      return criticalDispatchQueue;
    case 'marketing':
      return bulkDispatchQueue;
    default:
      return transactionalDispatchQueue;
  }
}
