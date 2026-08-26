import type { TenantQuotaDto } from '@convey/shared';
import { redisClient } from '../../queues/connection';

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export const PLAN_LIMITS: Record<string, number> = {
  community: 100_000_000, // Self-hosted host bound
  pro: 1_000_000, // 1M messages / mo
  enterprise: 100_000_000, // 100M+ messages / mo
};

export const QuotaManager = {
  getQuotaKey(tenantId: string, date: Date = new Date()): string {
    const yearMonth = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return `quota:usage:${tenantId}:${yearMonth}`;
  },

  /**
   * Fast-path check and atomic increment of monthly message quota.
   */
  async checkAndIncrement(
    tenantId: string,
    plan: 'community' | 'pro' | 'enterprise' = 'pro',
  ): Promise<{ used: number; remaining: number; allowed: boolean }> {
    const key = this.getQuotaKey(tenantId);
    const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.pro;

    const used = await redisClient.incr(key);

    // Set TTL to 35 days on first write
    if (used === 1) {
      await redisClient.expire(key, 35 * 86400);
    }

    if (used > limit) {
      throw new QuotaExceededError(
        `Monthly message quota of ${limit.toLocaleString()} exceeded for plan "${plan}". Current usage: ${used.toLocaleString()}`,
      );
    }

    return {
      used,
      remaining: Math.max(0, limit - used),
      allowed: true,
    };
  },

  /**
   * Retrieves current monthly usage and quota status.
   */
  async getQuotaStatus(tenantId: string, plan: 'community' | 'pro' | 'enterprise' = 'pro'): Promise<TenantQuotaDto> {
    const key = this.getQuotaKey(tenantId);
    const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.pro;

    const rawUsed = await redisClient.get(key);
    const usedThisMonth = rawUsed ? Number.parseInt(rawUsed, 10) : 0;
    const remainingThisMonth = Math.max(0, limit - usedThisMonth);
    const quotaPercentUsed = limit > 0 ? (usedThisMonth / limit) * 100 : 0;

    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    return {
      tenantId,
      plan,
      monthlyQuota: limit,
      usedThisMonth,
      remainingThisMonth,
      quotaPercentUsed: Number(quotaPercentUsed.toFixed(2)),
      isExceeded: usedThisMonth >= limit,
      renewsAt: nextMonth.toISOString(),
    };
  },

  /**
   * Resets quota key (useful for testing or administrative top-ups).
   */
  async resetQuota(tenantId: string): Promise<void> {
    const key = this.getQuotaKey(tenantId);
    await redisClient.del(key);
  },
};
