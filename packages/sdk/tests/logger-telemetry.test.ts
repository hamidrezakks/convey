import { describe, expect, it } from 'bun:test';
import { Convey, type ConveyLogger, sanitizeLogData } from '../src';

describe('Structured Logging & Sensitive Masking Suite', () => {
  it('should mask sensitive keys (apiKey, authorization, tokens, passwords)', () => {
    const raw = {
      apiKey: 'sk_live_secretkey12345678',
      shortKey: 'secret1',
      Authorization: 'Bearer sk_live_9999999999',
      recipient: 'user@test.com',
      nested: {
        token: 'tok_abc123456789',
        normalField: 'ok',
      },
    };

    const sanitized = sanitizeLogData(raw);
    expect(sanitized.apiKey).toContain('[REDACTED]');
    expect(sanitized.shortKey).toBe('[REDACTED]');
    expect(sanitized.Authorization).toContain('[REDACTED]');
    expect(sanitized.recipient).toBe('user@test.com');
    expect(sanitized.nested.token).toContain('[REDACTED]');
    expect(sanitized.nested.normalField).toBe('ok');
  });

  it('should route log messages to custom logger interface', async () => {
    const logEvents: Array<{ level: string; msg: string }> = [];

    const customLogger: ConveyLogger = {
      debug: (msg) => logEvents.push({ level: 'debug', msg }),
      info: (msg) => logEvents.push({ level: 'info', msg }),
      warn: (msg) => logEvents.push({ level: 'warn', msg }),
      error: (msg) => logEvents.push({ level: 'error', msg }),
    };

    const mockFetch = async (): Promise<Response> => {
      return new Response(JSON.stringify({ success: true, publicId: 'msg_log_01' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      logger: customLogger,
      logLevel: 'debug',
      fetch: mockFetch as unknown as typeof fetch,
    });

    await client.messages.send({
      channel: 'EMAIL',
      recipient: 'logger@test.com',
      content: { body: 'Testing logger' },
    });

    expect(logEvents.length).toBeGreaterThan(0);
    expect(logEvents.some((e) => e.level === 'debug')).toBe(true);
  });
});
