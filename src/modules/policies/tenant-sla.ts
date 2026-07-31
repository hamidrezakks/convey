import { logger } from '../../utils/logger';
import { MessagePriority, TenantTier } from '../messaging/messaging.types';

/**
 * Tenant SLA configuration rules.
 */
export interface TenantSlaConfig {
  /** Target p95 latency threshold in milliseconds (default: 500ms) */
  targetLatencyP95Ms?: number;
  /** Service tier level */
  tier?: TenantTier;
}

/**
 * Real-Time Tenant SLA & Priority Scheduler.
 *
 * Tracks per-tenant delivery percentiles (p50, p95, p99) and dynamically elevates
 * outbox queue priority for Enterprise tenants approaching SLA breach limits.
 */
export class TenantSlaManager {
  private tenantLatencies = new Map<string, number[]>();
  private maxSamples = 100;

  /**
   * Records an end-to-end message delivery latency sample for a tenant.
   * @param tenantId Tenant identifier.
   * @param latencyMs Measured delivery duration in milliseconds.
   */
  recordDeliveryLatency(tenantId: string, latencyMs: number): void {
    let samples = this.tenantLatencies.get(tenantId);
    if (!samples) {
      samples = [];
      this.tenantLatencies.set(tenantId, samples);
    }

    samples.push(latencyMs);
    if (samples.length > this.maxSamples) {
      samples.shift();
    }
  }

  /**
   * Calculates p50, p95, and p99 delivery latency percentiles for a tenant.
   * @param tenantId Tenant identifier.
   */
  getPercentiles(tenantId: string): { p50: number; p95: number; p99: number } {
    const samples = this.tenantLatencies.get(tenantId);
    if (!samples || !samples.length) {
      return { p50: 50, p95: 100, p99: 200 };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { p50, p95, p99 };
  }

  /**
   * Recommends optimal outbox priority based on tier SLAs and current p95 latency.
   * @param tenantId Tenant identifier.
   * @param tier Tenant subscription tier (TenantTier).
   * @param basePriority Initial priority assigned to message payload.
   */
  getRecommendedPriority(
    tenantId: string,
    tier: TenantTier = TenantTier.PRO,
    basePriority: MessagePriority = MessagePriority.NORMAL,
  ): string {
    const { p95 } = this.getPercentiles(tenantId);

    // If Enterprise tenant's p95 latency approaches 400ms SLA breach threshold, elevate priority
    if (tier === TenantTier.ENTERPRISE && p95 > 350) {
      logger.info('TenantSlaManager', `Elevating outbox priority for Enterprise tenant '${tenantId}' (p95: ${p95}ms)`);
      return basePriority === MessagePriority.NORMAL ? 'high' : 'critical';
    }

    return basePriority;
  }
}

/** Singleton instance of TenantSlaManager */
export const tenantSlaManager = new TenantSlaManager();
