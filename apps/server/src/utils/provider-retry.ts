import { FullJitterRetry } from './full-jitter-retry';

export function providerRetryDelay(attempt: number, retryAfterMs?: number): number {
  const jitter = FullJitterRetry.calculateBackoffMs(attempt, 1000, 30000);
  return Number.isFinite(retryAfterMs) && (retryAfterMs as number) > 0
    ? Math.max(jitter, Math.min(retryAfterMs as number, 30 * 60_000))
    : jitter;
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value?.trim()) return undefined;
  const numeric = Number(value);
  const delay = Number.isFinite(numeric) ? numeric * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) && delay > 0 ? Math.min(delay, 30 * 60_000) : undefined;
}
