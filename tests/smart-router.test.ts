import { describe, expect, it } from 'bun:test';
import { sampleBeta, smartProviderRouter } from '../src/modules/providers/core/smart-router';

describe('Smart Provider Router & Thompson Sampling MAB', () => {
  it('samples valid Beta distribution numbers between 0 and 1', () => {
    for (let i = 0; i < 50; i++) {
      const sample = sampleBeta(10, 2);
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it('records feedback and computes provider scorecards with Thompson Sampling', () => {
    for (let i = 0; i < 20; i++) {
      smartProviderRouter.recordProviderFeedback('provider_fast', 50, true);
    }

    for (let i = 0; i < 20; i++) {
      smartProviderRouter.recordProviderFeedback('provider_slow', 500, i % 2 === 0);
    }

    const fastScore = smartProviderRouter.getScorecard('provider_fast');
    const slowScore = smartProviderRouter.getScorecard('provider_slow');

    expect(fastScore.score).toBeGreaterThan(slowScore.score);
    expect(fastScore.successRate).toBe(1.0);
    expect(slowScore.successRate).toBe(0.5);
    expect(fastScore.betaSample).toBeGreaterThan(0);
  });
});
