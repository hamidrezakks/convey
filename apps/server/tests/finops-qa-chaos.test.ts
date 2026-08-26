import { describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';
import { CarrierCostMatrix } from '../src/modules/policies/carrier-cost-matrix';
import { QuotaManager } from '../src/modules/policies/quota-manager';
import { providerCircuitBreaker } from '../src/modules/providers/core/circuit-breaker';

describe('QA Chaos & Resiliency: FinOps Routing & Quotas Engine', () => {
  describe('1. Global Country Code Resolution Edge Cases', () => {
    it('handles exotic international prefix formats and unusual delimiters', () => {
      expect(CarrierCostMatrix.extractCountryCode('+44 7911 123456')).toBe('+44');
      expect(CarrierCostMatrix.extractCountryCode('0049 151 23456789')).toBe('+49');
      expect(CarrierCostMatrix.extractCountryCode('+971-50-123-4567')).toBe('+971');
      expect(CarrierCostMatrix.extractCountryCode('+91 (987) 654-3210')).toBe('+91');
      expect(CarrierCostMatrix.extractCountryCode('invalid_phone')).toBe('+1'); // Safe default
      expect(CarrierCostMatrix.extractCountryCode('')).toBe('+1');
    });
  });

  describe('2. Least-Cost Carrier Failover under Downstream Outage', () => {
    it('falls back to secondary provider when lowest-cost provider is circuit-tripped', () => {
      // Normal state: Telnyx is lowest cost for US ($0.0040)
      const normalEval = CarrierCostMatrix.evaluateLeastCostRouting(Channel.SMS, '+14155552671', [
        'telnyx',
        'plivo',
        'twilio',
      ]);
      expect(normalEval?.selectedProviderId).toBe('telnyx');

      // Trip Telnyx circuit breaker (simulate 5 consecutive downstream 500/504 errors)
      for (let i = 0; i < 5; i++) {
        providerCircuitBreaker.recordFailure('telnyx');
      }

      // Evaluated routing should now gracefully bypass Telnyx and select Plivo ($0.0050)
      const failoverEval = CarrierCostMatrix.evaluateLeastCostRouting(Channel.SMS, '+14155552671', [
        'telnyx',
        'plivo',
        'twilio',
      ]);
      expect(failoverEval?.selectedProviderId).toBe('plivo');

      // Reset circuit breaker for cleanliness
      providerCircuitBreaker.recordSuccess('telnyx');
    });
  });

  describe('3. Multi-Tenant Concurrent Quota Exhaustion', () => {
    it('handles 200 concurrent worker threads decrementing monthly quota atomically', async () => {
      const tenant = `stress-tenant-${Date.now()}`;
      await QuotaManager.resetQuota(tenant);

      // Execute 200 concurrent checkAndIncrement operations
      const workerOperations = Array.from({ length: 200 }, () => QuotaManager.checkAndIncrement(tenant, 'pro'));

      const results = await Promise.all(workerOperations);
      expect(results.every((r) => r.allowed)).toBe(true);

      const status = await QuotaManager.getQuotaStatus(tenant, 'pro');
      expect(status.usedThisMonth).toBe(200);
      expect(status.remainingThisMonth).toBe(999_800);
    });
  });
});
