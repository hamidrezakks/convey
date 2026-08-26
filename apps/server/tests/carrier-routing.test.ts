import { describe, expect, it } from 'bun:test';
import { CarrierCostMatrix } from '../src/modules/policies/carrier-cost-matrix';

describe('FinOps Least-Cost Carrier & Geo-Routing Matrix', () => {
  it('extracts country code correctly from diverse E.164 phone numbers', () => {
    expect(CarrierCostMatrix.extractCountryCode('+14155552671')).toBe('+1');
    expect(CarrierCostMatrix.extractCountryCode('+447911123456')).toBe('+44');
    expect(CarrierCostMatrix.extractCountryCode('+4915123456789')).toBe('+49');
    expect(CarrierCostMatrix.extractCountryCode('+971501234567')).toBe('+971');
    expect(CarrierCostMatrix.extractCountryCode('+919876543210')).toBe('+91');
    expect(CarrierCostMatrix.extractCountryCode('+5511987654321')).toBe('+55');
  });

  it('selects lowest-cost provider for US destinations (+1)', () => {
    const evaluation = CarrierCostMatrix.evaluateLeastCostRouting('sms', '+14155552671', [
      'twilio',
      'telnyx',
      'plivo',
      'sinch',
    ]);

    expect(evaluation).not.toBeNull();
    expect(evaluation?.countryCode).toBe('+1');
    expect(evaluation?.selectedProviderId).toBe('telnyx'); // Telnyx is $0.0040 vs Twilio $0.0079
    expect(evaluation?.estimatedCostUsd).toBe(0.004);
    expect(evaluation?.projectedSavingsUsd).toBeCloseTo(0.0039, 4);
    expect(evaluation?.fallbackCascade).toContain('plivo');
    expect(evaluation?.fallbackCascade).toContain('sinch');
    expect(evaluation?.fallbackCascade).toContain('twilio');
  });

  it('selects lowest-cost provider for UK destinations (+44)', () => {
    const evaluation = CarrierCostMatrix.evaluateLeastCostRouting('sms', '+447911123456', [
      'twilio',
      'telnyx',
      'sinch',
      'infobip',
    ]);

    expect(evaluation).not.toBeNull();
    expect(evaluation?.countryCode).toBe('+44');
    expect(evaluation?.selectedProviderId).toBe('telnyx'); // Telnyx is $0.0320 vs Twilio $0.0450
    expect(evaluation?.estimatedCostUsd).toBe(0.032);
    expect(evaluation?.projectedSavingsUsd).toBeCloseTo(0.013, 4);
  });

  it('returns rate cards catalog with high coverage', () => {
    const rates = CarrierCostMatrix.getRateCards();
    expect(rates.length).toBeGreaterThanOrEqual(10);
    expect(rates.some((r) => r.countryCode === '+971')).toBe(true);
    expect(rates.some((r) => r.countryCode === '+91')).toBe(true);
  });
});
