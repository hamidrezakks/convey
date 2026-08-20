import { describe, expect, it } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { CostOptimizationEngine } from '../src/modules/policies/cost-optimizer';

describe('Predictive Unit-Cost Router & Budget Optimizer', () => {
  it('estimates unit costs and optimizes channel fallback sequence', () => {
    const optimizer = new CostOptimizationEngine();
    const channels: Channel[] = [Channel.SMS, Channel.EMAIL, Channel.PUSH];

    const sorted = optimizer.optimizeChannelSequence(channels);
    expect(sorted).toEqual([Channel.PUSH, Channel.EMAIL, Channel.SMS]);
  });
});
