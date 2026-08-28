import { describe, expect, it } from 'bun:test';
import {
  Convey,
  ConveyConfigurationError,
  ConveyEnvironment,
  normalizeBaseUrl,
  resolveBaseUrl,
  resolveEnvironmentUrl,
} from '../src';

describe('Base URL & Environment Presets Resolution Suite', () => {
  it('should normalize URLs correctly (strip trailing slashes, enforce protocol)', () => {
    expect(normalizeBaseUrl('https://api.convey.dev/')).toBe('https://api.convey.dev');
    expect(normalizeBaseUrl('http://localhost:3000///')).toBe('http://localhost:3000');
    expect(normalizeBaseUrl('https://custom.host:8080/subpath/')).toBe('https://custom.host:8080/subpath');
    expect(() => normalizeBaseUrl('')).toThrow(ConveyConfigurationError);
    expect(() => normalizeBaseUrl('ftp://invalid.com')).toThrow(ConveyConfigurationError);
  });

  it('should map environment presets to canonical endpoints', () => {
    expect(resolveEnvironmentUrl('production')).toBe('https://api.convey.dev');
    expect(resolveEnvironmentUrl('PRODUCTION')).toBe('https://api.convey.dev');
    expect(resolveEnvironmentUrl(ConveyEnvironment.PRODUCTION)).toBe('https://api.convey.dev');

    expect(resolveEnvironmentUrl('us')).toBe('https://us.api.convey.dev');
    expect(resolveEnvironmentUrl(ConveyEnvironment.US)).toBe('https://us.api.convey.dev');

    expect(resolveEnvironmentUrl('eu')).toBe('https://eu.api.convey.dev');
    expect(resolveEnvironmentUrl(ConveyEnvironment.EU)).toBe('https://eu.api.convey.dev');

    expect(resolveEnvironmentUrl('staging')).toBe('https://staging.api.convey.dev');
    expect(resolveEnvironmentUrl(ConveyEnvironment.STAGING)).toBe('https://staging.api.convey.dev');

    expect(resolveEnvironmentUrl('local')).toBe('http://localhost:3000');
    expect(resolveEnvironmentUrl(ConveyEnvironment.LOCAL)).toBe('http://localhost:3000');

    expect(resolveEnvironmentUrl('sandbox')).toBe('https://sandbox.api.convey.dev');
    expect(resolveEnvironmentUrl(ConveyEnvironment.SANDBOX)).toBe('https://sandbox.api.convey.dev');

    expect(() => resolveEnvironmentUrl('mars_region')).toThrow(ConveyConfigurationError);
  });

  it('should resolve base URL strictly in priority order', () => {
    // 1. Explicit baseUrl wins over environment and env var
    expect(
      resolveBaseUrl({
        baseUrl: 'https://override.internal',
        environment: ConveyEnvironment.PRODUCTION,
      }),
    ).toBe('https://override.internal');

    // 2. Environment preset wins over env var
    expect(resolveBaseUrl({ environment: ConveyEnvironment.EU })).toBe('https://eu.api.convey.dev');

    // 3. Fallback to process.env.CONVEY_BASE_URL
    const prevEnv = process.env.CONVEY_BASE_URL;
    try {
      process.env.CONVEY_BASE_URL = 'https://env.convey.internal';
      expect(resolveBaseUrl({})).toBe('https://env.convey.internal');
    } finally {
      if (prevEnv) process.env.CONVEY_BASE_URL = prevEnv;
      else delete process.env.CONVEY_BASE_URL;
    }

    // 4. Strict fail-fast when nothing is provided
    delete process.env.CONVEY_BASE_URL;
    expect(() => resolveBaseUrl({})).toThrow(ConveyConfigurationError);
  });

  it('should support per-request base URL override on HTTP calls', async () => {
    let capturedUrl = '';
    const mockFetch = async (input: RequestInfo | URL): Promise<Response> => {
      capturedUrl = input.toString();
      return new Response(JSON.stringify({ success: true, publicId: 'msg_01' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      environment: ConveyEnvironment.US,
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(client.baseUrl).toBe('https://us.api.convey.dev');

    // Request 1: default client base URL
    await client.messages.send({
      channel: 'EMAIL',
      recipient: 'test@example.com',
      content: { body: 'Hello' },
    });
    expect(capturedUrl).toBe('https://us.api.convey.dev/v1/messages');

    // Request 2: per-request base URL override
    await client.messages.send(
      {
        channel: 'EMAIL',
        recipient: 'test@example.com',
        content: { body: 'Hello' },
      },
      { baseUrl: 'https://eu.api.convey.dev' },
    );
    expect(capturedUrl).toBe('https://eu.api.convey.dev/v1/messages');
  });
});
