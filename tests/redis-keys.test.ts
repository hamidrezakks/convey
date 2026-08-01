import { describe, expect, test } from 'bun:test';
import { env } from '../src/config/env';
import { formatBullMQPrefix, formatPubSubChannel, formatRedisKey, getRedisKeyPrefix } from '../src/utils/redis-keys';

describe('Redis Key Prefixing Utility', () => {
  test('should return default prefix when env is not set or default', () => {
    const defaultPrefix = getRedisKeyPrefix();
    expect(defaultPrefix).toBe('convey');
  });

  test('should format standard redis key with prefix', () => {
    const formatted = formatRedisKey('idempotency:msg_123');
    expect(formatted).toBe(`${env.REDIS_KEY_PREFIX}:idempotency:msg_123`);
  });

  test('should format BullMQ prefix with hash tags for cluster slot compatibility', () => {
    const bullPrefix = formatBullMQPrefix();
    expect(bullPrefix).toBe(`{${env.REDIS_KEY_PREFIX}}`);
  });

  test('should format PubSub channel names with hash tags', () => {
    const channel = formatPubSubChannel('provider-config-events');
    expect(channel).toBe(`{${env.REDIS_KEY_PREFIX}}:provider-config-events`);
  });
});
