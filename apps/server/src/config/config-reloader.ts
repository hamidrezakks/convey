import { redisClient } from '../queues/connection';
import { logger } from '../utils/logger';
import { formatPubSubChannel } from '../utils/redis-keys';

export interface DynamicConfigState {
  maxWorkerConcurrency?: number;
  circuitResetTimeoutMs?: number;
  rateLimitWindowMs?: number;
}

/**
 * Zero-Downtime Dynamic Configuration Hot-Reloader.
 *
 * Listens to Redis PubSub configuration updates (`convey:config:updates`) and hot-reloads
 * runtime parameters in memory without restarting worker loops or dropping connections.
 */
export class DynamicConfigReloader {
  private currentConfig: DynamicConfigState = {
    maxWorkerConcurrency: 50,
    circuitResetTimeoutMs: 30000,
    rateLimitWindowMs: 60000,
  };

  /**
   * Returns the current in-memory dynamic configuration state.
   */
  getConfig(): DynamicConfigState {
    return { ...this.currentConfig };
  }

  /**
   * Updates in-memory dynamic configuration state and broadcasts to cluster nodes via PubSub.
   * @param partial New config updates to apply.
   */
  async updateConfig(partial: Partial<DynamicConfigState>): Promise<DynamicConfigState> {
    this.currentConfig = { ...this.currentConfig, ...partial };
    logger.info('ConfigReloader', 'Hot-reloaded in-memory configuration', { ...this.currentConfig });

    try {
      await redisClient.publish(formatPubSubChannel('config:updates'), JSON.stringify(this.currentConfig));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ConfigReloader', 'Failed to publish config update to PubSub', error);
    }

    return this.currentConfig;
  }

  /**
   * Applies inbound PubSub configuration payload to local in-memory state.
   * @param rawJson Serialized config JSON string.
   */
  applyRemoteUpdate(rawJson: string): void {
    try {
      const parsed = JSON.parse(rawJson) as Partial<DynamicConfigState>;
      this.currentConfig = { ...this.currentConfig, ...parsed };
      logger.info('ConfigReloader', 'Applied remote PubSub config update', { ...this.currentConfig });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ConfigReloader', 'Invalid PubSub config JSON payload', error);
    }
  }
}

/** Singleton instance of DynamicConfigReloader */
export const dynamicConfigReloader = new DynamicConfigReloader();
