import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { batches } from '../../db/schema';

import { redisClient } from '../../queues/connection';
import { generateUuidV7 } from '../../utils/id';
import { logger } from '../../utils/logger';
import { formatRedisKey } from '../../utils/redis-keys';
import { BatchStatus, MetricType } from './messaging.types';

export function computeBatchProgressMetrics(
  totalCount: number,
  _sentCount: number,
  deliveredCount: number,
  failedCount: number,
  currentStatus: BatchStatus,
) {
  const processedCount = deliveredCount + failedCount;
  const pendingCount = Math.max(0, totalCount - processedCount);
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((processedCount / totalCount) * 100)) : 0;

  let computedStatus = currentStatus;
  if (currentStatus === BatchStatus.PROCESSING && processedCount >= totalCount && totalCount > 0) {
    computedStatus = failedCount === totalCount ? BatchStatus.FAILED : BatchStatus.COMPLETED;
  }

  return {
    processedCount,
    pendingCount,
    progressPercent,
    computedStatus,
  };
}

export function computeBatchPerformanceStats(
  createdAt: Date,
  _totalCount: number,
  processedCount: number,
  pendingCount: number,
) {
  const nowMs = Date.now();
  const createdMs = new Date(createdAt).getTime();
  const elapsedSeconds = Math.max(1, Math.round((nowMs - createdMs) / 1000));
  const processingRatePerSec = Math.round((processedCount / elapsedSeconds) * 10) / 10;
  const estimatedTimeRemainingSeconds =
    processingRatePerSec > 0 && pendingCount > 0 ? Math.round(pendingCount / processingRatePerSec) : 0;

  return {
    elapsedSeconds,
    processingRatePerSec,
    estimatedTimeRemainingSeconds,
  };
}

