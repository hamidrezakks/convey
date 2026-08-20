import { describe, expect, it } from 'bun:test';
import { TenantTier } from '../src/modules/messaging/messaging.types';
import { MultiTenantPriorityScheduler } from '../src/queues/multi-tenant-scheduler';

describe('Weighted Fair Queueing Multi-Tenant Priority Scheduler', () => {
  it('allocates quantum proportionally based on tenant tier weights', () => {
    const scheduler = new MultiTenantPriorityScheduler();

    scheduler.registerTenant('ent_1', TenantTier.ENTERPRISE); // weight 10
    scheduler.registerTenant('pro_1', TenantTier.PRO); // weight 5
    scheduler.registerTenant('free_1', TenantTier.FREE); // weight 1

    const entQuantum = scheduler.getAllocatedQuantum('ent_1');
    const proQuantum = scheduler.getAllocatedQuantum('pro_1');
    const freeQuantum = scheduler.getAllocatedQuantum('free_1');

    expect(entQuantum).toBe(1000);
    expect(proQuantum).toBe(500);
    expect(freeQuantum).toBe(100);
  });
});
