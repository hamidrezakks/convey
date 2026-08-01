import { describe, expect, it } from 'bun:test';
import { FullJitterRetry } from '../src/utils/full-jitter-retry';

describe('Full-Jitter Exponential Backoff Calculator', () => {
  it('calculates randomized backoff delays within calculated upper bounds', () => {
    const baseMs = 1000;
    const maxMs = 10000;

    for (let attempt = 0; attempt < 5; attempt++) {
      const delay = FullJitterRetry.calculateBackoffMs(attempt, baseMs, maxMs);
      const upperBound = Math.min(maxMs, baseMs * 2 ** attempt);

      expect(delay).toBeGreaterThanOrEqual(baseMs / 2);
      expect(delay).toBeLessThanOrEqual(upperBound);
    }
  });
});
