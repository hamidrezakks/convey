/**
 * Zero-Allocation Reusable Byte Buffer Pool.
 *
 * Pre-allocates slab buffer pools to minimize V8 Garbage Collection (GC) pressure
 * and memory fragmentation during ultra-high throughput JSON payload serializations.
 */
export class ByteBufferPool {
  private pool: Buffer[] = [];
  private poolSize: number;
  private bufferCapacity: number;

  /**
   * Initializes the buffer pool.
   * @param poolSize Maximum number of buffers to hold in pool (default: 64).
   * @param bufferCapacity Capacity per buffer in bytes (default: 64KB).
   */
  constructor(poolSize = 64, bufferCapacity = 64 * 1024) {
    this.poolSize = poolSize;
    this.bufferCapacity = bufferCapacity;

    for (let i = 0; i < poolSize; i++) {
      this.pool.push(Buffer.allocUnsafe(bufferCapacity));
    }
  }

  /**
   * Acquires a pre-allocated buffer from the pool, or allocates a new one if exhausted.
   */
  acquire(): Buffer {
    const buf = this.pool.pop();
    if (buf) {
      buf.fill(0);
      return buf;
    }
    return Buffer.alloc(this.bufferCapacity);
  }

  /**
   * Releases a buffer back to the pool for reuse if capacity matches.
   * @param buf Buffer to release back to pool.
   */
  release(buf: Buffer): void {
    if (buf.length === this.bufferCapacity && this.pool.length < this.poolSize) {
      this.pool.push(buf);
    }
  }

  /**
   * Returns current count of available pooled buffers.
   */
  getAvailableCount(): number {
    return this.pool.length;
  }
}

/** Singleton instance of ByteBufferPool */
export const byteBufferPool = new ByteBufferPool();
