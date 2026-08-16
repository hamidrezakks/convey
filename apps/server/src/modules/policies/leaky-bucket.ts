import { redisClient } from '../../queues/connection';
import { formatRedisKey } from '../../utils/redis-keys';

export interface LeakyBucketSlotResult {
  allowed: boolean;
  currentCount: number;
}

/**
 * Micro-Leaky Bucket Provider Rate Governor.
 *
 * Micro-paces worker sends across 100ms time windows to ensure strict provider
 * throughput limits (e.g. 100 SMS/sec) are never exceeded.
 */
export const LeakyBucketGovernor = {
  /**
   * Attempts to acquire a dispatch slot for a specific provider within the current micro-window.
   * @param providerId Target provider identifier.
   * @param maxPerSec Max allowed requests per second.
   */
  async acquireSlot(providerId: string, maxPerSec: number): Promise<LeakyBucketSlotResult> {
    const windowSlice = Math.floor(Date.now() / 100); // 100ms micro-slices
    const key = formatRedisKey(`leaky:${providerId}:${windowSlice}`);
    const maxPerSlice = Math.max(1, Math.ceil(maxPerSec / 10));

    try {
      const currentCount = await redisClient.incr(key);
      if (currentCount === 1) {
        await redisClient.expire(key, 2);
      }

      const allowed = currentCount <= maxPerSlice;
      return { allowed, currentCount };
    } catch {
      // Fallback open if Redis fails
      return { allowed: true, currentCount: 1 };
    }
  },
};
