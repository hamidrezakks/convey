import { queryClient } from '../db';
import { stopPartitionMaintenanceLoop } from '../db/partitions';
import { stopProviderSelfHealingLoop } from '../modules/providers/core/provider-registry';
import { ReportingService, stopMetricsFlusher } from '../modules/reports/reporting.service';
import { redisClient } from '../queues/connection';
import { closeAllProviderQueues } from '../queues/provider-queues';
import { callbackWorker } from '../queues/workers/callback.worker';
import { customerWebhookWorker } from '../queues/workers/customer-webhook-dispatch.worker';
import { fallbackRetryWorker } from '../queues/workers/fallback-retry.worker';
import {
  messageDispatchBulkWorker,
  messageDispatchHighWorker,
  messageDispatchNormalWorker,
  messageDispatchWorker,
} from '../queues/workers/message-dispatch.worker';
import { stopOutboxPruneLoop, stopOutboxRelayLoop } from '../queues/workers/outbox-relay.worker';
import { providerSendWorker } from '../queues/workers/provider-send.worker';
import { stopScheduledPromoterLoop } from '../queues/workers/scheduled-promoter.worker';
import { webhookIngestWorker } from '../queues/workers/webhook-ingest.worker';
import { logger } from './logger';
import { ComponentStatus, WorkerState, appReadiness } from './readiness';

export interface ShutdownOptions {
  drainTimeoutMs?: number;
  closeConnections?: boolean;
}

export class GracefulShutdownOrchestrator {
  private isShuttingDown = false;
  private drainTimeoutMs: number;
  private closeConnections: boolean;

  constructor(options?: ShutdownOptions) {
    this.drainTimeoutMs = options?.drainTimeoutMs ?? 10_000;
    this.closeConnections = options?.closeConnections ?? true;
  }

  registerSignalListeners(): void {
    const handleSignal = (signal: string) => {
      logger.info('Shutdown', `Received OS signal: ${signal}. Initiating 5-stage graceful shutdown sequence...`);
      this.shutdown()
        .then(() => {
          logger.info('Shutdown', 'Graceful shutdown completed successfully. Exiting process.');
          process.exit(0);
        })
        .catch((err) => {
          logger.error('Shutdown', `Error during graceful shutdown: ${(err as Error).message}`, err as Error);
          process.exit(1);
        });
    };

    process.once('SIGTERM', () => handleSignal('SIGTERM'));
    process.once('SIGINT', () => handleSignal('SIGINT'));
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    // Stage 1: Mark app un-ready to stop incoming traffic from load balancers
    appReadiness.setReady(false);
    logger.info('Shutdown', '[Stage 1/5] Updated readiness status to false (Stopped accepting new traffic)');

    // Stage 2: Stop background scheduled task loops & maintenance workers
    stopOutboxRelayLoop();
    stopOutboxPruneLoop();
    stopScheduledPromoterLoop();
    stopPartitionMaintenanceLoop();
    stopProviderSelfHealingLoop();
    stopMetricsFlusher();
    appReadiness.setActiveWorker('outboxRelay', WorkerState.STOPPED);
    appReadiness.setActiveWorker('scheduledPromoter', WorkerState.STOPPED);
    appReadiness.setActiveWorker('providerSelfHealing', WorkerState.STOPPED);
    logger.info('Shutdown', '[Stage 2/5] Stopped all background polling, maintenance, and flusher loops');

    // Stage 3: Close and drain BullMQ workers cleanly
    logger.info('Shutdown', '[Stage 3/5] Draining in-flight BullMQ jobs across all workers...');
    await Promise.allSettled([
      messageDispatchWorker.close(),
      messageDispatchHighWorker.close(),
      messageDispatchNormalWorker.close(),
      messageDispatchBulkWorker.close(),
      providerSendWorker.close(),
      webhookIngestWorker.close(),
      fallbackRetryWorker.close(),
      callbackWorker.close(),
      customerWebhookWorker.close(),
      closeAllProviderQueues(),
    ]);

    // Stage 4: Flush buffered metrics
    await ReportingService.flush().catch(() => {});
    logger.info('Shutdown', '[Stage 4/5] Flushed pending metric buffers');

    // Stage 5: Gracefully close Redis client & PostgreSQL connection pools
    if (this.closeConnections) {
      try {
        await redisClient.quit();
      } catch {}

      try {
        await queryClient.end();
        appReadiness.setDbStatus(ComponentStatus.DISCONNECTED);
      } catch {}
      logger.info('Shutdown', '[Stage 5/5] Closed Redis client and PostgreSQL database connection pools cleanly');
    }
  }
}

export const shutdownOrchestrator = new GracefulShutdownOrchestrator();
