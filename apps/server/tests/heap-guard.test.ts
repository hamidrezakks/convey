import { describe, expect, it } from 'bun:test';
import { HeapMemoryGuard } from '../src/utils/heap-guard';

describe('Adaptive Heap Memory & GC Pressure Guard', () => {
  it('inspects process memory metrics and returns utilization status', () => {
    const guard = new HeapMemoryGuard();
    const status = guard.getStatus();

    expect(status.heapUsedBytes).toBeGreaterThan(0);
    expect(status.heapTotalBytes).toBeGreaterThan(0);
    expect(status.heapUtilization).toBeGreaterThanOrEqual(0.0);
    expect(status.heapUtilization).toBeLessThanOrEqual(1.0);
    expect(typeof status.isHighMemoryPressure).toBe('boolean');
  });
});
