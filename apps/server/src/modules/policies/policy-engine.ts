import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { budgetLedger, budgetPolicies, budgetUsage, rateLimitPolicies } from '../../db/schema';
import { redisClient } from '../../queues/connection';
import { getUtcMonthString } from '../../utils/date';
import { generateMessageId } from '../../utils/id';
import { BoundedLruCache } from '../../utils/lru-cache';
import { formatRedisKey } from '../../utils/redis-keys';
import type { MessagePriority } from '../messaging/messaging.types';
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
 *    (`budget_usage.used_usd::numeric + amountUsd`), eliminating read-modify-write lost updates.
 * 3. Exact Precision: Casts values to `numeric(12, 4)` to eliminate floating-point rounding errors.
 *
 * @param policyId Unique identifier of the budget policy.
 * @param month Target billing month formatted as YYYY-MM.
 * @param amountUsd Expenditure amount in USD to add.
 * @param now Current timestamp for updatedAt tracking.
 */
export async function updateMonthlyBudgetUsage(
  policyId: string,
  month: string,
  amountUsd: number,
  now: Date,
): Promise<void> {
  const usageId = `${policyId}_${month}`;
  const amountStr = amountUsd.toFixed(4);

  await db.execute(sql`
    INSERT INTO budget_usage (id, policy_id, month, used_usd, updated_at)
    VALUES (${usageId}, ${policyId}, ${month}, ${amountStr}::numeric, ${now})
    ON CONFLICT (id) DO UPDATE SET
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

  async checkBudget(
    team: string,
  ): Promise<{ allowed: boolean; policyId?: string; usedUsd?: number; limitUsd?: number }> {
    const policies = await getBudgetPoliciesForTeam(team);

    if (!policies.length) {
      return { allowed: true };
    }

    const policy = policies[0];
    const month = getUtcMonthString();

    const usageRecords = await db
      .select()
      .from(budgetUsage)
      .where(and(eq(budgetUsage.policyId, policy.id), eq(budgetUsage.month, month)));

    const usedUsd = usageRecords.length ? Number.parseFloat(usageRecords[0].usedUsd) : 0;
    const limitUsd = Number.parseFloat(policy.monthlyBudgetUsd);

    if (usedUsd >= limitUsd && policy.hardStop === 'true') {
      return {
        allowed: false,
        policyId: policy.id,
        usedUsd,
        limitUsd,
      };
    }

    return {
      allowed: true,
      policyId: policy.id,
      usedUsd,
      limitUsd,
    };
  },

  async recordLedger(params: {
    messageId: string;
    team: string;
    amountUsd: number;
    channel: string;
    providerId: string;
  }): Promise<void> {
    const now = new Date();
    const month = getUtcMonthString(now);
    const ledgerId = generateMessageId();

    await db.insert(budgetLedger).values({
      id: ledgerId,
      messageId: params.messageId,
      team: params.team,
      amountUsd: params.amountUsd.toFixed(4),
      channel: params.channel,
      providerId: params.providerId,
      createdAt: now,
    });

    const policies = await getBudgetPoliciesForTeam(params.team);
    if (policies.length) {
      await updateMonthlyBudgetUsage(policies[0].id, month, params.amountUsd, now);
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
