import { describe, expect, it } from 'bun:test';
import { ChaosEngine } from '../src/utils/chaos-engine';

describe('Chaos Resiliency & Fault Injection Engine', () => {
  it('does not inject faults when disabled', async () => {
    const engine = new ChaosEngine({ enabled: false, failureRate: 1.0 });
    expect(engine.isEnabled()).toBe(false);

    await expect(engine.executeFaultInjection('test_target')).resolves.toBeUndefined();
  });

  it('injects artificial latency and failures when enabled', async () => {
    const engine = new ChaosEngine({ enabled: true, latencyMinMs: 10, latencyMaxMs: 20, failureRate: 1.0 });
    expect(engine.isEnabled()).toBe(true);

    const start = performance.now();
    await expect(engine.executeFaultInjection('test_target')).rejects.toThrow('[ChaosEngine]');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(9);
  });
});
