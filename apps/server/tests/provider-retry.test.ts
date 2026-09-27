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
