import { logger } from './logger';

export interface HeapMemoryStatus {
  heapUsedBytes: number;
  heapTotalBytes: number;
  heapUtilization: number; // 0.0 to 1.0
  isHighMemoryPressure: boolean;
}

/**
 * Adaptive Bun-Native Heap Memory & GC Pressure Guard.
 *
 * Inspects Bun / JavaScriptCore memory usage (`process.memoryUsage()`) and triggers proactive
 * worker throttling and Bun garbage collection hints (`Bun.gc()`) before heap saturation exceeds 85% capacity.
 */
export class HeapMemoryGuard {
  private pressureThreshold = 0.85; // 85% heap saturation threshold
  private minHeapThresholdBytes = 256 * 1024 * 1024; // 256MB minimum heap threshold before throttling

  /**
   * Returns current Bun / JSC heap utilization and pressure status.
   */
  getStatus(): HeapMemoryStatus {
    const mem = process.memoryUsage();
    const heapUsedBytes = mem.heapUsed;
    const heapTotalBytes = mem.heapTotal || 1;
    const heapUtilization = Math.min(1.0, Math.max(0.0, heapUsedBytes / heapTotalBytes));
    const isHighMemoryPressure = heapUsedBytes > this.minHeapThresholdBytes && heapUtilization > this.pressureThreshold;

    if (isHighMemoryPressure && process.env.NODE_ENV !== 'test') {
      logger.warn(
        'HeapMemoryGuard',
        `High memory pressure detected: ${(heapUtilization * 100).toFixed(1)}% heap utilization (${Math.round(heapUsedBytes / 1024 / 1024)}MB / ${Math.round(heapTotalBytes / 1024 / 1024)}MB)`,
      );

      // Trigger Bun native non-blocking GC hint to relieve memory pressure
      if (typeof Bun !== 'undefined' && typeof Bun.gc === 'function') {
        Bun.gc(false);
      }
    }

    return {
      heapUsedBytes,
      heapTotalBytes,
      heapUtilization: Number.parseFloat(heapUtilization.toFixed(3)),
      isHighMemoryPressure,
    };
  }

  /**
   * Determines if new memory-intensive tasks should be throttled.
   */
  shouldThrottle(): boolean {
    if (process.env.NODE_ENV === 'test') return false;
    return this.getStatus().isHighMemoryPressure;
  }
}

/** Singleton instance of HeapMemoryGuard */
export const heapMemoryGuard = new HeapMemoryGuard();
