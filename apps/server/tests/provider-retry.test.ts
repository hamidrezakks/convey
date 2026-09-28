import { expect, test } from 'bun:test';
import { providerRetryDelay } from '../src/utils/provider-retry';

test('honors server delay, bounds excessive values and rejects invalid delays', () => {
  expect(providerRetryDelay(1, 60_000)).toBe(60_000);
  expect(providerRetryDelay(1, 86_400_000)).toBe(1_800_000);
  for (const delay of [NaN, Infinity, -1, undefined]) {
    expect(providerRetryDelay(1, delay)).toBeGreaterThanOrEqual(500);
    expect(providerRetryDelay(1, delay)).toBeLessThanOrEqual(2000);
  }
});

test('isolates Retry-After headers across concurrent sends', async () => {
  const { captureProviderRetryAfter, observeProviderResponse } = await import('../src/utils/provider-retry-context');
  const results = await Promise.all(
    [60, 120].map((seconds) =>
      captureProviderRetryAfter(async () => {
        await Promise.resolve();
        observeProviderResponse(new Response('', { status: 429, headers: { 'Retry-After': String(seconds) } }));
        return seconds;
      }),
    ),
  );
  expect(results.map((result) => result.retryAfterMs)).toEqual([60_000, 120_000]);
});
