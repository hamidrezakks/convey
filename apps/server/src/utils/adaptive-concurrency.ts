import type { Worker } from 'bullmq';
import { logger } from './logger';

export interface AdaptiveConcurrencyConfig {
  minConcurrency?: number; // Minimum worker concurrency floor (default: 2)
  maxConcurrency?: number; // Maximum worker concurrency ceiling (default: 50)
  targetLatencyMs?: number; // Target execution latency threshold (default: 200ms)
  smoothingFactor?: number; // Exponential moving average alpha (default: 0.2)
}

export class AdaptiveConcurrencyController {
  private minConcurrency: number;
  private maxConcurrency: number;
  private targetLatencyMs: number;
  private smoothingFactor: number;
  private currentConcurrency: number;
  private emaLatencyMs = 0;

  constructor(config?: AdaptiveConcurrencyConfig) {
    this.minConcurrency = config?.minConcurrency ?? 2;
    this.maxConcurrency = config?.maxConcurrency ?? 50;
    this.targetLatencyMs = config?.targetLatencyMs ?? 200;
    this.smoothingFactor = config?.smoothingFactor ?? 0.2;
    this.currentConcurrency = Math.min(10, this.maxConcurrency);
  }

  getConcurrency(): number {
    return this.currentConcurrency;
  }

  getEmaLatency(): number {
    return Math.round(this.emaLatencyMs);
  }

  recordExecution(latencyMs: number, worker?: Worker): number {
    if (this.emaLatencyMs === 0) {
      this.emaLatencyMs = latencyMs;
    } else {
      this.emaLatencyMs = this.smoothingFactor * latencyMs + (1 - this.smoothingFactor) * this.emaLatencyMs;
    }

    const previousConcurrency = this.currentConcurrency;

    // Gradient-based scale calculation: target / actual latency
    if (this.emaLatencyMs > this.targetLatencyMs * 1.5) {
      // Latency spike -> scale down concurrency gracefully
      this.currentConcurrency = Math.max(this.minConcurrency, Math.floor(this.currentConcurrency * 0.8));
    } else if (this.emaLatencyMs < this.targetLatencyMs * 0.7 && this.currentConcurrency < this.maxConcurrency) {
      // Latency is low & optimal -> scale up concurrency
      this.currentConcurrency = Math.min(this.maxConcurrency, this.currentConcurrency + 1);
    }

    if (previousConcurrency !== this.currentConcurrency) {
      logger.debug(
        'AdaptiveConcurrency',
        `Adjusted worker concurrency: ${previousConcurrency} -> ${this.currentConcurrency} (EMA Latency: ${Math.round(this.emaLatencyMs)}ms)`,
      );
      if (worker && typeof worker.concurrency === 'number') {
        worker.concurrency = this.currentConcurrency;
      }
    }

    return this.currentConcurrency;
  }
}
