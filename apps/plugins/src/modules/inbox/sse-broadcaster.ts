import { RedisClient } from 'bun';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let client: RedisClient | null = null;

try {
  client = new RedisClient(redisUrl);
} catch {
  client = null;
}

export const SseBroadcaster = {
  /**
   * Publishes an in-app notification event to Redis PubSub for real-time SSE stream delivery.
   */
  async broadcastNotification(
    tenantId: string,
    recipientId: string,
    notification: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (client) {
        const channel = `inbox:events:${tenantId}:${recipientId}`;
        await client.publish(channel, JSON.stringify(notification));
      }
    } catch {
      // In-memory or offline fallback
    }
  },
};