export const BatchesService = {
  async createBatch(params: {
    tenantId: string;
    team: string;
    totalCount: number;
    metadata?: Record<string, unknown>;
  }) {
    const id = `batch_${generateUuidV7()}`;
    const now = new Date();

    const [batch] = await db
      .insert(batches)
      .values({
        id,
        tenantId: params.tenantId,
        team: params.team,
        totalCount: params.totalCount,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        status: BatchStatus.PROCESSING,
        metadata: params.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const redisKey = formatRedisKey(`batch:${id}:stats`);
    try {
      const pipeline = redisClient.pipeline();
      pipeline.hmset(redisKey, {
        totalCount: params.totalCount,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
      });
      pipeline.expire(redisKey, 86400 * 7);
      await pipeline.exec();
    } catch (err: unknown) {
      logger.warn('BatchesService', `Redis initialization failed for batch ${id}: ${err}`);
    }

    return batch;
  },

  async recordProgress(batchId: string, metric: MetricType, increment = 1) {
    const redisKey = formatRedisKey(`batch:${batchId}:stats`);
    const fieldMap: Partial<Record<MetricType, string>> = {
      [MetricType.SENT]: 'sentCount',
      [MetricType.DELIVERED]: 'deliveredCount',
      [MetricType.FAILED]: 'failedCount',
    };
    const fieldName = fieldMap[metric];
    if (fieldName) {
      try {
        await redisClient.hincrby(redisKey, fieldName, increment);
      } catch (err: unknown) {
        logger.warn('BatchesService', `Redis progress record failed for batch ${batchId}: ${err}`);
      }
    }
  },

  async getBatch(tenantId: string, team: string, batchId: string) {
    const rows = await db
      .select()
      .from(batches)
      .where(and(eq(batches.id, batchId), eq(batches.tenantId, tenantId), eq(batches.team, team)));

    if (!rows.length) {
      return null;
    }

    const batch = rows[0];
    const redisKey = formatRedisKey(`batch:${batchId}:stats`);
    let redisStats: Record<string, string> | null = null;
    try {
      redisStats = await redisClient.hgetall(redisKey);
    } catch {
      redisStats = null;
    }

    const sentCount = redisStats?.sentCount ? Number.parseInt(redisStats.sentCount, 10) : batch.sentCount;
    const deliveredCount = redisStats?.deliveredCount
      ? Number.parseInt(redisStats.deliveredCount, 10)
      : batch.deliveredCount;
    const failedCount = redisStats?.failedCount ? Number.parseInt(redisStats.failedCount, 10) : batch.failedCount;

    const { processedCount, pendingCount, progressPercent, computedStatus } = computeBatchProgressMetrics(
      batch.totalCount,
      sentCount,
      deliveredCount,
      failedCount,
      batch.status,
    );

    const performanceStats = computeBatchPerformanceStats(
      batch.createdAt,
      batch.totalCount,
      processedCount,
      pendingCount,
    );

    return {
      ...batch,
      sentCount,
      deliveredCount,
      failedCount,
      processedCount,
      pendingCount,
      progressPercent,
      performanceStats,
      status: computedStatus,
    };
  },

  async cancelBatch(tenantId: string, team: string, batchId: string) {
    const now = new Date();
    const [updated] = await db
      .update(batches)
      .set({
        status: BatchStatus.CANCELLED,
        updatedAt: now,
      })
      .where(and(eq(batches.id, batchId), eq(batches.tenantId, tenantId), eq(batches.team, team)))
      .returning();

    if (updated) {
      const redisKey = formatRedisKey(`batch:${batchId}:stats`);
      redisClient.hset(redisKey, 'status', BatchStatus.CANCELLED).catch(() => {});
    }

    return updated ?? null;
  },

  async pauseBatch(tenantId: string, team: string, batchId: string) {
    const now = new Date();
    const [updated] = await db
      .update(batches)
      .set({
        status: BatchStatus.PAUSED,
        updatedAt: now,
      })
      .where(and(eq(batches.id, batchId), eq(batches.tenantId, tenantId), eq(batches.team, team)))
      .returning();

    if (updated) {
      const redisKey = formatRedisKey(`batch:${batchId}:stats`);
      redisClient.hset(redisKey, 'status', BatchStatus.PAUSED).catch(() => {});
    }

    return updated ?? null;
  },

  async resumeBatch(tenantId: string, team: string, batchId: string) {
    const now = new Date();
    const [updated] = await db
      .update(batches)
      .set({
        status: BatchStatus.PROCESSING,
        updatedAt: now,
      })
      .where(and(eq(batches.id, batchId), eq(batches.tenantId, tenantId), eq(batches.team, team)))
      .returning();

    if (updated) {
      const redisKey = formatRedisKey(`batch:${batchId}:stats`);
      redisClient.hset(redisKey, 'status', BatchStatus.PROCESSING).catch(() => {});
    }

    return updated ?? null;
  },

  async listBatches(tenantId: string, team: string) {
    const dbBatches = await db
      .select()
      .from(batches)
      .where(and(eq(batches.tenantId, tenantId), eq(batches.team, team)))
      .orderBy(desc(batches.createdAt))
      .limit(50);

    if (!dbBatches.length) return [];

    // Vectorized 1-RTT pipeline across all batches
    const pipeline = redisClient.pipeline();
    for (const batch of dbBatches) {
      const redisKey = formatRedisKey(`batch:${batch.id}:stats`);
      pipeline.hgetall(redisKey);
    }

    let pipelineResults: Array<[Error | null, unknown]> | null = null;
    try {
      pipelineResults = await pipeline.exec();
    } catch {
      pipelineResults = null;
    }

    return dbBatches.map((batch, index) => {
      const redisStats = (pipelineResults?.[index]?.[1] as Record<string, string>) || null;
      const sentCount = redisStats?.sentCount ? Number.parseInt(redisStats.sentCount, 10) : batch.sentCount;
      const deliveredCount = redisStats?.deliveredCount
        ? Number.parseInt(redisStats.deliveredCount, 10)
        : batch.deliveredCount;
      const failedCount = redisStats?.failedCount ? Number.parseInt(redisStats.failedCount, 10) : batch.failedCount;

      const { processedCount, pendingCount, progressPercent, computedStatus } = computeBatchProgressMetrics(
        batch.totalCount,
        sentCount,
        deliveredCount,
        failedCount,
        batch.status,
      );

      const performanceStats = computeBatchPerformanceStats(
        batch.createdAt,
        batch.totalCount,
        processedCount,
        pendingCount,
      );

      return {
        ...batch,
        sentCount,
        deliveredCount,
        failedCount,
        processedCount,
        pendingCount,
        progressPercent,
        performanceStats,
        status: computedStatus,
      };
    });
  },
};
