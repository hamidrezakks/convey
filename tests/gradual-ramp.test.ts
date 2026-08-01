import { describe, expect, it } from 'bun:test';
import { GradualRampController } from '../src/modules/providers/core/gradual-ramp';

describe('Half-Open Circuit Traffic Ramp Controller', () => {
  it('advances ramp steps and calculates admit percentages correctly', () => {
    const ramp = new GradualRampController();
    const providerId = 'provider_ramp_test';

    const step1 = ramp.advanceRamp(providerId);
    expect(step1.step).toBe(1);
    expect(step1.admitPercentage).toBe(20);

    const step2 = ramp.advanceRamp(providerId);
    expect(step2.step).toBe(2);
    expect(step2.admitPercentage).toBe(50);
  });
});
