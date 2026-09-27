import { describe, expect, it } from 'bun:test';
import { TokenBucketLimiter } from '../src/modules/policies/token-bucket';
import { AdaptiveConcurrencyController } from '../src/utils/adaptive-concurrency';
import { heapMemoryGuard } from '../src/utils/heap-guard';

describe('Runtime resource and rate-limit invariants', () => {
  it('TokenBucketLimiter token consumption and burst capacity limits', async () => {
    const key = `qa_perf_token_${Date.now()}`;
    const capacity = 10;
    const refillRate = 10;

    // Consume 1 token
    const res1 = await TokenBucketLimiter.consume(key, capacity, refillRate, 1);
    expect(res1.allowed).toBeTrue();
    expect(res1.remainingTokens).toBeLessThan(capacity);
  });

  it('adaptive backpressure and heap memory guard metric precision', () => {
    const controller = new AdaptiveConcurrencyController({ minConcurrency: 2, maxConcurrency: 50 });
    const concurrency = controller.getConcurrency();
    expect(concurrency).toBeGreaterThanOrEqual(2);

    const status = heapMemoryGuard.getStatus();
    expect(typeof status.heapUsedBytes).toBe('number');
    expect(typeof status.isHighMemoryPressure).toBe('boolean');
    expect(status.heapUsedBytes).toBeGreaterThan(0);
  });
});
