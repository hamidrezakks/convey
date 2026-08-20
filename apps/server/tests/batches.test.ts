import { describe, expect, it } from 'bun:test';
import { computeBatchPerformanceStats, computeBatchProgressMetrics } from '../src/modules/messaging/batches.service';
import { BatchStatus } from '../src/modules/messaging/messaging.types';

describe('Batch Analytics & High-Throughput Engine Suite', () => {
  describe('computeBatchProgressMetrics Matrix (Parameterized it.each)', () => {
    it.each([
      {
        scenario: 'calculates partial progress metrics correctly',
        total: 1000,
        sent: 500,
        delivered: 450,
        failed: 50,
        status: BatchStatus.PROCESSING,
        expectedProcessed: 500,
        expectedPending: 500,
        expectedPercent: 50,
        expectedStatus: BatchStatus.PROCESSING,
      },
      {
        scenario: 'transitions status to COMPLETED when all items deliver successfully',
        total: 1000,
        sent: 1000,
        delivered: 1000,
        failed: 0,
        status: BatchStatus.PROCESSING,
        expectedProcessed: 1000,
        expectedPending: 0,
        expectedPercent: 100,
        expectedStatus: BatchStatus.COMPLETED,
      },
      {
        scenario: 'transitions status to FAILED when 100% of items fail',
        total: 500,
        sent: 500,
        delivered: 0,
        failed: 500,
        status: BatchStatus.PROCESSING,
        expectedProcessed: 500,
        expectedPending: 0,
        expectedPercent: 100,
        expectedStatus: BatchStatus.FAILED,
      },
      {
        scenario: 'handles zero total count gracefully without division by zero',
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        status: BatchStatus.PROCESSING,
        expectedProcessed: 0,
        expectedPending: 0,
        expectedPercent: 0,
        expectedStatus: BatchStatus.PROCESSING,
      },
      {
        scenario: 'caps progress percentage at 100% and pending count at 0 for over-delivery edge cases',
        total: 100,
        sent: 120,
        delivered: 110,
        failed: 10,
        status: BatchStatus.PROCESSING,
        expectedProcessed: 120,
        expectedPending: 0,
        expectedPercent: 100,
        expectedStatus: BatchStatus.COMPLETED,
      },
      {
        scenario: 'preserves existing terminal status CANCELLED',
        total: 1000,
        sent: 100,
        delivered: 50,
        failed: 0,
        status: BatchStatus.CANCELLED,
        expectedProcessed: 50,
        expectedPending: 950,
        expectedPercent: 5,
        expectedStatus: BatchStatus.CANCELLED,
      },
      {
        scenario: 'preserves existing terminal status PAUSED',
        total: 1000,
        sent: 100,
        delivered: 50,
        failed: 0,
        status: BatchStatus.PAUSED,
        expectedProcessed: 50,
        expectedPending: 950,
        expectedPercent: 5,
        expectedStatus: BatchStatus.PAUSED,
      },
    ])(
      '$scenario',
      ({
        total,
        sent,
        delivered,
        failed,
        status,
        expectedProcessed,
        expectedPending,
        expectedPercent,
        expectedStatus,
      }) => {
        const metrics = computeBatchProgressMetrics(total, sent, delivered, failed, status);
        expect(metrics.processedCount).toBe(expectedProcessed);
        expect(metrics.pendingCount).toBe(expectedPending);
        expect(metrics.progressPercent).toBe(expectedPercent);
        expect(metrics.computedStatus).toBe(expectedStatus);
      },
    );
  });

  describe('computeBatchPerformanceStats Analytics & Throughput Engine', () => {
    it('calculates throughput rate and estimated time remaining (ETA)', () => {
      const created10SecAgo = new Date(Date.now() - 10_000);
      const stats = computeBatchPerformanceStats(created10SecAgo, 1000, 500, 500);

      expect(stats.elapsedSeconds).toBeGreaterThanOrEqual(9);
      expect(stats.processingRatePerSec).toBeGreaterThan(0);
      expect(stats.estimatedTimeRemainingSeconds).toBeGreaterThan(0);
    });

    it('calculates high-volume batch ETA accurately at 5,000 msg/sec', () => {
      const created10SecAgo = new Date(Date.now() - 10_000);
      const stats = computeBatchPerformanceStats(created10SecAgo, 100_000, 50_000, 50_000);

      expect(stats.processingRatePerSec).toBeCloseTo(5000, -2);
      expect(stats.estimatedTimeRemainingSeconds).toBeCloseTo(10, -1);
    });

    it('handles clock skew / sub-second creation time gracefully with minimum 1s elapsed floor', () => {
      const futureDate = new Date(Date.now() + 500); // 500ms in future
      const stats = computeBatchPerformanceStats(futureDate, 100, 10, 90);

      expect(stats.elapsedSeconds).toBeGreaterThanOrEqual(1);
      expect(stats.processingRatePerSec).toBeGreaterThan(0);
    });

    it('handles zero processing rate gracefully with 0 ETA', () => {
      const createdNow = new Date();
      const stats = computeBatchPerformanceStats(createdNow, 1000, 0, 1000);

      expect(stats.processingRatePerSec).toBe(0);
      expect(stats.estimatedTimeRemainingSeconds).toBe(0);
    });

    it('returns 0 ETA when batch is 100% processed', () => {
      const created10SecAgo = new Date(Date.now() - 10_000);
      const stats = computeBatchPerformanceStats(created10SecAgo, 1000, 1000, 0);

      expect(stats.estimatedTimeRemainingSeconds).toBe(0);
    });
  });
});
