import { describe, expect, it } from 'bun:test';
import { SelfHealingEngine } from '../src/modules/providers/core/self-healing';

describe('Autonomous Canary Probe & Self-Healing Engine', () => {
  it('executes synthetic probe successfully', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.executeSyntheticProbe('test_provider_probe');

    expect(result.providerId).toBe('test_provider_probe');
    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThan(0);
  });
});
