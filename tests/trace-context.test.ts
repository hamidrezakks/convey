import { describe, expect, it } from 'bun:test';
import { TraceContext } from '../src/utils/trace-context';

describe('W3C Distributed TraceContext Propagation', () => {
  it('creates and formats valid W3C traceparent headers', () => {
    const ctx = TraceContext.create();
    expect(ctx.traceId).toHaveLength(32);
    expect(ctx.spanId).toHaveLength(16);

    const header = TraceContext.formatHeader(ctx);
    expect(header).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
  });

  it('parses existing traceparent headers accurately', () => {
    const validHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const parsed = TraceContext.parseHeader(validHeader);

    expect(parsed).not.toBeNull();
    expect(parsed?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(parsed?.spanId).toBe('00f067aa0ba902b7');
    expect(parsed?.sampled).toBe(true);
  });

  it('creates child spans retaining traceId and attaching parentSpanId', () => {
    const parent = TraceContext.create();
    const child = TraceContext.createChild(parent);

    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
    expect(child.spanId).not.toBe(parent.spanId);
  });

  it('injects traceparent into HTTP headers and outbox metadata', () => {
    const ctx = TraceContext.create();
    const headers = TraceContext.injectHeaders(ctx);

    expect(headers.traceparent).toBe(TraceContext.formatHeader(ctx));
    expect(headers['x-trace-id']).toBe(ctx.traceId);

    const metadata = TraceContext.injectOutboxMetadata(ctx, { foo: 'bar' });
    expect(metadata.foo).toBe('bar');
    expect((metadata.traceContext as { traceId: string }).traceId).toBe(ctx.traceId);
  });

  it('returns null for invalid traceparent headers', () => {
    expect(TraceContext.parseHeader('invalid-header')).toBeNull();
    expect(TraceContext.parseHeader('01-1234-5678-00')).toBeNull();
  });
});
