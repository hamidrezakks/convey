/**
 * @convey/sdk - Client-Side Rate Smoothing
 * Zero-dependency Token Bucket rate limiter for high-throughput client pacing.
 */

export interface RateLimiterOptions {
  /**
   * Maximum permitted requests per second.
   */
  maxRequestsPerSecond: number;

  /**
   * Maximum burst capacity of tokens.
   * @default maxRequestsPerSecond
   */
  maxBurst?: number;
}

export class TokenBucketRateLimiter {
  private readonly rate: number;
  private readonly capacity: number;
  private tokens: number;
  private lastRefillTimestamp: number;
  private queue: Array<() => void> = [];
  private scheduledTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RateLimiterOptions) {
    if (options.maxRequestsPerSecond <= 0) {
      throw new Error('RateLimiter maxRequestsPerSecond must be greater than 0.');
    }
    this.rate = options.maxRequestsPerSecond;
    this.capacity = options.maxBurst ?? Math.max(1, Math.round(this.rate));
    this.tokens = this.capacity;
    this.lastRefillTimestamp = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTimestamp) / 1000;
    const addedTokens = elapsedSeconds * this.rate;

    if (addedTokens > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefillTimestamp = now;
    }
  }

  /**
   * Acquire execution permission. Resolves when a token is granted.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.scheduleDrain();
    });
  }

  private scheduleDrain(): void {
    if (this.scheduledTimer !== null || this.queue.length === 0) {
      return;
    }

    const tokensNeeded = 1;
    const timeNeededMs = Math.ceil(((tokensNeeded - this.tokens) / this.rate) * 1000);
    const delay = Math.max(5, timeNeededMs);

    this.scheduledTimer = setTimeout(() => {
      this.scheduledTimer = null;
      this.refill();

      while (this.queue.length > 0 && this.tokens >= 1) {
        this.tokens -= 1;
        const next = this.queue.shift();
        if (next) {
          next();
        }
      }

      if (this.queue.length > 0) {
        this.scheduleDrain();
      }
    }, delay);
  }
}
