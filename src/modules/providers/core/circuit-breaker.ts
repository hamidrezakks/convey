import { redisClient } from '../../../queues/connection';
import { logger } from '../../../utils/logger';
import { BoundedLruCache } from '../../../utils/lru-cache';
import { formatPubSubChannel, formatRedisKey } from '../../../utils/redis-keys';
import { gradualRampController } from './gradual-ramp';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitMetrics {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime?: number;
  lastStateChange: number;
}

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Consecutive failures to trip circuit (default: 5)
  resetTimeoutMs?: number; // Time in OPEN state before transitioning to HALF_OPEN (default: 30000ms)
  maxCapacity?: number;
}

export class ProviderCircuitBreaker {
  private circuits: BoundedLruCache<string, CircuitMetrics>;
  private failureThreshold: number;
  private resetTimeoutMs: number;

  constructor(config?: CircuitBreakerConfig) {
    this.failureThreshold = config?.failureThreshold ?? 5;
    this.resetTimeoutMs = config?.resetTimeoutMs ?? 30_000;
    this.circuits = new BoundedLruCache<string, CircuitMetrics>({
      maxCapacity: config?.maxCapacity ?? 5000,
    });
  }

  private getMetrics(providerId: string): CircuitMetrics {
    let metrics = this.circuits.get(providerId);
    if (!metrics) {
      metrics = {
        state: CircuitState.CLOSED,
        consecutiveFailures: 0,
        lastStateChange: Date.now(),
      };
      this.circuits.set(providerId, metrics);
    }
    return metrics;
  }

  canExecute(providerId: string): boolean {
    const metrics = this.getMetrics(providerId);
    const now = Date.now();

    if (metrics.state === CircuitState.CLOSED) {
      return true;
    }

    if (metrics.state === CircuitState.OPEN) {
      if (now - metrics.lastStateChange >= this.resetTimeoutMs) {
        metrics.state = CircuitState.HALF_OPEN;
        metrics.lastStateChange = now;
        logger.info(
          'CircuitBreaker',
          `Circuit for provider '${providerId}' transitioned from OPEN to HALF_OPEN (Probing)`,
        );
        return gradualRampController.shouldAdmitTraffic(providerId);
      }
      return false;
    }

    if (metrics.state === CircuitState.HALF_OPEN) {
      return gradualRampController.shouldAdmitTraffic(providerId);
    }

    return true;
  }

  setLocalState(providerId: string, state: CircuitState): void {
    const metrics = this.getMetrics(providerId);
    metrics.state = state;
    metrics.lastStateChange = Date.now();
    if (state === CircuitState.CLOSED) {
      metrics.consecutiveFailures = 0;
      gradualRampController.resetRamp(providerId);
    }
  }

  recordSuccess(providerId: string): void {
    const metrics = this.getMetrics(providerId);
    if (metrics.state === CircuitState.HALF_OPEN) {
      gradualRampController.advanceRamp(providerId);
    } else if (metrics.state !== CircuitState.CLOSED) {
      gradualRampController.resetRamp(providerId);
      logger.info('CircuitBreaker', `Circuit for provider '${providerId}' recovered and reset to CLOSED state`);
    }
    metrics.state = CircuitState.CLOSED;
    metrics.consecutiveFailures = 0;
    metrics.lastStateChange = Date.now();
    redisClient.del(formatRedisKey(`circuit:${providerId}`)).catch(() => {});
    redisClient
      .publish(formatPubSubChannel('circuit:events'), JSON.stringify({ providerId, state: CircuitState.CLOSED }))
      .catch(() => {});
  }

  recordFailure(providerId: string, isPermanent = false): void {
    const metrics = this.getMetrics(providerId);
    const now = Date.now();
    metrics.consecutiveFailures += 1;
    metrics.lastFailureTime = now;

    // Permanent configuration errors or reaching failure threshold trip the circuit immediately
    if (isPermanent || metrics.consecutiveFailures >= this.failureThreshold) {
      if (metrics.state !== CircuitState.OPEN) {
        metrics.state = CircuitState.OPEN;
        metrics.lastStateChange = now;
        gradualRampController.resetRamp(providerId);
        logger.warn(
          'CircuitBreaker',
          `Circuit TRIPPED to OPEN for provider '${providerId}' after ${metrics.consecutiveFailures} failures. Auto-fast-failing traffic for ${this.resetTimeoutMs}ms.`,
        );
        const ttlSeconds = Math.max(1, Math.ceil(this.resetTimeoutMs / 1000));
        redisClient.set(formatRedisKey(`circuit:${providerId}`), 'OPEN', 'EX', ttlSeconds).catch(() => {});
        redisClient
          .publish(formatPubSubChannel('circuit:events'), JSON.stringify({ providerId, state: CircuitState.OPEN }))
          .catch(() => {});
      }
    }
  }

  async syncProviderCircuitState(providerId: string): Promise<CircuitState> {
    try {
      const state = await redisClient.get(formatRedisKey(`circuit:${providerId}`));
      if (state === 'OPEN') {
        this.setLocalState(providerId, CircuitState.OPEN);
        return CircuitState.OPEN;
      }
    } catch {}
    return this.getState(providerId);
  }

  getState(providerId: string): CircuitState {
    const metrics = this.getMetrics(providerId);
    if (metrics.state === CircuitState.OPEN && Date.now() - metrics.lastStateChange >= this.resetTimeoutMs) {
      metrics.state = CircuitState.HALF_OPEN;
      metrics.lastStateChange = Date.now();
    }
    return metrics.state;
  }

  getAllStatus(): Record<string, { state: CircuitState; consecutiveFailures: number }> {
    const result: Record<string, { state: CircuitState; consecutiveFailures: number }> = {};
    for (const [providerId, metrics] of this.circuits.entries()) {
      result[providerId] = {
        state: metrics.state,
        consecutiveFailures: metrics.consecutiveFailures,
      };
    }
    return result;
  }

  getCounts(): { closed: number; open: number; halfOpen: number } {
    let closed = 0;
    let open = 0;
    let halfOpen = 0;

    for (const metrics of this.circuits.values()) {
      if (metrics.state === CircuitState.CLOSED) closed++;
      else if (metrics.state === CircuitState.OPEN) open++;
      else if (metrics.state === CircuitState.HALF_OPEN) halfOpen++;
    }

    return { closed, open, halfOpen };
  }

  getOpenCircuitProviders(): string[] {
    const results: string[] = [];
    for (const [providerId, metrics] of this.circuits.entries()) {
      if (metrics.state === CircuitState.OPEN) {
        results.push(providerId);
      }
    }
    return results;
  }
}

export const providerCircuitBreaker = new ProviderCircuitBreaker();
