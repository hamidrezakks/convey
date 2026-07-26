import { env } from '../config/env';

/**
 * Returns the configured Redis key prefix.
 */
export function getRedisKeyPrefix(): string {
  return env.REDIS_KEY_PREFIX || 'convey';
}

/**
 * Formats a standard application key with the configured Redis prefix.
 * e.g., formatRedisKey('idempotency:123') -> 'convey:idempotency:123'
 */
export function formatRedisKey(key: string): string {
  const prefix = getRedisKeyPrefix();
  return `${prefix}:${key}`;
}

/**
 * Formats BullMQ queue key prefix with cluster hash-tags.
 * e.g., formatBullMQPrefix() -> '{convey}'
 */
export function formatBullMQPrefix(): string {
  const prefix = getRedisKeyPrefix();
  return `{${prefix}}`;
}

/**
 * Formats PubSub channel names with cluster hash-tags.
 * e.g., formatPubSubChannel('provider-config-events') -> '{convey}:provider-config-events'
 */
export function formatPubSubChannel(channel: string): string {
  const prefix = getRedisKeyPrefix();
  return `{${prefix}}:${channel}`;
}
