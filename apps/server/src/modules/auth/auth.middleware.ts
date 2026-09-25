import { and, eq, gt, isNull, or } from 'drizzle-orm';
import type { Elysia } from 'elysia';
import { env } from '../../config/env';
import { db } from '../../db';
import { apiKeys, tenants } from '../../db/schema';
import { hashString } from '../../utils/crypto';
import { type AuthIdentity, authError, authorizeRequest, UserRole } from './access-policy';

// Deliberately uncached: revocation, expiry and tenant suspension apply on the next request.
export function clearApiKeyCache() {}

export async function validateApiKey(
  apiKeyRaw: string,
): Promise<Partial<AuthIdentity> & { valid: boolean; error?: string }> {
  if (!apiKeyRaw) return { valid: false, error: 'API Key missing' };
  const [row] = await db
    .select({
      tenantId: apiKeys.tenantId,
      team: apiKeys.team,
      keyName: apiKeys.name,
      role: apiKeys.role,
      scope: apiKeys.scope,
      sandboxOnly: apiKeys.sandboxOnly,
    })
    .from(apiKeys)
    .innerJoin(tenants, eq(apiKeys.tenantId, tenants.id))
    .where(
      and(
        eq(apiKeys.keyHash, hashString(apiKeyRaw)),
        eq(apiKeys.active, true),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date())),
        eq(tenants.status, 'active'),
      ),
    );
  if (!row || !Object.values(UserRole).includes(row.role as UserRole) || !['tenant', 'platform'].includes(row.scope)) {
    return { valid: false, error: 'Invalid or expired API Key' };
  }
  return {
    valid: true,
    tenantId: row.tenantId,
    team: row.team,
    keyName: row.keyName,
    role: row.role as UserRole,
    scope: row.scope as AuthIdentity['scope'],
    isSandbox: row.sandboxOnly,
  };
}

export function extractApiKeyFromHeaders(headers: Record<string, string | undefined>): string | null {
  const authorization = headers.authorization || headers.Authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim();
  return (headers['x-api-key'] || headers['X-API-Key'])?.trim() || null;
}

export interface AuthResult extends Partial<AuthIdentity> {
  authenticated: boolean;
  errorResponse?: Response;
}

export function createAuthVerifier(lookup: typeof validateApiKey) {
  return async (
    headers: Record<string, string | undefined>,
    requireAuth = env.CONVEY_REQUIRE_AUTH,
  ): Promise<AuthResult> => {
    const key = extractApiKeyFromHeaders(headers);
    const requestedSandbox = headers['x-convey-sandbox'] === 'true' || headers['x-convey-environment'] === 'sandbox';
    if (!key) {
      if (requireAuth || env.NODE_ENV === 'production')
        return { authenticated: false, errorResponse: authError(401, 'API credentials required') };
      return {
        authenticated: false,
        tenantId: 'default-tenant',
        team: 'default-team',
        keyName: 'local-development',
        role: UserRole.ORG_ADMIN,
        scope: 'platform',
        isSandbox: true,
      };
    }
    const result = await lookup(key);
    if (!result.valid) return { authenticated: false, errorResponse: authError(401, 'Invalid or expired API Key') };
    return {
      ...result,
      authenticated: true,
      isSandbox: result.isSandbox || key.startsWith('sk_test_') || requestedSandbox,
    };
  };
}

export const verifyApiAuth = createAuthVerifier(validateApiKey);

export function requireRoles(allowedRoles: UserRole[], currentRole?: UserRole | string) {
  const authorized =
    currentRole !== undefined && (allowedRoles.includes(currentRole as UserRole) || currentRole === UserRole.ORG_ADMIN);
  return { authorized, errorResponse: authorized ? undefined : authError(403, 'Insufficient permissions') };
}

export async function guardApiRequest(headers: Record<string, string | undefined>, method: string, platform = false) {
  const auth = await verifyApiAuth(headers);
  if (auth.errorResponse) return auth.errorResponse;
  return authorizeRequest(auth as AuthIdentity, method, platform);
}

export function authMiddleware(app: Elysia) {
  return app
    .derive(async ({ headers }) => ({ auth: (await verifyApiAuth(headers)) as AuthResult & AuthIdentity }))
    .beforeHandle(({ auth, request }) => auth.errorResponse || authorizeRequest(auth, request.method));
}
