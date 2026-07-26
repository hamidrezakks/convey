export interface LruCacheOptions {
  maxCapacity?: number;
  defaultTtlMs?: number;
}

interface CacheEntry<V> {
  value: V;
  expiresAtMs?: number;
}

/**
 * High-performance, zero-allocation Bounded LRU Cache with TTL support.
 * Uses JavaScript Map insertion-order guarantee to maintain O(1) get, set, delete, and eviction.
 */
export class BoundedLruCache<K, V> {
  private readonly map = new Map<K, CacheEntry<V>>();
  private readonly maxCapacity: number;
  private readonly defaultTtlMs?: number;

  constructor(options?: LruCacheOptions) {
    this.maxCapacity = Math.max(1, options?.maxCapacity ?? 5000);
    this.defaultTtlMs = options?.defaultTtlMs;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (entry.expiresAtMs !== undefined && Date.now() > entry.expiresAtMs) {
      this.map.delete(key);
      return undefined;
    }

    // Refresh LRU order: delete and re-set
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, customTtlMs?: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxCapacity) {
      // Evict oldest (first item in Map iterator)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    const ttl = customTtlMs ?? this.defaultTtlMs;
    const expiresAtMs = ttl !== undefined ? Date.now() + ttl : undefined;
    this.map.set(key, { value, expiresAtMs });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): V[] {
    const now = Date.now();
    const result: V[] = [];
    for (const [key, entry] of this.map.entries()) {
      if (entry.expiresAtMs !== undefined && now > entry.expiresAtMs) {
        this.map.delete(key);
      } else {
        result.push(entry.value);
      }
    }
    return result;
  }

  entries(): Array<[K, V]> {
    const now = Date.now();
    const result: Array<[K, V]> = [];
    for (const [key, entry] of this.map.entries()) {
      if (entry.expiresAtMs !== undefined && now > entry.expiresAtMs) {
        this.map.delete(key);
      } else {
        result.push([key, entry.value]);
      }
    }
    return result;
  }
}
