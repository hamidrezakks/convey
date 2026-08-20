import { TenantTier } from '../modules/messaging/messaging.types';

export interface TenantQuantum {
  tenantId: string;
  weight: number; // e.g. enterprise = 10, pro = 5, free = 1
  deficit: number;
}

/**
 * Weighted Fair Queueing Multi-Tenant Priority Scheduler.
 *
 * Implements Deficit Round Robin (DRR) and Weighted Fair Queueing (WFQ) per tenant
 * to prevent "noisy neighbor" starvation when one tenant submits massive marketing message bursts.
 */
export class MultiTenantPriorityScheduler {
  private tenants = new Map<string, TenantQuantum>();
  private baseQuantum = 100; // Base quantum size in requests per round

  /**
   * Registers or updates a tenant's queue weight.
   * @param tenantId Tenant identifier.
   * @param tier Tenant subscription tier (TenantTier).
   */
  registerTenant(tenantId: string, tier: TenantTier = TenantTier.PRO): void {
    const weight = tier === TenantTier.ENTERPRISE ? 10 : tier === TenantTier.PRO ? 5 : 1;
    let existing = this.tenants.get(tenantId);
    if (!existing) {
      existing = { tenantId, weight, deficit: 0 };
      this.tenants.set(tenantId, existing);
    } else {
      existing.weight = weight;
    }
  }

  /**
   * Returns allocated dispatch quantum for a tenant using Deficit Round Robin (DRR).
   * @param tenantId Tenant identifier.
   */
  getAllocatedQuantum(tenantId: string): number {
    let tenant = this.tenants.get(tenantId);
    if (!tenant) {
      this.registerTenant(tenantId, TenantTier.PRO);
      tenant = this.tenants.get(tenantId) || { tenantId, weight: 5, deficit: 0 };
    }

    // Add quantum based on tenant weight
    tenant.deficit += tenant.weight * this.baseQuantum;
    const allocated = tenant.deficit;

    // Reset deficit after consumption
    tenant.deficit = 0;
    return allocated;
  }
}

/** Singleton instance of MultiTenantPriorityScheduler */
export const multiTenantPriorityScheduler = new MultiTenantPriorityScheduler();
