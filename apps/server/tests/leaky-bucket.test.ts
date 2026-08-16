import { describe, expect, it } from 'bun:test';
import { LeakyBucketGovernor } from '../src/modules/policies/leaky-bucket';

describe('Micro-Leaky Bucket Provider Rate Governor', () => {
  it('allows slots within rate limit and caps over-limit dispatches', async () => {
    const providerId = `provider_leaky_${Date.now()}`;
    const maxPerSec = 10; // max 1 per 100ms slice

    const res1 = await LeakyBucketGovernor.acquireSlot(providerId, maxPerSec);
    expect(res1.allowed).toBe(true);

    const cappedRes = await LeakyBucketGovernor.acquireSlot(providerId, maxPerSec);
    expect(cappedRes.allowed).toBe(false);
  });
});
