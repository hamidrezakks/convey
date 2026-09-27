import { describe, expect, test } from 'bun:test';
import { parseEnv } from '../src/config/env';
import { type AuthIdentity, authorizeRequest, UserRole } from '../src/modules/auth/access-policy';
import { createAuthVerifier, requireRoles } from '../src/modules/auth/auth.middleware';

const identity: AuthIdentity = {
  tenantId: 'a',
  team: 'a-team',
  keyName: 'test',
  role: UserRole.DEVELOPER,
  scope: 'tenant',
  isSandbox: false,
};
describe('credential access policy', () => {
  test('missing credentials fail closed', async () => {
    const verify = createAuthVerifier(async () => ({ valid: false }));
    expect((await verify({}, true)).errorResponse?.status).toBe(401);
  });
  test('role headers never override stored permissions', async () => {
    const verify = createAuthVerifier(async () => ({ valid: true, ...identity }));
    const result = await verify({ 'x-api-key': 'test', 'x-convey-role': 'ORG_ADMIN' });
    expect(result.role).toBe(UserRole.DEVELOPER);
    expect(result.scope).toBe('tenant');
  });
  test('tenant administrators cannot access platform operations', () => {
    expect(authorizeRequest({ ...identity, role: UserRole.ORG_ADMIN }, 'GET', true)?.status).toBe(403);
  });
  test('auditors can read but cannot mutate', () => {
    const auditor = { ...identity, role: UserRole.AUDITOR, scope: 'platform' as const };
    expect(authorizeRequest(auditor, 'GET', true)).toBeUndefined();
    expect(authorizeRequest(auditor, 'POST', true)?.status).toBe(403);
    expect(authorizeRequest(auditor, 'DELETE')?.status).toBe(403);
  });
  test('missing roles are denied', () => expect(requireRoles([UserRole.DEVELOPER]).authorized).toBe(false));
  test('sandbox credentials cannot select production', async () => {
    const verify = createAuthVerifier(async () => ({ valid: true, ...identity, isSandbox: true }));
    expect((await verify({ 'x-api-key': 'test', 'x-convey-environment': 'production' })).isSandbox).toBe(true);
  });
  test('production rejects the local development bypass', () => {
    expect(parseEnv({}).CONVEY_REQUIRE_AUTH).toBe(true);
    expect(() => parseEnv({ NODE_ENV: 'production', CONVEY_REQUIRE_AUTH: 'false' })).toThrow();
  });
});
