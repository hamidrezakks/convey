import { describe, expect, it } from 'bun:test';
import { OlapArchiver } from '../src/modules/reports/olap-archiver';

describe('Storage Tiering & OLAP Micro-Batch Archiver', () => {
  it('should buffer records and flush cold-tier batch chunks', async () => {
    const archiver = new OlapArchiver(100, 60_000);

    await archiver.ingestRecord({
      id: 'rec_001',
      table: 'message_events',
      tenantId: 'tenant-123',
      payload: { event: 'delivered', channel: 'email' },
      timestamp: new Date().toISOString(),
    });

    await archiver.ingestRecord({
      id: 'rec_002',
      table: 'budget_ledger',
      tenantId: 'tenant-123',
      payload: { costUsd: 0.0035, provider: 'telnyx' },
      timestamp: new Date().toISOString(),
    });

    const metricsBefore = archiver.getMetrics();
    expect(metricsBefore.pendingBufferCount).toBe(2);

    const chunk = await archiver.flush();
    expect(chunk).not.toBeNull();
    expect(chunk?.recordCount).toBe(2);
    expect(chunk?.tables.message_events).toBe(1);
    expect(chunk?.tables.budget_ledger).toBe(1);
    expect(chunk?.compressedSizeBytes).toBeGreaterThan(0);

    const metricsAfter = archiver.getMetrics();
    expect(metricsAfter.pendingBufferCount).toBe(0);
    expect(metricsAfter.totalArchivedCount).toBe(2);
    expect(metricsAfter.totalBatchesFlushed).toBe(1);

    archiver.stop();
  });
});
