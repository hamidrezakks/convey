import { describe, expect, it } from 'bun:test';
import { BatchState, Convey, ConveyTimeoutError, MessageStatus } from '../src';

describe('Lifecycle Polling & Async Awaiting Suite', () => {
  it('should poll message status until DELIVERED state is reached', async () => {
    let probes = 0;
    const mockFetch = async (_input: RequestInfo | URL): Promise<Response> => {
      probes++;
      const status = probes < 3 ? 'SENDING' : 'DELIVERED';
      return new Response(
        JSON.stringify({
          publicId: 'msg_poll_01',
          status,
          state: status.toLowerCase(),
          deliveredAt: probes >= 3 ? new Date().toISOString() : undefined,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    let polledCount = 0;
    const result = await client.messages.waitForDelivery('msg_poll_01', {
      pollIntervalMs: 10,
      timeoutMs: 5000,
      onPoll: (msg) => {
        polledCount++;
        expect(msg.publicId).toBe('msg_poll_01');
      },
    });

    expect(probes).toBe(3);
    expect(polledCount).toBe(3);
    expect(result.status).toBe(MessageStatus.DELIVERED);
  });

  it('should timeout and throw ConveyTimeoutError if status is not reached within deadline', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ publicId: 'msg_slow', status: 'QUEUED', state: 'queued' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(
      client.messages.waitForDelivery('msg_slow', {
        pollIntervalMs: 10,
        timeoutMs: 50,
      }),
    ).rejects.toBeInstanceOf(ConveyTimeoutError);
  });

  it('should poll batch completion until COMPLETED state', async () => {
    let probes = 0;
    const mockFetch = async (): Promise<Response> => {
      probes++;
      const state = probes < 2 ? 'PROCESSING' : 'COMPLETED';
      return new Response(
        JSON.stringify({
          success: true,
          batch: { id: 'batch_99', state, totalCount: 100, processedCount: probes * 50 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const batch = await client.batches.waitForCompletion('batch_99', {
      pollIntervalMs: 10,
      timeoutMs: 5000,
    });

    expect(probes).toBe(2);
    expect(batch.state).toBe(BatchState.COMPLETED);
  });
});
