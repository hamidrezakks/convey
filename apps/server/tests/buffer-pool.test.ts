import { describe, expect, it } from 'bun:test';
import { ByteBufferPool } from '../src/utils/buffer-pool';

describe('Zero-Allocation Reusable ByteBufferPool', () => {
  it('acquires and releases buffers correctly without leaks', () => {
    const pool = new ByteBufferPool(4, 1024);
    expect(pool.getAvailableCount()).toBe(4);

    const buf1 = pool.acquire();
    expect(pool.getAvailableCount()).toBe(3);
    expect(buf1.length).toBe(1024);

    pool.release(buf1);
    expect(pool.getAvailableCount()).toBe(4);
  });
});
