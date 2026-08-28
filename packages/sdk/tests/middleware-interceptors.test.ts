import { describe, expect, it } from 'bun:test';
import { Convey, type ConveyMiddleware } from '../src';

describe('Middleware & Interceptor Pipeline Suite', () => {
  it('should execute onRequest interceptors in order and allow header mutation', async () => {
    let capturedHeaders: Headers | undefined;
    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true, publicId: 'msg_mw_01' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const executionLog: string[] = [];

    const authMiddleware: ConveyMiddleware = {
      name: 'auth-injector',
      onRequest: (ctx) => {
        executionLog.push('auth:req');
        ctx.headers['x-custom-tenant-auth'] = 'jwt_token_xyz';
        return ctx;
      },
    };

    const metricsMiddleware: ConveyMiddleware = {
      name: 'metrics-tracer',
      onRequest: (ctx) => {
        executionLog.push('metrics:req');
        ctx.headers['x-client-timestamp'] = '1724520000';
      },
      onResponse: (ctx) => {
        executionLog.push('metrics:res');
        expect(ctx.durationMs).toBeGreaterThanOrEqual(0);
        return ctx;
      },
    };

    client.use(authMiddleware);
    client.use(metricsMiddleware);

    const res = await client.messages.send({
      channel: 'EMAIL',
      recipient: 'user@test.com',
      content: { body: 'Middleware test' },
    });

    expect(res.publicId).toBe('msg_mw_01');
    expect(capturedHeaders?.get('x-custom-tenant-auth')).toBe('jwt_token_xyz');
    expect(capturedHeaders?.get('x-client-timestamp')).toBe('1724520000');
    expect(executionLog).toEqual(['auth:req', 'metrics:req', 'metrics:res']);
  });

  it('should execute onError interceptors on request failure without swallowing the error', async () => {
    let errorCaughtInMiddleware = false;
    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Message not found' } }), {
        status: 404,
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    client.use({
      onError: (ctx) => {
        errorCaughtInMiddleware = true;
        expect(ctx.error.message).toContain('Message not found');
        expect(ctx.attempt).toBe(1);
      },
    });

    await expect(client.messages.get('msg_nonexistent')).rejects.toThrow('Message not found');
    expect(errorCaughtInMiddleware).toBe(true);
  });
});
