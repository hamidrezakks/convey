import { and, eq, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import { db } from '../../db';
import { suppressions } from '../../db/schema';
import { redisClient } from '../../queues/connection';
import { hashString } from '../../utils/crypto';
import { generateMessageId } from '../../utils/id';
import { normalizeIdentifier } from '../../utils/recipients';
import { formatRedisKey } from '../../utils/redis-keys';

export interface SuppressionOptions {
  team: string;
  limit?: number;
  offset?: number;
  channel?: string;
  category?: string;
  reason?: string;
  search?: string;
}

export const SuppressionsService = {
  async addSuppression(params: {
    team: string;
    identifier: string;
    identifierType?: string;
    reason: string;
    category?: string;
    country?: string;
    channel?: string;
    startsAt?: Date;
    endsAt?: Date;
  }) {
    const id = generateMessageId();
    const identifierType = params.identifierType || (params.identifier.includes('@') ? 'email' : 'phone');
    const normalizedIdentifier = normalizeIdentifier(params.identifier, identifierType);
    const identifierHash = hashString(normalizedIdentifier);

    const channelVal = params.channel || 'ALL';
    const categoryVal = params.category || null;

    // Check for existing record matching team + identifierHash + channel + category for idempotent upsert
    const existing = await db
      .select()
      .from(suppressions)
      .where(
        and(
          eq(suppressions.team, params.team),
          eq(suppressions.identifierHash, identifierHash),
          eq(suppressions.channel, channelVal),
          categoryVal ? eq(suppressions.category, categoryVal) : isNull(suppressions.category),
        ),
      );

    let supp: typeof suppressions.$inferSelect;
    if (existing.length > 0) {
      const [updated] = await db
        .update(suppressions)
        .set({
          reason: params.reason,
          country: params.country ?? existing[0].country,
          startsAt: params.startsAt ?? existing[0].startsAt,
          endsAt: params.endsAt ?? existing[0].endsAt,
        })
        .where(eq(suppressions.id, existing[0].id))
        .returning();
      supp = updated;
    } else {
      const [inserted] = await db
        .insert(suppressions)
        .values({
          id,
          recipient: normalizedIdentifier,
          targetType: 'recipient',
          identifierType,
          identifierHash,
          team: params.team,
          category: categoryVal,
          country: params.country || null,
          channel: channelVal,
          reason: params.reason,
          startsAt: params.startsAt || new Date(),
          endsAt: params.endsAt || null,
        })
        .returning();
      supp = inserted;
    }

    await this.invalidateCache(params.team, identifierHash);
    return supp;
  },

  async bulkAddSuppressions(
    team: string,
    items: Array<{
      identifier: string;
      identifierType?: string;
      reason: string;
      category?: string;
      country?: string;
      channel?: string;
      startsAt?: Date;
      endsAt?: Date;
    }>,
  ) {
    if (items.length === 0) return [];

    const preparedItems = items.map((item) => {
      const id = generateMessageId();
      const identifierType = item.identifierType || (item.identifier.includes('@') ? 'email' : 'phone');
      const normalizedIdentifier = normalizeIdentifier(item.identifier, identifierType);
      const identifierHash = hashString(normalizedIdentifier);
      const channelVal = item.channel || 'ALL';
      const categoryVal = item.category || null;

      return {
        id,
        recipient: normalizedIdentifier,
        targetType: 'recipient',
        identifierType,
        identifierHash,
        team,
        category: categoryVal,
        country: item.country || null,
        channel: channelVal,
        reason: item.reason,
        startsAt: item.startsAt || new Date(),
        endsAt: item.endsAt || null,
      };
    });

    const insertedRecords = await db.insert(suppressions).values(preparedItems).onConflictDoNothing().returning();

    // Redis pipeline invalidation for batch operation efficiency
    const hashesToInvalidate = new Set(preparedItems.map((i) => i.identifierHash));
    const pipeline = redisClient.pipeline();
    for (const hash of hashesToInvalidate) {
      const cacheKey = formatRedisKey(`suppression:${team}:${hash}`);
      pipeline.del(cacheKey);
    }
    await pipeline.exec();

    return insertedRecords.length > 0 ? insertedRecords : preparedItems;
  },

  async isSuppressed(params: {
    team: string;
    identifiers: string[];
    channel?: string;
    category?: string;
  }): Promise<{ suppressed: boolean; suppressionId?: string; reason?: string }> {
    const validIdentifiers = params.identifiers.filter((i) => Boolean(i?.trim()));
    if (validIdentifiers.length === 0) {
      return { suppressed: false };
    }

    // Deduplicate normalized hashes
    const hashSet = new Set<string>();
    for (const raw of validIdentifiers) {
      const type = raw.includes('@') ? 'email' : 'phone';
      hashSet.add(hashString(normalizeIdentifier(raw, type)));
    }
    const hashes = Array.from(hashSet);
    const now = new Date();

    type RuleItem = {
      id: string;
      channel: string | null;
      category: string | null;
      startsAt: string;
      endsAt: string | null;
      reason: string;
    };

    const rulesByHash = new Map<string, RuleItem[]>();
    const cacheKeys = hashes.map((h) => formatRedisKey(`suppression:${params.team}:${h}`));
    const missingHashes: string[] = [];

    // 1. Vectorized MGET from Redis (Single roundtrip for N identifiers)
    try {
      const cachedValues = await redisClient.mget(cacheKeys);
      for (let i = 0; i < hashes.length; i++) {
        const hash = hashes[i];
        const val = cachedValues[i];
        if (val) {
          rulesByHash.set(hash, JSON.parse(val));
        } else {
          missingHashes.push(hash);
        }
      }
    } catch {
      missingHashes.push(...hashes);
    }

    // 2. Vectorized SQL query for cache misses (Single inArray query)
    if (missingHashes.length > 0) {
      const dbRules = await db
        .select()
        .from(suppressions)
        .where(
          and(
            eq(suppressions.team, params.team),
            missingHashes.length === 1
              ? eq(suppressions.identifierHash, missingHashes[0])
              : inArray(suppressions.identifierHash, missingHashes),
          ),
        );

      const rulesMap = new Map<string, typeof dbRules>();
      for (const h of missingHashes) {
        rulesMap.set(h, []);
      }
      for (const r of dbRules) {
        const list = rulesMap.get(r.identifierHash);
        if (list) {
          list.push(r);
        } else {
          rulesMap.set(r.identifierHash, [r]);
        }
      }

      // Vectorized Redis Pipeline cache backfill (Single pipeline)
      const pipeline = redisClient.pipeline();
      for (const [hash, dbList] of rulesMap.entries()) {
        const formattedRules: RuleItem[] = dbList.map((r) => ({
          id: r.id,
          channel: r.channel,
          category: r.category,
          startsAt: r.startsAt.toISOString(),
          endsAt: r.endsAt ? r.endsAt.toISOString() : null,
          reason: r.reason,
        }));
        rulesByHash.set(hash, formattedRules);

        const cacheKey = formatRedisKey(`suppression:${params.team}:${hash}`);
        pipeline.set(cacheKey, JSON.stringify(formattedRules), 'EX', 3600);
      }

      try {
        await pipeline.exec();
      } catch {
        // Ignore pipeline errors gracefully
      }
    }

    // 3. Evaluate rules
    for (const [, rules] of rulesByHash) {
      for (const rule of rules) {
        const startsAt = new Date(rule.startsAt);
        const endsAt = rule.endsAt ? new Date(rule.endsAt) : null;

        // Temporal validity check
        if (now < startsAt) continue;
        if (endsAt && now > endsAt) continue;

        // Channel scoping match
        if (rule.channel && rule.channel !== 'ALL' && params.channel && params.channel !== rule.channel) {
          continue;
        }

        // Category scoping match
        if (rule.category && params.category && rule.category !== params.category) {
          continue;
        }

        return {
          suppressed: true,
          suppressionId: rule.id,
          reason: rule.reason,
        };
      }
    }

    return { suppressed: false };
  },

  async invalidateCache(team: string, identifierHash: string) {
    try {
      const cacheKey = formatRedisKey(`suppression:${team}:${identifierHash}`);
      await redisClient.del(cacheKey);
    } catch {
      // Ignore redis cache error
    }
  },

  async listSuppressions(teamOrOptions: string | SuppressionOptions) {
    const opts: SuppressionOptions = typeof teamOrOptions === 'string' ? { team: teamOrOptions } : teamOrOptions;

    const limit = Math.min(opts.limit || 50, 100);
    const offset = opts.offset || 0;

    const conditions = [eq(suppressions.team, opts.team)];

    if (opts.channel) {
      conditions.push(eq(suppressions.channel, opts.channel));
    }
    if (opts.category) {
      conditions.push(eq(suppressions.category, opts.category));
    }
    if (opts.reason) {
      conditions.push(eq(suppressions.reason, opts.reason));
    }
    if (opts.search) {
      const searchPattern = `%${opts.search}%`;
      const searchHash = hashString(normalizeIdentifier(opts.search));
      const searchConds: SQL[] = [
        eq(suppressions.identifierHash, searchHash),
        ilike(suppressions.reason, searchPattern),
      ];
      const recipientCond = ilike(suppressions.recipient, searchPattern);
      if (recipientCond) {
        searchConds.push(recipientCond);
      }
      const combinedSearch = or(...searchConds);
      if (combinedSearch) {
        conditions.push(combinedSearch);
      }
    }

    const whereClause = and(...conditions);

    const data = await db
      .select()
      .from(suppressions)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${suppressions.createdAt} DESC`);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(suppressions).where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    return {
      suppressions: data,
      total,
      limit,
      offset,
    };
  },

  async findSuppressionByIdentifier(team: string, identifier: string) {
    const identifierHash = hashString(normalizeIdentifier(identifier));
    const records = await db
      .select()
      .from(suppressions)
      .where(and(eq(suppressions.team, team), eq(suppressions.identifierHash, identifierHash)));
    return records[0] || null;
  },

  async deleteSuppression(team: string, id: string) {
    const existing = await db
      .select()
      .from(suppressions)
      .where(and(eq(suppressions.id, id), eq(suppressions.team, team)));

    if (existing.length === 0) {
      return false;
    }

    const item = existing[0];
    await db.delete(suppressions).where(and(eq(suppressions.id, id), eq(suppressions.team, team)));
    await this.invalidateCache(team, item.identifierHash);

    return true;
  },
};
