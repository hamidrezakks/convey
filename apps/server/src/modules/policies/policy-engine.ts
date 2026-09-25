import { formatCurrencyAmount } from '@convey/shared';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { budgetPolicies, budgetUsage, rateLimitPolicies } from '../../db/schema';
import { redisClient } from '../../queues/connection';
import { BoundedLruCache } from '../../utils/lru-cache';
import { formatRedisKey } from '../../utils/redis-keys';
import type { MessagePriority } from '../messaging/messaging.types';
import { BudgetService } from './budget.service';
import { fxEngine } from './fx-engine';
import { QuietHoursEngine } from './quiet-hours';
import { TokenBucketLimiter, type TokenBucketResult } from './token-bucket';

const CACHE_TTL_MS = 5_000;

const rateLimitCache = new BoundedLruCache<string, Array<typeof rateLimitPolicies.$inferSelect>>({
  maxCapacity: 10_000,
  defaultTtlMs: CACHE_TTL_MS,
});
const budgetPolicyCache = new BoundedLruCache<string, Array<typeof budgetPolicies.$inferSelect>>({
  maxCapacity: 10_000,
  defaultTtlMs: CACHE_TTL_MS,
});

export function clearPolicyCache(team?: string) {
  if (team) {
    rateLimitCache.delete(team);
    budgetPolicyCache.delete(team);
  } else {
    rateLimitCache.clear();
    budgetPolicyCache.clear();
  }
}

export async function getRateLimitPoliciesForTeam(team: string) {
  const cached = rateLimitCache.get(team);
  if (cached) {
    return cached;
  }
  const policies = await db.select().from(rateLimitPolicies).where(eq(rateLimitPolicies.team, team));
  rateLimitCache.set(team, policies);
  return policies;
}

export async function getBudgetPoliciesForTeam(team: string) {
  const cached = budgetPolicyCache.get(team);
  if (cached) {
    return cached;
  }
  const policies = await db.select().from(budgetPolicies).where(eq(budgetPolicies.team, team));
  budgetPolicyCache.set(team, policies);
  return policies;
}

export function findMatchingRateLimitPolicy(
  policies: Array<typeof rateLimitPolicies.$inferSelect>,
  params: { category?: string; country?: string; channel?: string },
) {
  return (
    policies.find(
      (p) =>
        (!p.category || p.category === params.category) &&
        (!p.country || p.country === params.country) &&
        (!p.channel || p.channel === params.channel),
    ) || policies[0]
  );
}

/**
 * Atomically records monthly financial budget usage increments using PostgreSQL native UPSERT.
 *
 * Concurrency & Invariant Guarantees:
 * 1. Zero Duplicate Key Errors: Uses `ON CONFLICT (id) DO UPDATE` to safely handle simultaneous
 *    inserts when multiple worker threads process messages for the same tenant at the start of a month.
 * 2. Zero Lost Updates: Performs arithmetic addition directly at the database engine level
 *    (`budget_usage.used_usd::numeric + amount`), eliminating read-modify-write lost updates.
 * 3. Exact Precision: Casts values to `numeric(12, 4)` to eliminate floating-point rounding errors.
 * 4. Multi-Currency Support: Tracks usage in the team policy's configured currency.
 *
 * @param policyId Unique identifier of the budget policy.
 * @param month Target billing month formatted as YYYY-MM.
 * @param amountInPolicyCurrency Expenditure amount in the policy's currency to add.
 * @param currency Currency code of the policy (e.g. 'USD', 'EUR', 'AED').
 * @param now Current timestamp for updatedAt tracking.
 */
