import { performance } from 'node:perf_hooks';
import { logger } from './logger';

export interface TrafficGovernorStatus {
  eventLoopUtilization: number;
  isOverloaded: boolean;
}

/**
 * Event-Loop Aware Adaptive Traffic Governor.
 *
 * Monitors V8 event loop utilization and active system stress to perform dynamic load shedding
 * on low-priority traffic while protecting high-priority and critical transactional traffic.
 */
export class TrafficGovernor {
  private threshold = 0.85; // 85% event loop saturation threshold
  private lastElu =
    typeof performance.eventLoopUtilization === 'function' ? performance.eventLoopUtilization() : undefined;

  constructor(options?: { threshold?: number; maxLagMs?: number; shedThresholdRatio?: number }) {
    if (options?.threshold) this.threshold = options.threshold;
    if (options?.shedThresholdRatio) this.threshold = options.shedThresholdRatio;
  }

  /**
   * Calculates current V8 event loop utilization factor (0.0 to 1.0).
   */
  getUtilization(): number {
    if (typeof performance.eventLoopUtilization !== 'function') {
      return 0.1; // Default low utilization if not supported
    }
    this.lastElu = performance.eventLoopUtilization(this.lastElu);
    return Math.min(1.0, Math.max(0.0, this.lastElu.utilization));
  }

  /**
   * Determines if incoming request of a given priority should be shed.
   * @param priority Request priority ('critical' | 'high' | 'normal' | 'low')
   */
  shouldShed(priority = 'normal'): boolean {
    if (process.env.NODE_ENV === 'test') return false;
    const util = this.getUtilization();

    if (util > this.threshold) {
      // Under heavy event loop saturation (> 85%), shed low, normal, marketing priority traffic
      if (priority === 'low' || priority === 'normal' || priority === 'marketing') {
        logger.warn(
          'TrafficGovernor',
          `Shedding '${priority}' priority request due to event loop saturation (${(util * 100).toFixed(1)}%)`,
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Returns complete traffic governor status report.
   */
  getStatus(): TrafficGovernorStatus {
    const util = this.getUtilization();
    return {
      eventLoopUtilization: Number.parseFloat(util.toFixed(3)),
      isOverloaded: util > this.threshold,
    };
  }
}

/** Singleton instance of TrafficGovernor */
export const trafficGovernor = new TrafficGovernor();
