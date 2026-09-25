export enum UserRole {
  ORG_ADMIN = 'ORG_ADMIN',
  DEVELOPER = 'DEVELOPER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  AUDITOR = 'AUDITOR',
}

export interface AuthIdentity {
  tenantId: string;
  team: string;
  keyName: string;
  role: UserRole;
  scope: 'tenant' | 'platform';
  isSandbox: boolean;
}

export function authError(status: number, message: string): Response {
  return Response.json({ error: { code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message } }, { status });
}

export function authorizeRequest(identity: AuthIdentity, method: string, platform = false): Response | undefined {
  if (platform && identity.scope !== 'platform') return authError(403, 'Platform credentials required');
  const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (
    !readOnly &&
    (platform
      ? identity.role !== UserRole.ORG_ADMIN
      : ![UserRole.ORG_ADMIN, UserRole.DEVELOPER].includes(identity.role))
  ) {
    return authError(403, 'This credential does not permit this operation');
  }
}
