/**
 * Full-Jitter Exponential Backoff Calculator.
 *
 * Implements standard Full-Jitter retry backoff algorithm:
 * Sleep = Random(0, Min(maxMs, baseMs * 2^attempt))
 *
 * Spreads out retry attempts across time to eliminate thundering herd synchronization spikes
 * against upstream provider endpoints.
 */
export const FullJitterRetry = {
  /**
   * Calculates a randomized full-jitter backoff delay in milliseconds.
   * @param attempt Current attempt index (0-based or 1-based).
   * @param baseMs Initial base retry delay in milliseconds (default: 1000ms).
   * @param maxMs Maximum capped retry delay in milliseconds (default: 30000ms).
   */
  calculateBackoffMs(attempt: number, baseMs = 1000, maxMs = 30000): number {
    const temp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
    const sleepMs = Math.floor(Math.random() * temp);
    return Math.max(baseMs / 2, sleepMs);
  },
};
