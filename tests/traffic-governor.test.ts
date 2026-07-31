import { describe, expect, it } from 'bun:test';
import { TrafficGovernor } from '../src/utils/traffic-governor';

describe('Event-Loop Aware Adaptive Traffic Governor', () => {
  it('computes utilization and status reports', () => {
    const governor = new TrafficGovernor();
    const status = governor.getStatus();

    expect(status.eventLoopUtilization).toBeGreaterThanOrEqual(0.0);
    expect(status.eventLoopUtilization).toBeLessThanOrEqual(1.0);
    expect(typeof status.isOverloaded).toBe('boolean');
  });

  it('allows normal traffic when system is not overloaded', () => {
    const governor = new TrafficGovernor();
    expect(governor.shouldShed('critical')).toBe(false);
    expect(governor.shouldShed('normal')).toBe(false);
  });
});
