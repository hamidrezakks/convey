import { logger } from './logger';

export interface ChaosConfig {
  enabled?: boolean;
  latencyMinMs?: number;
  latencyMaxMs?: number;
  failureRate?: number; // 0.0 to 1.0 (e.g. 0.05 = 5% simulated failure)
}

export class ChaosEngine {
  private enabled: boolean;
  private latencyMinMs: number;
  private latencyMaxMs: number;
  private failureRate: number;

  constructor(config?: ChaosConfig) {
    this.enabled = config?.enabled ?? process.env.ENABLE_CHAOS_ENGINE === 'true';
    this.latencyMinMs = config?.latencyMinMs ?? 50;
    this.latencyMaxMs = config?.latencyMaxMs ?? 300;
    this.failureRate = config?.failureRate ?? 0.05;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  configure(config: Partial<ChaosConfig>): void {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.latencyMinMs !== undefined) this.latencyMinMs = config.latencyMinMs;
    if (config.latencyMaxMs !== undefined) this.latencyMaxMs = config.latencyMaxMs;
    if (config.failureRate !== undefined) this.failureRate = config.failureRate;
  }

  async executeFaultInjection(target: string): Promise<void> {
    if (!this.enabled) return;

    // 1. Latency Injection
    if (this.latencyMaxMs > 0) {
      const delay = Math.floor(Math.random() * (this.latencyMaxMs - this.latencyMinMs + 1)) + this.latencyMinMs;
      logger.debug('ChaosEngine', `Injecting artificial latency of ${delay}ms for target '${target}'`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // 2. Failure Rate Injection
    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      logger.warn('ChaosEngine', `Injecting simulated chaos failure for target '${target}'`);
      throw new Error(`[ChaosEngine] Injected transient fault for '${target}'`);
    }
  }
}

export const chaosEngine = new ChaosEngine();
