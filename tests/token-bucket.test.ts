import { describe, expect, it } from 'bun:test';
import { TokenBucketLimiter } from '../src/modules/policies/token-bucket';

describe('Distributed Token Bucket Limiter', () => {
  it('allows requests within capacity and blocks over-capacity requests', async () => {
    const key = `test_bucket_${Date.now()}`;
    const capacity = 5;
    const refillRate = 1; // 1 token per sec

    for (let i = 0; i < 5; i++) {
      const res = await TokenBucketLimiter.consume(key, capacity, refillRate, 1);
      expect(res.allowed).toBe(true);
    }

    const blockedRes = await TokenBucketLimiter.consume(key, capacity, refillRate, 1);
    expect(blockedRes.allowed).toBe(false);
  });
});
