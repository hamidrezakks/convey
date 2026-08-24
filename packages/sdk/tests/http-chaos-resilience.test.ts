import { describe, expect, it } from 'bun:test';
import { Channel, Convey, ConveyApiError, ConveyNetworkError } from '../src';

describe('QA HTTP Resilience, Chaos & Boundary Tests', () => {
  it('should handle HTML 502/504 Bad Gateway / Gateway Timeout responses gracefully', async () => {
    let attempts = 0;
    const html502Body = '<html><head><title>502 Bad Gateway</title></head><body>Cloudflare 502</body></html>';

    const mockFetch = async (): Promise<Response> => {
      attempts++;
      if (attempts < 3) {
        return new Response(html502Body, {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      return new Response(JSON.stringify({ success: true, publicId: 'msg_recovered_502' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_test',
      maxRetries: 3,
      fetch: mockFetch as unknown as typeof fetch,
    });

    const result = await client.messages.send({
      channel: Channel.EMAIL,
      recipient: 'user@test.com',
      content: { body: 'Testing 502 recovery' },
    });

    expect(attempts).toBe(3);
    expect(result.publicId).toBe('msg_recovered_502');
  });

  it('should wrap network socket failures (ECONNRESET, fetch failed) in ConveyNetworkError', async () => {
    const mockFetch = async (): Promise<Response> => {
      throw new TypeError('fetch failed: connection reset by peer (ECONNRESET)');
    };

    const client = new Convey({
      apiKey: 'sk_live_test',
      maxRetries: 1,
      fetch: mockFetch as unknown as typeof fetch,
    });

    let thrownError: unknown;
    try {
      await client.messages.send({
        channel: Channel.SMS,
        recipient: '+15551234567',
        content: { body: 'Network fail' },
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(ConveyNetworkError);
    const netErr = thrownError as ConveyNetworkError;
    expect(netErr.message).toContain('Network request failed');
    expect(netErr.cause).toBeDefined();
  });

  it('should parse HTTP-Date string in Retry-After header correctly', async () => {
    let attempts = 0;
    const futureDate = new Date(Date.now() + 10).toUTCString();

    const mockFetch = async (): Promise<Response> => {
      attempts++;
      if (attempts === 1) {
        return new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Slow down' } }), {
          status: 429,
          headers: { 'Retry-After': futureDate },
        });
      }
      return new Response(JSON.stringify({ success: true, publicId: 'msg_date_retry_ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_test',
      maxRetries: 2,
      fetch: mockFetch as unknown as typeof fetch,
    });

    const result = await client.messages.send({
      channel: Channel.SMS,
      recipient: '+15551234567',
      content: { body: 'Testing HTTP-Date retry' },
    });

    expect(attempts).toBe(2);
    expect(result.publicId).toBe('msg_date_retry_ok');
  });

  it('should handle zero retry policy (maxRetries = 0) fail-fast immediately on 503', async () => {
    let attempts = 0;
    const mockFetch = async (): Promise<Response> => {
      attempts++;
      return new Response(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' } }), {
        status: 503,
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_test',
      maxRetries: 0,
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(
      client.messages.send({
        channel: Channel.SMS,
        recipient: '+15551234567',
        content: { body: 'No retry' },
      }),
    ).rejects.toBeInstanceOf(ConveyApiError);

    expect(attempts).toBe(1);
  });

  it('should abort in-flight requests when external AbortSignal triggers', async () => {
    const controller = new AbortController();

    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(new Response(JSON.stringify({ success: true })));
        }, 500);

        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('User aborted request', 'AbortError'));
          });
        }
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_test',
      maxRetries: 0,
      fetch: mockFetch as unknown as typeof fetch,
    });

    // Abort after 20ms
    setTimeout(() => controller.abort(), 20);

    await expect(
      client.messages.send(
        {
          channel: Channel.EMAIL,
          recipient: 'user@test.com',
          content: { body: 'Abort test' },
        },
        { signal: controller.signal },
      ),
    ).rejects.toThrow('Request aborted by caller AbortSignal.');
  });

  it('should include custom request headers while preserving authorization and idempotency headers', async () => {
    let capturedHeaders: Headers | undefined;

    const mockFetch = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true, publicId: 'msg_custom_headers' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_test',
      fetch: mockFetch as unknown as typeof fetch,
    });

    await client.messages.send(
      {
        channel: Channel.EMAIL,
        recipient: 'user@test.com',
        content: { body: 'Custom headers' },
      },
      {
        headers: {
          'x-custom-tenant': 'tenant_custom_42',
          'x-convey-sandbox': 'true',
        },
      },
    );

    expect(capturedHeaders?.get('x-custom-tenant')).toBe('tenant_custom_42');
    expect(capturedHeaders?.get('x-convey-sandbox')).toBe('true');
    expect(capturedHeaders?.get('Authorization')).toBe('Bearer sk_live_test');
    expect(capturedHeaders?.get('Idempotency-Key')).toBeDefined();
  });
});
