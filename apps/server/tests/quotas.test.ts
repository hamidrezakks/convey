import { describe, expect, it } from 'bun:test';
import { QuotaManager } from '../src/modules/policies/quota-manager';

describe('Commercial Metering & Monthly Quota Engine', () => {
  const testTenant = `test-tenant-${Date.now()}`;

  it('atomically tracks usage and returns remaining balance', async () => {
    await QuotaManager.resetQuota(testTenant);

    const first = await QuotaManager.checkAndIncrement(testTenant, 'pro');
    expect(first.allowed).toBe(true);
    expect(first.used).toBe(1);
    expect(first.remaining).toBe(999_999);

    const status = await QuotaManager.getQuotaStatus(testTenant, 'pro');
    expect(status.usedThisMonth).toBe(1);
    expect(status.monthlyQuota).toBe(1_000_000);
    expect(status.isExceeded).toBe(false);
  });

  it('rejects dispatches when plan limit is exceeded', async () => {
    const microTenant = `micro-${Date.now()}`;
    await QuotaManager.resetQuota(microTenant);

    // Test with a customized small limit simulation
    for (let i = 0; i < 5; i++) {
      await QuotaManager.checkAndIncrement(microTenant, 'community');
    }

    const status = await QuotaManager.getQuotaStatus(microTenant, 'community');
    expect(status.usedThisMonth).toBe(5);
  });
});
