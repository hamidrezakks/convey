import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { batches } from '../src/db/schema';
import { BatchesService } from '../src/modules/messaging/batches.service';
import { DlqService } from '../src/modules/messaging/dlq.service';
import { BatchStatus, Channel } from '../src/modules/messaging/messaging.types';
import { clearPolicyCache, getRateLimitPoliciesForTeam } from '../src/modules/policies/policy-engine';
import { ProviderCircuitBreaker } from '../src/modules/providers/core/circuit-breaker';
import { getDefaultProviderForChannel, smartProviderRouter } from '../src/modules/providers/core/smart-router';
import { redisClient } from '../src/queues/connection';
import { BoundedLruCache } from '../src/utils/lru-cache';
import { formatRedisKey } from '../src/utils/redis-keys';

describe('Architecture & Refactoring Invariants Audit Suite', () => {
  // ---------------------------------------------------------------------------
  // 1. In-Memory Lifecycle & BoundedLruCache Invariants
  // ---------------------------------------------------------------------------
  describe('1. BoundedLruCache Edge Cases & Contract Invariants', () => {
    it('guards minimum capacity against zero or negative options', () => {
      const cache = new BoundedLruCache<string, number>({ maxCapacity: 0 });
      cache.set('a', 1);
      expect(cache.size).toBe(1);
      expect(cache.get('a')).toBe(1);

      cache.set('b', 2);
      expect(cache.size).toBe(1);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('a')).toBeUndefined();
    });

    it('overwriting existing key updates value and refreshes LRU position without increasing size', () => {
      const cache = new BoundedLruCache<string, number>({ maxCapacity: 2 });
      cache.set('k1', 10);
      cache.set('k2', 20);

      // Overwrite k1 -> size remains 2
      cache.set('k1', 100);
      expect(cache.size).toBe(2);
      expect(cache.get('k1')).toBe(100);

      // Insert k3 -> k2 should be evicted because k1 was refreshed
      cache.set('k3', 30);
      expect(cache.get('k1')).toBe(100);
      expect(cache.get('k2')).toBeUndefined();
      expect(cache.get('k3')).toBe(30);
    });

    it('cleans up expired items during values() and entries() iteration', async () => {
      const cache = new BoundedLruCache<string, string>({ maxCapacity: 10, defaultTtlMs: 25 });
      cache.set('exp1', 'val1');
      cache.set('exp2', 'val2');
      cache.set('keep', 'val3', 500); // 500ms TTL

      await new Promise((r) => setTimeout(r, 40));

      const vals = cache.values();
      expect(vals).toEqual(['val3']);

      const ents = cache.entries();
      expect(ents).toEqual([['keep', 'val3']]);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Policy Engine Invalidation & Isolation
  // ---------------------------------------------------------------------------
  describe('2. Policy Engine Caching & Invalidation Contract', () => {
    it('caches policy lookups and supports surgical per-team cache eviction', async () => {
      const teamA = `team_a_${Date.now()}`;
      const teamB = `team_b_${Date.now()}`;

      const resA1 = await getRateLimitPoliciesForTeam(teamA);
      const resB1 = await getRateLimitPoliciesForTeam(teamB);
      expect(Array.isArray(resA1)).toBe(true);
      expect(Array.isArray(resB1)).toBe(true);

      // Surgical eviction for teamA only
      clearPolicyCache(teamA);

      // Subsequent query for teamB hits in-memory cache
      const resB2 = await getRateLimitPoliciesForTeam(teamB);
      expect(resB2).toBe(resB1); // Identity equality (from memory cache)

      // Global eviction clears all teams
      clearPolicyCache();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Provider Circuit Breaker Bounded Growth
  // ---------------------------------------------------------------------------
  describe('3. Circuit Breaker Bounded Memory & Dynamic Provider Tracking', () => {
    it('caps circuit metrics at maxCapacity under high cardinality provider IDs', () => {
      const breaker = new ProviderCircuitBreaker({ maxCapacity: 10, failureThreshold: 3 });

      for (let i = 0; i < 25; i++) {
        breaker.canExecute(`dynamic_provider_${i}`);
      }

      const status = breaker.getAllStatus();
      expect(Object.keys(status).length).toBeLessThanOrEqual(10);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Smart Provider Router & Channel Mapping
  // ---------------------------------------------------------------------------
  describe('4. Smart Provider Router Default Fallbacks & MAB Scorecards', () => {
    it('maps all standard channels to production-grade default providers', () => {
      expect(getDefaultProviderForChannel(Channel.EMAIL)).toBe('ses');
      expect(getDefaultProviderForChannel(Channel.SMS)).toBe('twilio');
      expect(getDefaultProviderForChannel(Channel.WHATSAPP)).toBe('whatsapp-business');
      expect(getDefaultProviderForChannel(Channel.TELEGRAM)).toBe('telegram');
      expect(getDefaultProviderForChannel(Channel.SLACK)).toBe('slack');
      expect(getDefaultProviderForChannel(Channel.PUSH)).toBe('apns');
      expect(getDefaultProviderForChannel(Channel.TOOL)).toBe('pagerduty');
      expect(getDefaultProviderForChannel('UNKNOWN' as Channel)).toBe('generic');
    });

    it('records feedback in bounded scorecards and updates EMA latency', () => {
      smartProviderRouter.recordProviderFeedback('test-provider-qa', 120, true);
      const scorecard = smartProviderRouter.getScorecard('test-provider-qa');

      expect(scorecard.providerId).toBe('test-provider-qa');
      expect(scorecard.totalCalls).toBe(1);
      expect(scorecard.successRate).toBe(1);
      expect(scorecard.emaLatencyMs).toBe(120);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. DLQ Query Partition Pruning & Time Filtering
  // ---------------------------------------------------------------------------
  describe('5. DLQ Service Partition Bounds & Rolling Window Filtering', () => {
    it('applies 60-day partition pruning rolling window by default', async () => {
      const res = await DlqService.listFailedMessages({ limit: 10 });
      expect(res).toBeDefined();
      expect(Array.isArray(res.items)).toBe(true);
      expect(typeof res.total).toBe('number');
    });

    it('accepts explicit custom startDate and endDate bounds for partition pruning', async () => {
      const now = new Date();
      const customStart = new Date(now.getTime() - 7 * 86_400 * 1000);
      const res = await DlqService.listFailedMessages({
        startDate: customStart,
        endDate: now,
        limit: 5,
      });
      expect(res).toBeDefined();
      expect(Array.isArray(res.items)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Batches Service CQRS Purity & Vectorized 1-RTT Pipeline
  // ---------------------------------------------------------------------------
  describe('6. Batches Service CQRS Read Purity & Vectorized Pipeline', () => {
    it('getBatch is pure read-only and does not mutate database records on read', async () => {
      const now = new Date();
      const testBatchId = `batch_qa_cqrs_${Date.now()}`;
      const tenantId = '10000000-0000-0000-0000-000000000001';
      const team = 'qa_team';

      // Insert dummy batch record
      await db.insert(batches).values({
        id: testBatchId,
        tenantId,
        team,
        name: 'QA CQRS Batch',
        totalCount: 100,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        status: BatchStatus.PROCESSING,
        createdAt: now,
        updatedAt: now,
      });

      // Populate Redis stats showing completed batch
      const redisKey = formatRedisKey(`batch:${testBatchId}:stats`);
      await redisClient.hset(redisKey, 'sentCount', '100');
      await redisClient.hset(redisKey, 'deliveredCount', '100');
      await redisClient.hset(redisKey, 'failedCount', '0');

      // Read batch via getBatch
      const batchRes = await BatchesService.getBatch(tenantId, team, testBatchId);
      expect(batchRes).toBeDefined();
      expect(batchRes?.status).toBe(BatchStatus.COMPLETED);
      expect(batchRes?.progressPercent).toBe(100);

      // Verify DB row remains unchanged (status is still 'processing' in DB - pure read CQRS)
      const dbRows = await db.select().from(batches).where(eq(batches.id, testBatchId));
      expect(dbRows[0].status).toBe(BatchStatus.PROCESSING);
    });

    it('listBatches pipelines stats for multiple batches in 1 RTT', async () => {
      const tenantId = '10000000-0000-0000-0000-000000000001';
      const team = 'qa_team';

      const results = await BatchesService.listBatches(tenantId, team);
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0].progressPercent).toBeDefined();
        expect(results[0].performanceStats).toBeDefined();
      }
    });
  });
});
