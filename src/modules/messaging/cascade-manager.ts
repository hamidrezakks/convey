import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import { messageAttempts, messageEvents, messages } from '../../db/schema';
import { redisClient } from '../../queues/connection';
import { fallbackRetryQueue } from '../../queues/queue-definitions';
import { generateMessageId } from '../../utils/id';
import { logger } from '../../utils/logger';
import { formatRedisKey } from '../../utils/redis-keys';
import { computePartitionWindow } from './messaging.service';
import {
  AttemptState,
  type CascadeConfig,
  type CascadeStep,
  EventSource,
  EventType,
  JobName,
  MessageState,
} from './messaging.types';

export interface CascadeJobData {
  publicId: string;
  stepIndex: number;
}

const CANCEL_KEY_PREFIX = 'cascade:cancel:';
const STATE_KEY_PREFIX = 'cascade:state:';

export const CascadeManager = {
  /**
   * Generates Redis key for tracking cascade cancellation.
   */
  getCancelKey(publicId: string): string {
    return formatRedisKey(`${CANCEL_KEY_PREFIX}${publicId}`);
  },

  /**
   * Generates Redis key for tracking current cascade execution state.
   */
  getStateKey(publicId: string): string {
    return formatRedisKey(`${STATE_KEY_PREFIX}${publicId}`);
  },

  /**
   * Marks a cascade as short-circuited/cancelled in Redis.
   */
  async cancelRemainingSteps(publicId: string): Promise<void> {
    try {
      const cancelKey = this.getCancelKey(publicId);
      const stateKey = this.getStateKey(publicId);
      const pipeline = redisClient.pipeline();
      pipeline.set(cancelKey, 'cancelled', 'EX', 86400); // 24h TTL
      pipeline.hset(stateKey, 'state', 'short_circuited', 'cancelledAt', new Date().toISOString());
      pipeline.expire(stateKey, 86400);
      await pipeline.exec();
      logger.info('CascadeManager', `Cascade execution cancelled/short-circuited for message '${publicId}'`);
    } catch (err) {
      logger.warn('CascadeManager', `Error flagging cascade cancellation in Redis: ${(err as Error).message}`);
    }
  },

  /**
   * Checks whether a cascade has been short-circuited by a client delivery receipt.
   */
  async isCancelled(publicId: string): Promise<boolean> {
    try {
      const cancelKey = this.getCancelKey(publicId);
      const res = await redisClient.get(cancelKey);
      return res === 'cancelled';
    } catch {
      return false;
    }
  },

  /**
   * Alias for isCancelled to check short-circuit status.
   */
  async isShortCircuited(publicId: string): Promise<boolean> {
    return await this.isCancelled(publicId);
  },

  /**
   * Schedules execution of Step N in BullMQ with a delay (waitForReceiptMs).
   */
  async scheduleNextStep(publicId: string, nextStepIndex: number, delayMs: number): Promise<void> {
    const jobData: CascadeJobData = {
      publicId,
      stepIndex: nextStepIndex,
    };

    await fallbackRetryQueue.add(JobName.PROCESS_CASCADE_STEP, jobData, {
      delay: delayMs,
      jobId: `cascade_${publicId}_step_${nextStepIndex}`,
      removeOnComplete: true,
      removeOnFail: false,
    });

    try {
      const stateKey = this.getStateKey(publicId);
      await redisClient.hset(
        stateKey,
        'currentStep',
        String(nextStepIndex),
        'scheduledAt',
        new Date(Date.now() + delayMs).toISOString(),
      );
      await redisClient.expire(stateKey, 86400);
    } catch {
      // non-blocking
    }

    logger.info('CascadeManager', `Scheduled cascade Step ${nextStepIndex} for message '${publicId}' in ${delayMs}ms`);
  },

  /**
   * Executes a scheduled cascade step after verifying delivery short-circuiting.
   */
  async executeStep(
    publicId: string,
    stepIndex: number,
    onStepExecute?: (step: CascadeStep) => Promise<void> | void,
  ): Promise<boolean> {
    // 1. Check if short-circuited in Redis
    if (await this.isCancelled(publicId)) {
      logger.info(
        'CascadeManager',
        `Skipping cascade Step ${stepIndex} for message '${publicId}': short-circuited by recipient delivery`,
      );
      return false;
    }

    // 2. Fetch message from DB with partition boundary
    const { startDate, endDate } = computePartitionWindow(publicId);
    const partitionWhere = and(
      eq(messages.publicId, publicId),
      gte(messages.createdAt, startDate),
      lte(messages.createdAt, endDate),
    );

    const msgList = await db.select().from(messages).where(partitionWhere);
    if (!msgList.length) {
      logger.warn('CascadeManager', `Message '${publicId}' not found for cascade step execution`);
      return false;
    }

    const msg = msgList[0];
    const metadata = msg.metadata as { cascade?: CascadeConfig } | undefined;
    const cascade = metadata?.cascade;

    if (!cascade || !Array.isArray(cascade.steps) || !cascade.steps.length) {
      return false;
    }

    // 3. Verify message state in DB - if delivered/opened/read or matching trigger condition, evaluate short-circuit
    const attempts = await db
      .select()
      .from(messageAttempts)
      .where(
        and(
          eq(messageAttempts.messageId, publicId),
          gte(messageAttempts.createdAt, startDate),
          lte(messageAttempts.createdAt, endDate),
        ),
      );
    const hasDelivered = attempts.some((a) => a.state === AttemptState.DELIVERED);
    const hasOpened = attempts.some((a) => a.state === AttemptState.OPENED || a.state === AttemptState.READ);

    const step: CascadeStep | undefined = cascade.steps[stepIndex];
    const trigger = step?.triggerOn || step?.condition || 'if_unopened';

    const shouldShortCircuit =
      (trigger === 'if_unopened' && hasOpened) ||
      (trigger === 'if_undelivered' && (hasDelivered || hasOpened)) ||
      msg.state === MessageState.DELIVERED ||
      msg.state === MessageState.OPENED ||
      msg.state === MessageState.READ;

    if (shouldShortCircuit) {
      await this.cancelRemainingSteps(publicId);
      await db.insert(messageEvents).values({
        id: generateMessageId(),
        messageId: publicId,
        type: EventType.CASCADE_SHORT_CIRCUITED,
        source: EventSource.SYSTEM,
        metadata: {
          stepIndex,
          reason: hasOpened ? 'message_opened_by_recipient' : 'message_already_delivered',
          triggerCondition: trigger,
        },
        occurredAt: new Date(),
        createdAt: new Date(),
      });
      return false;
    }

    if (!step) {
      // Cascade exhausted
      await db.insert(messageEvents).values({
        id: generateMessageId(),
        messageId: publicId,
        type: EventType.CASCADE_EXHAUSTED,
        source: EventSource.SYSTEM,
        metadata: { totalSteps: cascade.steps.length },
        occurredAt: new Date(),
        createdAt: new Date(),
      });
      logger.info('CascadeManager', `Cascade exhausted for message '${publicId}' after ${cascade.steps.length} steps`);
      return false;
    }

    // 4. Record step initiated event
    await db.insert(messageEvents).values({
      id: generateMessageId(),
      messageId: publicId,
      channel: step.channel,
      type: EventType.CASCADE_STEP_INITIATED,
      source: EventSource.SYSTEM,
      metadata: {
        stepIndex,
        channel: step.channel,
        waitForReceiptMs: step.waitForReceiptMs,
      },
      occurredAt: new Date(),
      createdAt: new Date(),
    });

    if (onStepExecute) {
      await onStepExecute(step);
    }

    // 5. Schedule subsequent step if available
    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < cascade.steps.length) {
      const waitMs = step.waitForReceiptMs || 30000;
      await this.scheduleNextStep(publicId, nextStepIndex, waitMs);
    }

    logger.info('CascadeManager', `Dispatched cascade Step ${stepIndex} (${step.channel}) for message '${publicId}'`);
    return true;
  },

  async executeCascadeStep(
    publicId: string,
    stepIndex: number,
    onStepExecute?: (step: CascadeStep) => Promise<void> | void,
  ): Promise<boolean> {
    return await this.executeStep(publicId, stepIndex, onStepExecute);
  },
};
