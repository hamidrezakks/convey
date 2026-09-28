import { describe, expect, it } from 'bun:test';
import { cn, formatDurationMs, formatNumber, formatTimeAgo } from '../src/lib/utils';

describe('Web UI Utilities & Formatting Test Suite', () => {
  it('cn() merges tailwind classes properly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('bg-red-500', { 'bg-blue-500': true })).toBe('bg-blue-500');
    expect(cn('text-white', undefined, null, false, 'font-bold')).toBe('text-white font-bold');
  });

  it('formatNumber() formats numbers into human readable abbreviations', () => {
    expect(formatNumber(450)).toBe('450');
    expect(formatNumber(1250)).toBe('1.3k');
    expect(formatNumber(1250000)).toBe('1.25M');
    expect(formatNumber(undefined as unknown as number)).toBe('Unavailable');
    expect(formatNumber(null as unknown as number)).toBe('Unavailable');
    expect(formatNumber(Number.NaN)).toBe('Unavailable');
    expect(formatNumber(0)).toBe('0');
  });

  it('formatDurationMs() formats microsecond and millisecond latencies', () => {
    expect(formatDurationMs(0.45)).toBe('450µs');
    expect(formatDurationMs(12.4)).toBe('12.4ms');
    expect(formatDurationMs(1250)).toBe('1.25s');
    expect(formatDurationMs(undefined as unknown as number)).toBe('Unavailable');
    expect(formatDurationMs(0)).toBe('0ms');
    expect(formatDurationMs(Number.NaN)).toBe('Unavailable');
  });

  it('formatTimeAgo() formats ISO timestamps into relative time labels', () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe('just now');

    const tenSecAgo = new Date(Date.now() - 10000).toISOString();
    expect(formatTimeAgo(tenSecAgo)).toBe('10s ago');

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(fiveMinAgo)).toBe('5m ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(twoHoursAgo)).toBe('2h ago');

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(threeDaysAgo)).toBe('3d ago');

    // Defensive edge cases
    expect(formatTimeAgo('')).toBe('-');
    expect(formatTimeAgo('invalid-date')).toBe('-');
    expect(formatTimeAgo(undefined as unknown as string)).toBe('-');
    expect(formatTimeAgo(null as unknown as string)).toBe('-');
  });
});
