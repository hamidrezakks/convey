import { describe, expect, it } from 'bun:test';
import { DeficitWeightedRoundRobinScheduler, type SLATier } from '../src/utils/drr-scheduler';

describe('DRR Multi-Tenant Fair Scheduler Integration', () => {
  it('1. Fairly allocates slots across enterprise, pro, and free tenants under burst load', () => {
    const scheduler = new DeficitWeightedRoundRobinScheduler<string>();

    // Enqueue 200 tasks from free tenant (weight 5)
    for (let i = 0; i < 200; i++) {
      scheduler.enqueue({
        id: `free_${i}`,
        tenantId: 'free_tenant',
        tier: 'free' as SLATier,
        payload: `free_msg_${i}`,
      });
    }

    // Enqueue 200 tasks from enterprise tenant (weight 100)
    for (let i = 0; i < 200; i++) {
      scheduler.enqueue({
        id: `ent_${i}`,
        tenantId: 'enterprise_tenant',
        tier: 'enterprise' as SLATier,
        payload: `ent_msg_${i}`,
      });
    }

    // Dequeue a batch of 105 tasks
    const batch = scheduler.dequeueBatch(105);

    const enterpriseCount = batch.filter((t) => t.tier === 'enterprise').length;
    const freeCount = batch.filter((t) => t.tier === 'free').length;

    // Enterprise with weight 100 vs Free with weight 5 should get 100:5 allocation
    expect(enterpriseCount).toBe(100);
    expect(freeCount).toBe(5);
    expect(batch.length).toBe(105);
  });
});
