import './setup';
import { afterEach, expect, test } from 'bun:test';
import { createApiClient } from '../src/lib/http';
import { getApiKey, getSession, setSession } from '../src/lib/session';

afterEach(() => setSession('', null));
test('configured clients attach credentials and environment to remote requests', async () => {
  setSession('test-only-key', {
    tenantId: 'a',
    team: 'a-team',
    role: 'AUDITOR',
    scope: 'platform',
    keyName: 'test',
    isSandbox: false,
  });
  let captured: Request | undefined;
  const client = createApiClient('https://convey.example/v1').extend({
    fetch: async (input) => {
      captured = input as Request;
      return Response.json({ ok: true });
    },
  });
  await client.get('templates');
  expect(captured?.url).toBe('https://convey.example/v1/templates');
  expect(captured?.headers.get('authorization')).toBe('Bearer test-only-key');
  expect(captured?.headers.get('x-convey-environment')).toBe('production');
});
test('a rejected credential clears the in-memory session', async () => {
  setSession('expired-key', {
    tenantId: 'a',
    team: 'a-team',
    role: 'AUDITOR',
    scope: 'platform',
    keyName: 'test',
    isSandbox: false,
  });
  const client = createApiClient('https://convey.example/v1').extend({
    fetch: async () => new Response(null, { status: 401 }),
  });
  await expect(client.get('auth/session')).rejects.toThrow();
  expect(getSession()).toBeNull();
  expect(getApiKey()).toBe('');
});
