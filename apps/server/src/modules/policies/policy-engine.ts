import { formatCurrencyAmount } from '@convey/shared';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { budgetLedger, budgetPolicies, budgetUsage, rateLimitPolicies } from '../../db/schema';
import { redisClient } from '../../queues/connection';
import { getUtcMonthString } from '../../utils/date';
import { generateMessageId } from '../../utils/id';
import { BoundedLruCache } from '../../utils/lru-cache';
import { formatRedisKey } from '../../utils/redis-keys';
import type { MessagePriority } from '../messaging/messaging.types';
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
  const usageId = `${policyId}_${month}`;
  const amountStr = amountInPolicyCurrency.toFixed(4);

  await db.execute(sql`
    INSERT INTO budget_usage (id, policy_id, month, currency, used_usd, updated_at)
    VALUES (${usageId}, ${policyId}, ${month}, ${currency}, ${amountStr}::numeric, ${now})
    ON CONFLICT (id) DO UPDATE SET
      currency = EXCLUDED.currency,
      used_usd = (budget_usage.used_usd + EXCLUDED.used_usd)::numeric(12, 4),
      updated_at = EXCLUDED.updated_at;
  `);
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
    const policies = await getBudgetPoliciesForTeam(team);

    if (!policies.length) {
      return { allowed: true };
    }

    const policy = policies[0];
    const month = getUtcMonthString();
    const policyCurrency = (policy.currency || 'USD').toUpperCase();

    const usageRecords = await db
      .select()
      .from(budgetUsage)
      .where(and(eq(budgetUsage.policyId, policy.id), eq(budgetUsage.month, month)));

    const usedAmount = usageRecords.length ? Number.parseFloat(usageRecords[0].usedUsd) : 0;
    const limitAmount = Number.parseFloat(policy.monthlyBudgetUsd);

    const usedUsd = fxEngine.toUsd(usedAmount, policyCurrency);
    const limitUsd = fxEngine.toUsd(limitAmount, policyCurrency);

    if (usedAmount >= limitAmount && policy.hardStop === 'true') {
      return {
        allowed: false,
        policyId: policy.id,
        currency: policyCurrency,
        usedAmount,
        limitAmount,
        formattedUsed: formatCurrencyAmount(usedAmount, policyCurrency),
        formattedLimit: formatCurrencyAmount(limitAmount, policyCurrency),
        usedUsd,
        limitUsd,
      };
    }

    return {
      allowed: true,
      policyId: policy.id,
      currency: policyCurrency,
      usedAmount,
      limitAmount,
      formattedUsed: formatCurrencyAmount(usedAmount, policyCurrency),
      formattedLimit: formatCurrencyAmount(limitAmount, policyCurrency),
      usedUsd,
      limitUsd,
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
    const now = new Date();
    const month = getUtcMonthString(now);
    const ledgerId = generateMessageId();

    const providerCurrency = (params.currency || 'USD').toUpperCase();
    const originalAmount = params.amount ?? params.amountUsd ?? 0.005;

    // Resolve team policy to determine policy currency
    const policies = await getBudgetPoliciesForTeam(params.team);
    const policyCurrency = policies.length ? (policies[0].currency || 'USD').toUpperCase() : 'USD';

    // High-precision FX conversion
    const fxResult = fxEngine.convert(originalAmount, providerCurrency, policyCurrency);
    const exchangeRate = fxResult.exchangeRate;
    const amountInPolicyCurrency = fxResult.convertedAmount;
    const amountUsd = fxResult.amountUsd;

    await db.insert(budgetLedger).values({
      id: ledgerId,
      messageId: params.messageId,
      team: params.team,
      amountUsd: amountUsd.toFixed(4),
      currency: providerCurrency,
      exchangeRate: exchangeRate.toFixed(8),
      amountInPolicyCurrency: amountInPolicyCurrency.toFixed(4),
      channel: params.channel,
      providerId: params.providerId,
      createdAt: now,
    });

    if (policies.length) {
      await updateMonthlyBudgetUsage(policies[0].id, month, amountInPolicyCurrency, policyCurrency, now);
    }
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
