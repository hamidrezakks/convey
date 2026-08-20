import { describe, expect, it } from 'bun:test';
import { DlqFailureCategory, type DlqReplayResult } from '@convey/shared';

function calculateBlastRadius(
  messageCount: number,
  category: DlqFailureCategory,
  circuitHealthPercent: number,
): DlqReplayResult['simulation'] {
  const estimatedCost = messageCount * 0.0003;
  const estimatedSeconds = Math.max(0.5, Number((messageCount * 0.025).toFixed(1)));
  const successRate = circuitHealthPercent > 90 ? 98.5 : 65.0;
  const riskLevel = category === DlqFailureCategory.PROVIDER_5XX && circuitHealthPercent < 90 ? 'HIGH' : 'LOW';

  return {
    estimatedSuccessRatePercent: successRate,
    estimatedApiCostUsd: Number(estimatedCost.toFixed(4)),
    estimatedExecutionTimeSeconds: estimatedSeconds,
    affectedTenantsCount: Math.min(messageCount, 3),
    riskLevel,
  };
}

describe('DLQ Blast Radius Simulation Logic Test Suite', () => {
  it('predicts low risk when provider circuits are healthy', () => {
    const sim = calculateBlastRadius(84, DlqFailureCategory.PROVIDER_5XX, 100);
    expect(sim?.riskLevel).toBe('LOW');
    expect(sim?.estimatedSuccessRatePercent).toBe(98.5);
    expect(sim?.estimatedApiCostUsd).toBe(0.0252);
    expect(sim?.affectedTenantsCount).toBe(3);
  });

  it('predicts high risk when provider circuits are degraded', () => {
    const sim = calculateBlastRadius(100, DlqFailureCategory.PROVIDER_5XX, 50);
    expect(sim?.riskLevel).toBe('HIGH');
    expect(sim?.estimatedSuccessRatePercent).toBe(65.0);
  });
});
