import type { AuthIdentity } from './access-policy';

export type TenantScope = Pick<AuthIdentity, 'tenantId' | 'team' | 'isSandbox' | 'developmentBypass'>;
export class TenantScopeError extends Error {
  constructor() {
    super('Requested team does not belong to this credential');
  }
}
export function assertTeamScope(scope: TenantScope, team: string): void {
  if (scope.developmentBypass) return;
  if (!scope.tenantId || !scope.team || scope.team !== team) throw new TenantScopeError();
}
