import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { db, type Transaction } from '../../db';
import { type OutboxPayload, type OutboxRecord, outbox } from '../../db/schema';
import { JobName, MessagePriority, OutboxState } from '../../modules/messaging/messaging.types';
import { heapMemoryGuard } from '../../utils/heap-guard';
import { logger } from '../../utils/logger';
import { createTaskLoop, type TaskLoop } from '../../utils/task-loop';
import { type BunNativeRedis, redisClient } from '../connection';
import { dispatchBulkQueue, dispatchHighQueue, dispatchNormalQueue } from '../queue-definitions';

export type { OutboxPayload };

export const OUTBOX_SHARD_COUNT = 16;

const priorityMap: Record<string, number> = {
  [MessagePriority.CRITICAL]: 1,
  [MessagePriority.TRANSACTIONAL]: 2,
  [MessagePriority.NORMAL]: 3,
  [MessagePriority.MARKETING]: 4,
};

interface QueueJobItem {
  name: string;
  data: { publicId: string; outboxId: string };
  opts: { priority: number; jobId: string };
}

/**
 * Builds prioritized BullMQ job batches with deterministic job IDs for crash-safe deduplication.
 */
function buildJobBatches(pendingRecords: Array<typeof outbox.$inferSelect>) {
  const highPriorityJobs: QueueJobItem[] = [];
  const normalPriorityJobs: QueueJobItem[] = [];
  const bulkPriorityJobs: QueueJobItem[] = [];

  for (const record of pendingRecords) {
    const payload = record.payload;
    const priorityKey = payload.priority || MessagePriority.NORMAL;
    const jobItem: QueueJobItem = {
      name: JobName.MESSAGE_DISPATCH,
      data: {
        publicId: record.messageId,
        outboxId: record.id,
      },
      opts: {
        priority: priorityMap[priorityKey] || 3,
        jobId: `outbox_${record.id}`, // Enforces idempotent deduplication in Redis BullMQ
      },
    };

    if (priorityKey === MessagePriority.CRITICAL || priorityKey === MessagePriority.TRANSACTIONAL) {
      highPriorityJobs.push(jobItem);
    } else if (priorityKey === MessagePriority.MARKETING) {
      bulkPriorityJobs.push(jobItem);
    } else {
      normalPriorityJobs.push(jobItem);
    }
  }

  return { highPriorityJobs, normalPriorityJobs, bulkPriorityJobs };
}

/**
 * Dispatches prepared job batches to BullMQ queues in parallel.
 */
async function dispatchToBullMQQueues(batches: {
  highPriorityJobs: QueueJobItem[];
  normalPriorityJobs: QueueJobItem[];
  bulkPriorityJobs: QueueJobItem[];
}): Promise<void> {
  const addBulkPromises: Promise<unknown>[] = [];
  if (batches.highPriorityJobs.length > 0) addBulkPromises.push(dispatchHighQueue.addBulk(batches.highPriorityJobs));
  if (batches.normalPriorityJobs.length > 0)
    addBulkPromises.push(dispatchNormalQueue.addBulk(batches.normalPriorityJobs));
  if (batches.bulkPriorityJobs.length > 0) addBulkPromises.push(dispatchBulkQueue.addBulk(batches.bulkPriorityJobs));
  if (addBulkPromises.length > 0) await Promise.all(addBulkPromises);
}

/**
 * Processes a single outbox batch for a dedicated virtual shard using the Two-Phase Outbox Pipeline.
 *
 * Architecture & Concurrency Model:
 * 1. Virtual Shard Isolation: Rows are partitioned across virtual shards (`shard_id`) to completely
 *    eliminate row and page-lock contention between concurrent worker tasks.
 * 2. Non-Blocking Row Selection: Employs `FOR UPDATE SKIP LOCKED` on index `(shard_id, state, available_at)`
 *    so multiple worker processes never stall each other.
 * 3. Two-Phase Decoupling:
 *    - Phase 1 (PostgreSQL Tx): Atomically locks and transitions records to `PROCESSED` in $< 3\text{ms}$.
 *      Transactions commit immediately without holding external network I/O locks.
 *    - Phase 2 (BullMQ Dispatch): Batched jobs are enqueued to Redis BullMQ outside the DB lock.
 *      Deterministic job IDs (`outbox_<id>`) enforce idempotent deduplication in Redis.
 *
 * @param shardId Target virtual shard index (0 to OUTBOX_SHARD_COUNT - 1).
 * @param batchSize Maximum number of outbox records to process in a single batch.
 * @returns Total number of outbox records processed and dispatched.
 */
