import { afterAll, describe, expect, it } from 'bun:test';
import { MicroBatchIngestionPipeline } from '../src/modules/webhooks/micro-batch-ingestion';

describe('High-Throughput Micro-Batch Ingestion Engine', () => {
  const pipeline = new MicroBatchIngestionPipeline();

  afterAll(() => {
    pipeline.stopAutoFlush();
  });

  it('buffers and flushes webhook events in batch', async () => {
    pipeline.enqueueEvent({
      eventId: 'evt_1',
      provider: 'sendgrid',
      eventType: 'delivered',
      timestamp: Date.now(),
      payload: { msg: 'test' },
    });

    const count = await pipeline.flush();
    expect(count).toBe(1);
  });
});
