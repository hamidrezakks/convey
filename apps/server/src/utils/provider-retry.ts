import { FullJitterRetry } from './full-jitter-retry';

export function providerRetryDelay(attempt: number, retryAfterMs?: number): number {
  const jitter = FullJitterRetry.calculateBackoffMs(attempt, 1000, 30000);
  return Number.isFinite(retryAfterMs) && (retryAfterMs as number) > 0
    ? Math.max(jitter, Math.min(retryAfterMs as number, 30 * 60_000))
    : jitter;
}