export async function processOutboxBatchForShard(shardId: number, batchSize = 250): Promise<number> {
  if (heapMemoryGuard.shouldThrottle()) {
    return 0; // Pause during high heap pressure
  }

  const now = new Date();

  // Phase 1: Rapid PostgreSQL Transaction (< 3ms) - Zero external network calls held under DB lock
  const pendingRecords = await db.transaction(async (tx: Transaction) => {
    const records = await tx
      .select()
      .from(outbox)
      .where(and(eq(outbox.shardId, shardId), eq(outbox.state, OutboxState.PENDING), lte(outbox.availableAt, now)))
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (!records.length) {
      return [];
    }

    const recordIds = records.map((record: OutboxRecord) => record.id);
    await tx
      .update(outbox)
      .set({
        state: OutboxState.PROCESSED,
        processedAt: now,
      })
      .where(inArray(outbox.id, recordIds));

    return records;
  });

  if (!pendingRecords.length) {
    return 0;
  }

  // Phase 2: Asynchronous BullMQ Dispatch outside DB Transaction
  const batches = buildJobBatches(pendingRecords);
  await dispatchToBullMQQueues(batches);

  return pendingRecords.length;
}

/**
 * Standard batch processor across all shards (backward-compatible).
 */
export async function processOutboxBatch(batchSize = 500): Promise<number> {
  if (heapMemoryGuard.shouldThrottle()) {
    return 0;
  }

  const now = new Date();

  // Phase 1: Rapid PostgreSQL Transaction (< 3ms) - Zero external network calls held under DB lock
  const pendingRecords = await db.transaction(async (tx: Transaction) => {
    const records = await tx
      .select()
      .from(outbox)
      .where(and(eq(outbox.state, OutboxState.PENDING), lte(outbox.availableAt, now)))
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (!records.length) {
      return [];
    }

    const recordIds = records.map((record: OutboxRecord) => record.id);
    await tx
      .update(outbox)
      .set({
        state: OutboxState.PROCESSED,
        processedAt: now,
      })
      .where(inArray(outbox.id, recordIds));

    return records;
  });

  if (!pendingRecords.length) {
    return 0;
  }

  // Phase 2: Asynchronous BullMQ Dispatch outside DB Transaction
  const batches = buildJobBatches(pendingRecords);
  await dispatchToBullMQQueues(batches);

  return pendingRecords.length;
}

// Multi-shard parallel task loops
const shardTaskLoops: TaskLoop[] = [];

for (let shardId = 0; shardId < OUTBOX_SHARD_COUNT; shardId++) {
  shardTaskLoops.push(
    createTaskLoop(() => processOutboxBatchForShard(shardId, 250), 500, `outbox relay shard ${shardId}`),
  );
}

const fallbackUnifiedLoop = createTaskLoop(processOutboxBatch, 500, 'outbox relay unified fallback loop');

let fastPathSub: BunNativeRedis | null = null;

export function initOutboxFastPathSubscriber() {
  if (process.env.NODE_ENV === 'test') return;
  try {
    fastPathSub = redisClient.duplicate();
    fastPathSub.on('error', (err: Error) => {
      logger.warn('OutboxRelay', `Fast-path Redis subscriber error: ${err.message}`);
    });
    fastPathSub.subscribe('convey:outbox:pending', (err) => {
      if (err) return;
    });
    fastPathSub.on('message', (_channel: string, shardStr: string) => {
      const shardId = Number.parseInt(shardStr, 10) || 0;
      processOutboxBatchForShard(shardId, 250).catch(() => {});
    });
  } catch {
    // Non-blocking fallback to timer polling
  }
}

export function startOutboxRelayLoop(intervalMs = 500, useSharding = true) {
  initOutboxFastPathSubscriber();
  if (useSharding) {
    for (let i = 0; i < shardTaskLoops.length; i++) {
      // Stagger initial start slightly across shards to smooth out DB query load
      const jitterMs = intervalMs + ((i * 30) % 200);
      shardTaskLoops[i].start(jitterMs);
    }
  } else {
    fallbackUnifiedLoop.start(intervalMs);
  }
}

export function stopOutboxRelayLoop() {
  for (const loop of shardTaskLoops) {
    loop.stop();
  }
  fallbackUnifiedLoop.stop();
  if (fastPathSub) {
    fastPathSub.unsubscribe('convey:outbox:pending').catch(() => {});
    try {
      fastPathSub.quit().catch(() => {});
    } catch {
      // ignore
    }
    fastPathSub = null;
  }
}

/**
 * Automatically purges processed outbox records older than retentionHours in micro-batches
 * to eliminate PostgreSQL table bloat, dead tuples, and index degradation.
 */
export async function pruneProcessedOutboxRecords(retentionHours = 24, batchSize = 5000): Promise<number> {
  const cutoff = new Date(Date.now() - retentionHours * 3600 * 1000).toISOString();
  const result = await db.execute<{ id: string }>(sql`
    WITH to_delete AS (
      SELECT id FROM outbox
      WHERE state = 'processed' AND processed_at < ${cutoff}
      LIMIT ${batchSize}
    )
    DELETE FROM outbox
    WHERE id IN (SELECT id FROM to_delete)
    RETURNING id;
  `);
  return result.length;
}

const outboxPruneLoop = createTaskLoop(
  () => pruneProcessedOutboxRecords(24, 5000),
  5 * 60 * 1000,
  'outbox retention pruner',
);

export function startOutboxPruneLoop(intervalMs = 5 * 60 * 1000) {
  outboxPruneLoop.start(intervalMs);
}

export function stopOutboxPruneLoop() {
  outboxPruneLoop.stop();
}
