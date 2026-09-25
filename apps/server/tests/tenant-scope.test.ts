import { expect, test } from 'bun:test';
import { assertTeamScope } from '../src/modules/auth/tenant-scope';

const scope = { tenantId: 'tenant-a', team: 'team-a', isSandbox: false };
test('a credential cannot select another team', () => {
  expect(() => assertTeamScope(scope, 'team-b')).toThrow();
  expect(() => assertTeamScope(scope, 'team-a')).not.toThrow();
});
test('incomplete identities fail closed', () => {
  expect(() => assertTeamScope({ ...scope, tenantId: '' }, 'team-a')).toThrow();
});
