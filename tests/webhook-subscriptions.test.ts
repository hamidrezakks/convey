import { describe, expect, it } from 'bun:test';
import { computeWebhookSignature } from '../src/queues/workers/customer-webhook-dispatch.worker';
import { TraceContext } from '../src/utils/trace-context';

describe('Outgoing Customer Webhook Engine Suite', () => {
  it('computes valid HMAC-SHA256 signature', () => {
    const secret = 'super-secret-key';
    const timestamp = 1700000000;
    const payload = JSON.stringify({ event: 'message.delivered', data: { messageId: 'msg_123' } });

    const sig = computeWebhookSignature(secret, timestamp, payload);
    expect(sig).toContain('t=1700000000,v1=');
    expect(sig.length).toBeGreaterThan(30);
  });

  it('injects W3C traceparent and span headers into outbound customer webhook HTTP requests', () => {
    const ctx = TraceContext.create();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Convey-WebhookDispatcher/1.0',
    };

    TraceContext.injectHeaders(ctx, headers);

    expect(headers.traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    expect(headers['x-trace-id']).toBe(ctx.traceId);
    expect(headers['x-span-id']).toBe(ctx.spanId);
  });
});
