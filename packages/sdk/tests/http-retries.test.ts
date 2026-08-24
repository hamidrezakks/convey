import { describe, expect, it } from 'bun:test';
import {
  Channel,
  Convey,
  ConveyAuthenticationError,
  ConveyConflictError,
  ConveyRateLimitError,
  ConveyTimeoutError,
  ConveyValidationError,
} from '../src';

describe('HTTP Engine & Deterministic Resilience', () => {
  it('should successfully make requests and parse JSON responses', async () => {
    let capturedUrl = '';
    let capturedHeaders: Headers | undefined;

    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedUrl = input.toString();
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true, publicId: 'msg_01J9X8K' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({ apiKey: 'sk_live_12345', fetch: mockFetch as unknown as typeof fetch });
    const result = await client.messages.send({
      channel: Channel.EMAIL,
      recipient: 'user@test.com',
      content: { subject: 'Test', body: 'Hello' },
    });

    expect(capturedUrl).toBe('http://localhost:3000/v1/messages');
    expect(capturedHeaders?.get('Authorization')).toBe('Bearer sk_live_12345');
    expect(capturedHeaders?.get('x-api-key')).toBe('sk_live_12345');
    expect(capturedHeaders?.get('Idempotency-Key')).toMatch(/^sdk_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(capturedHeaders?.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(result.publicId).toBe('msg_01J9X8K');
  });

  it('should retry automatically on HTTP 429 and parse Retry-After header', async () => {
    let attempts = 0;

    const mockFetch = async (): Promise<Response> => {
      attempts++;
      if (attempts === 1) {
        return new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }), {
          status: 429,
          headers: { 'Retry-After': '0' },
        });
      }
      return new Response(JSON.stringify({ success: true, publicId: 'msg_recovered' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({ apiKey: 'sk_live_123', maxRetries: 2, fetch: mockFetch as unknown as typeof fetch });
    const res = await client.messages.send({
      channel: Channel.SMS,
      recipient: '+14155550000',
      content: { body: 'Test' },
    });

    expect(attempts).toBe(2);
    expect(res.publicId).toBe('msg_recovered');
  });

  it('should retry on transient HTTP 503 and succeed on recovery', async () => {
    let attempts = 0;

    const mockFetch = async (): Promise<Response> => {
      attempts++;
      if (attempts < 3) {
        return new Response(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Temporary overload' } }), {
          status: 503,
        });
      }
      return new Response(JSON.stringify({ success: true, batch: { id: 'batch_01' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({ apiKey: 'sk_live_123', maxRetries: 3, fetch: mockFetch as unknown as typeof fetch });
    const res = await client.batches.create({ totalCount: 100 });

    expect(attempts).toBe(3);
    expect(res.batch.id).toBe('batch_01');
  });

  it('should fail-fast immediately on 400 Validation Error without retrying', async () => {
    let attempts = 0;

    const mockFetch = async (): Promise<Response> => {
      attempts++;
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid phone format',
            details: [{ path: 'recipient', message: 'Must be E.164' }],
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const client = new Convey({ apiKey: 'sk_live_123', maxRetries: 3, fetch: mockFetch as unknown as typeof fetch });

    let thrownError: unknown;
    try {
      await client.messages.send({
        channel: Channel.SMS,
        recipient: 'invalid_phone',
        content: { body: 'Test' },
      });
    } catch (err) {
      thrownError = err;
    }

    expect(attempts).toBe(1); // No retries for 400
    expect(thrownError).toBeInstanceOf(ConveyValidationError);
    const valErr = thrownError as ConveyValidationError;
    expect(valErr.statusCode).toBe(400);
    expect(valErr.errorCode).toBe('VALIDATION_ERROR');
    expect(valErr.details).toBeDefined();
  });

  it('should throw ConveyAuthenticationError on HTTP 401', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid API Key' } }), {
        status: 401,
      });
    };

    const client = new Convey({ apiKey: 'sk_live_bad', fetch: mockFetch as unknown as typeof fetch });
    expect(
      client.messages.send({
        channel: Channel.EMAIL,
        recipient: 'user@test.com',
        content: { body: 'Test' },
      }),
    ).rejects.toBeInstanceOf(ConveyAuthenticationError);
  });

  it('should throw ConveyConflictError on HTTP 409', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Payload hash mismatch for key' } }),
        { status: 409 },
      );
    };

    const client = new Convey({ apiKey: 'sk_live_123', fetch: mockFetch as unknown as typeof fetch });
    expect(
      client.messages.send({
        channel: Channel.EMAIL,
        recipient: 'user@test.com',
        content: { body: 'Test' },
        idempotencyKey: 'dup_key',
      }),
    ).rejects.toBeInstanceOf(ConveyConflictError);
  });

  it('should throw ConveyRateLimitError when 429 retries are exhausted', async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Quota exceeded' } }), {
        status: 429,
        headers: { 'Retry-After': '0' },
      });
    };

    const client = new Convey({ apiKey: 'sk_live_123', maxRetries: 1, fetch: mockFetch as unknown as typeof fetch });
    let error: ConveyRateLimitError | undefined;
    try {
      await client.messages.send({
        channel: Channel.SMS,
        recipient: '+14155550000',
        content: { body: 'Test' },
      });
    } catch (err) {
      if (err instanceof ConveyRateLimitError) {
        error = err;
      }
    }

    expect(error).toBeDefined();
    expect(error?.retryAfterSeconds).toBe(0);
  });

  it('should abort request and throw ConveyTimeoutError when deadline is exceeded', async () => {
    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(new Response(JSON.stringify({ success: true })));
        }, 100);

        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        }
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      timeoutMs: 10,
      maxRetries: 0,
      fetch: mockFetch as unknown as typeof fetch,
    });
    expect(
      client.messages.send({
        channel: Channel.EMAIL,
        recipient: 'user@test.com',
        content: { body: 'Slow' },
      }),
    ).rejects.toBeInstanceOf(ConveyTimeoutError);
  });
});
