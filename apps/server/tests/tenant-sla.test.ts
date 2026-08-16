import { describe, expect, it } from 'bun:test';
import { MessagePriority, TenantTier } from '../src/modules/messaging/messaging.types';
import { TenantSlaManager } from '../src/modules/policies/tenant-sla';

describe('Real-Time Tenant SLA & Priority Scheduler', () => {
  it('tracks percentiles and elevates priority when SLA latency degrades', () => {
    const slaManager = new TenantSlaManager();
    const tenantId = 'ent_tenant_1';

    // Record baseline low latencies
    for (let i = 0; i < 20; i++) {
      slaManager.recordDeliveryLatency(tenantId, 50);
    }

    expect(slaManager.getPercentiles(tenantId).p95).toBe(50);
    expect(slaManager.getRecommendedPriority(tenantId, TenantTier.ENTERPRISE, MessagePriority.NORMAL)).toBe(
      MessagePriority.NORMAL,
    );

    // Simulate high latencies causing p95 spike > 350ms
    for (let i = 0; i < 80; i++) {
      slaManager.recordDeliveryLatency(tenantId, 450);
    }

    expect(slaManager.getPercentiles(tenantId).p95).toBe(450);
    expect(slaManager.getRecommendedPriority(tenantId, TenantTier.ENTERPRISE, MessagePriority.NORMAL)).toBe('high');
  });
});
