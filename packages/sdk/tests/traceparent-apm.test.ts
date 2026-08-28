import { describe, expect, it } from 'bun:test';
import { Channel, Convey, createChildTraceparent, generateTraceparent } from '../src';

describe('QA W3C Distributed Traceparent Propagation & APM', () => {
  const W3C_TRACEPARENT_REGEX = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

  it('should generate valid W3C Level 1 traceparent header strings', () => {
    for (let i = 0; i < 50; i++) {
      const trace = generateTraceparent();
      expect(trace).toMatch(W3C_TRACEPARENT_REGEX);

      const parts = trace.split('-');
      expect(parts[0]).toBe('00'); // Version 00
      expect(parts[1]).toHaveLength(32); // 128-bit trace ID
      expect(parts[2]).toHaveLength(16); // 64-bit parent/span ID
      expect(parts[3]).toBe('01'); // Sampled trace flag
    }
  });

  it('should stitch child spans by preserving trace ID and generating new span ID', () => {
    const parentTrace = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const childTrace = createChildTraceparent(parentTrace);

    expect(childTrace).toMatch(W3C_TRACEPARENT_REGEX);
    const parentParts = parentTrace.split('-');
    const childParts = childTrace.split('-');

    // Trace ID MUST be identical across distributed hops
    expect(childParts[1]).toBe(parentParts[1]);
    // Span ID MUST be distinct for child operation
    expect(childParts[2]).not.toBe(parentParts[2]);
    // Trace flags preserved
    expect(childParts[3]).toBe('01');
  });

  it('should gracefully fallback to new traceparent when parent is malformed', () => {
    const invalidParents = [
      '',
      'invalid-string',
      '01-bad-trace',
      '00-tooshort-span-01',
      '00-4bf92f3577b34da6a3ce929d0e0e4736-not16chars-01',
    ];

    for (const invalid of invalidParents) {
      const fallback = createChildTraceparent(invalid);
      expect(fallback).toMatch(W3C_TRACEPARENT_REGEX);
    }
  });

  it('should propagate incoming traceparent across SDK HTTP client calls', async () => {
    let capturedTraceparent: string | null = null;
    const mockFetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      capturedTraceparent = headers.get('traceparent');
      return new Response(JSON.stringify({ success: true, publicId: 'msg_trace_01' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_12345',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const incomingTrace = '00-9876543210abcdef9876543210abcdef-1234567890abcdef-01';
    await client.messages.send(
      {
        channel: Channel.EMAIL,
        recipient: 'apm@test.com',
        content: { body: 'Tracing test' },
      },
      { traceparent: incomingTrace },
    );

    expect(capturedTraceparent).toBeDefined();
    expect(capturedTraceparent).toMatch(W3C_TRACEPARENT_REGEX);

    const childParts = (capturedTraceparent as unknown as string).split('-');
    // Trace ID preserved
    expect(childParts[1]).toBe('9876543210abcdef9876543210abcdef');
    // New child span ID generated
    expect(childParts[2]).not.toBe('1234567890abcdef');
  });
});
