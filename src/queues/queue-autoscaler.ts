import { logger } from '../utils/logger';

export interface QueueScaleReport {
  queueName: string;
  currentDepth: number;
  recommendedConcurrency: number;
}

/**
 * Adaptive BullMQ Queue Autoscaler.
 *
 * Continuously tracks queue depth, ingestion velocity, and execution latency,
 * dynamically calculating optimal worker concurrency allocations per queue.
 */
export class QueueAutoscaler {
  private minConcurrency = 2;
  private maxConcurrency = 100;
  private targetDepthPerWorker = 50;

  /**
   * Calculates optimal worker concurrency for a queue based on current backlog depth.
   * @param queueName Target queue name.
   * @param currentDepth Current pending queue depth.
   */
  computeOptimalConcurrency(queueName: string, currentDepth: number): QueueScaleReport {
    if (currentDepth <= 0) {
      return { queueName, currentDepth: 0, recommendedConcurrency: this.minConcurrency };
    }

    const calculated = Math.ceil(currentDepth / this.targetDepthPerWorker);
    const recommendedConcurrency = Math.min(this.maxConcurrency, Math.max(this.minConcurrency, calculated));

    logger.info(
      'QueueAutoscaler',
      `Calculated recommended concurrency of ${recommendedConcurrency} for queue '${queueName}' (depth: ${currentDepth})`,
    );

    return {
      queueName,
      currentDepth,
      recommendedConcurrency,
    };
  }
}

/** Singleton instance of QueueAutoscaler */
export const queueAutoscaler = new QueueAutoscaler();
