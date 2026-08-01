import { describe, expect, it } from 'bun:test';
import { BoundedLruCache } from '../src/utils/lru-cache';

describe('BoundedLruCache', () => {
  it('stores and retrieves values', () => {
    const cache = new BoundedLruCache<string, number>({ maxCapacity: 10 });
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  it('evicts least recently used item when reaching capacity', () => {
    const cache = new BoundedLruCache<string, number>({ maxCapacity: 3 });
    cache.set('k1', 10);
    cache.set('k2', 20);
    cache.set('k3', 30);

    // Access k1 to make it recently used (k2 becomes oldest)
    expect(cache.get('k1')).toBe(10);

    // Insert 4th item -> should evict k2
    cache.set('k4', 40);

    expect(cache.get('k1')).toBe(10);
    expect(cache.get('k2')).toBeUndefined();
    expect(cache.get('k3')).toBe(30);
    expect(cache.get('k4')).toBe(40);
    expect(cache.size).toBe(3);
  });

  it('handles TTL expiration', async () => {
    const cache = new BoundedLruCache<string, string>({ maxCapacity: 10, defaultTtlMs: 20 });
    cache.set('temp', 'val');

    expect(cache.get('temp')).toBe('val');
    expect(cache.has('temp')).toBe(true);

    await new Promise((r) => setTimeout(r, 35));

    expect(cache.get('temp')).toBeUndefined();
    expect(cache.has('temp')).toBe(false);
  });

  it('supports custom per-entry TTL override', async () => {
    const cache = new BoundedLruCache<string, string>({ maxCapacity: 10, defaultTtlMs: 500 });
    cache.set('short', 'val1', 20);
    cache.set('long', 'val2', 500);

    await new Promise((r) => setTimeout(r, 35));

    expect(cache.get('short')).toBeUndefined();
    expect(cache.get('long')).toBe('val2');
  });

  it('supports delete, clear, entries, and values', () => {
    const cache = new BoundedLruCache<string, number>({ maxCapacity: 5 });
    cache.set('x', 1);
    cache.set('y', 2);
    cache.set('z', 3);

    expect(cache.delete('y')).toBe(true);
    expect(cache.get('y')).toBeUndefined();
    expect(cache.size).toBe(2);

    expect(cache.values()).toEqual([1, 3]);
    expect(cache.entries()).toEqual([
      ['x', 1],
      ['z', 3],
    ]);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('x')).toBeUndefined();
  });
});