export async function updateMonthlyBudgetUsage(
  policyId: string,
  month: string,
  amountInPolicyCurrency: number,
  currency = 'USD',
  now = new Date(),
): Promise<void> {
  if (!Number.isFinite(amountInPolicyCurrency) || amountInPolicyCurrency < 0)
    throw new Error('Invalid budget usage increment');
  const usageId = `${policyId}_${month}`;
  const amountStr = amountInPolicyCurrency.toFixed(4);

  await db.transaction(async (tx) => {
    const [policy] = await tx.select().from(budgetPolicies).where(eq(budgetPolicies.id, policyId));
    if (!policy || policy.currency !== currency || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      throw new Error('Invalid budget policy, currency or month');
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${policy.team}, 24001))`);
    const rows = await tx
      .select()
      .from(budgetUsage)
      .where(and(eq(budgetUsage.policyId, policyId), eq(budgetUsage.month, month)));
    if (rows.some((row) => row.currency !== currency || row.id !== usageId))
      throw new Error('Budget usage currency or identity mismatch');
    await tx.execute(sql`
      INSERT INTO budget_usage (id, policy_id, month, currency, used_usd, updated_at)
      VALUES (${usageId}, ${policyId}, ${month}, ${currency}, ${amountStr}::numeric, ${now})
      ON CONFLICT (id) DO UPDATE SET
        used_usd = (budget_usage.used_usd + EXCLUDED.used_usd)::numeric(12, 4),
        updated_at = EXCLUDED.updated_at;
    `);
  });
}

export const PolicyEngine = {
  clearCache: clearPolicyCache,

  async checkRateLimit(params: {
    team: string;
    category?: string;
    country?: string;
    channel?: string;
  }): Promise<{ allowed: boolean; policyId?: string; remaining?: number }> {
    const policies = await getRateLimitPoliciesForTeam(params.team);

    if (!policies.length) {
      return { allowed: true };
    }

    const policy = findMatchingRateLimitPolicy(policies, params);

    const redisKey = formatRedisKey(`ratelimit:${policy.id}:${params.team}:${params.channel || 'all'}`);
    const nowMs = Date.now();
    const requestId = `${nowMs}_${Math.random().toString(36).substring(2, 9)}`;

    const luaScript = `
      local windowMs = tonumber(ARGV[2]) * 1000
      local minScore = tonumber(ARGV[1]) - windowMs

      redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', minScore)
      local currentCount = redis.call('ZCARD', KEYS[1])

      if currentCount >= tonumber(ARGV[3]) then
        return { 0, 0 }
      end

      redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
      redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
      return { 1, tonumber(ARGV[3]) - currentCount - 1 }
    `;

    const res = (await redisClient.eval(
      luaScript,
      1,
      redisKey,
      nowMs.toString(),
      policy.windowSeconds.toString(),
      policy.maxRequests.toString(),
      requestId,
    )) as [number, number];

    const allowed = res[0] === 1;
    const remaining = res[1];

    if (!allowed) {
      return {
        allowed: false,
        policyId: policy.id,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      policyId: policy.id,
      remaining,
    };
  },

  async checkTokenBucket(
    teamKey: string,
    capacity = 100,
    refillRatePerSec = 10,
    requested = 1,
  ): Promise<TokenBucketResult> {
    return TokenBucketLimiter.consume(teamKey, capacity, refillRatePerSec, requested);
  },

  async checkBudget(team: string): Promise<{
    allowed: boolean;
    policyId?: string;
    currency?: string;
    usedAmount?: number;
    limitAmount?: number;
    formattedUsed?: string;
    formattedLimit?: string;
    usedUsd?: number;
    limitUsd?: number;
  }> {
    const policy = await BudgetService.get(team);
    if (!policy) return { allowed: true };
    const usedAmount = policy.usedAmount + (policy.reservedAmount ?? 0);
    const limitAmount = policy.monthlyBudget;
    return {
      allowed: !policy.hardStop || usedAmount < limitAmount,
      policyId: policy.id,
      currency: policy.currency,
      usedAmount,
      limitAmount,
      formattedUsed: formatCurrencyAmount(usedAmount, policy.currency),
      formattedLimit: formatCurrencyAmount(limitAmount, policy.currency),
      usedUsd: fxEngine.toUsd(usedAmount, policy.currency),
      limitUsd: fxEngine.toUsd(limitAmount, policy.currency),
    };
  },

  async recordLedger(params: {
    messageId: string;
    team: string;
    amount?: number;
    currency?: string;
    amountUsd?: number;
    channel: string;
    providerId: string;
  }): Promise<void> {
    const charge = await BudgetService.reserve(
      {
        ...params,
        key: JSON.stringify([params.messageId, params.channel, params.providerId, 'accepted']),
        amount: params.amount ?? params.amountUsd ?? Number.NaN,
        currency: params.amount === undefined ? 'USD' : (params.currency ?? 'USD'),
      },
      new Date(),
      false,
    );
    // Settlement is idempotent and can finish a previously interrupted accounting transaction.
    await BudgetService.settle(charge.id, 'committed');
  },

  checkQuietHours(params: {
    country?: string;
    phone?: string;
    priority?: MessagePriority;
    now?: Date;
    quietStartHour?: number;
    quietEndHour?: number;
  }) {
    return QuietHoursEngine.evaluate(params);
  },
};
