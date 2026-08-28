import { describe, expect, it } from 'bun:test';
import { Convey, TokenBucketRateLimiter } from '../src';

describe('Client-Side Rate Smoothing & Token Bucket Suite', () => {
  it('should pace token acquisition smoothly without overflowing burst capacity', async () => {
    const limiter = new TokenBucketRateLimiter({ maxRequestsPerSecond: 100, maxBurst: 5 });

    // Acquire burst immediately
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    const startTime = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - startTime;

    // The 6th request had to wait for token generation (~10ms)
    expect(elapsed).toBeGreaterThanOrEqual(5);
  });

  it('should integrate rateLimiter option into Convey client instance', async () => {
    let requestsExecuted = 0;
    const mockFetch = async (): Promise<Response> => {
      requestsExecuted++;
      return new Response(JSON.stringify({ success: true, publicId: `msg_${requestsExecuted}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      rateLimiter: { maxRequestsPerSecond: 50, maxBurst: 10 },
      fetch: mockFetch as unknown as typeof fetch,
    });

    const promises = Array.from({ length: 5 }, (_, i) =>
      client.messages.send({
        channel: 'SMS',
        recipient: `+1555000${i}`,
        content: { body: 'Paced SMS' },
      }),
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(5);
    expect(requestsExecuted).toBe(5);
  });
});
