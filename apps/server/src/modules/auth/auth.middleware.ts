import { and, eq, gte, isNull, or } from 'drizzle-orm';
import { db } from '../../db';
import { apiKeys, tenants } from '../../db/schema';
import { hashString } from '../../utils/crypto';

interface CachedApiKey {
  valid: boolean;
  tenantId?: string;
  team?: string;
  keyName?: string;
  error?: string;
  cachedAt: number;
}

const apiKeyCache = new Map<string, CachedApiKey>();
const API_KEY_CACHE_TTL_MS = 30_000; // 30s cache

export function clearApiKeyCache() {
  apiKeyCache.clear();
}

export async function validateApiKey(apiKeyRaw: string): Promise<{
  valid: boolean;
  tenantId?: string;
  team?: string;
  keyName?: string;
  error?: string;
}> {
  if (!apiKeyRaw) {
    return { valid: false, error: 'API Key missing' };
  }

  const keyHash = hashString(apiKeyRaw);
  const now = new Date();
  const cached = apiKeyCache.get(keyHash);
  if (cached && Date.now() - cached.cachedAt < API_KEY_CACHE_TTL_MS) {
    return cached;
  }

  const rows = await db
    .select({
      keyId: apiKeys.id,
      tenantId: apiKeys.tenantId,
      team: apiKeys.team,
      keyName: apiKeys.name,
      tenantStatus: tenants.status,
    })
    .from(apiKeys)
    .innerJoin(tenants, eq(apiKeys.tenantId, tenants.id))
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.active, true),
        or(isNull(apiKeys.expiresAt), gte(apiKeys.expiresAt, now)),
        eq(tenants.status, 'active'),
      ),
    );

  if (!rows.length) {
    return { valid: false, error: 'Invalid or expired API Key' };
  }

  const row = rows[0];
  const result = {
    valid: true,
    tenantId: row.tenantId,
    team: row.team,
    keyName: row.keyName,
  };
  apiKeyCache.set(keyHash, { ...result, cachedAt: Date.now() });
  return result;
}

export function extractApiKeyFromHeaders(headers: Record<string, string | undefined>): string | null {
  const authHeader = headers.authorization || headers.Authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const apiKeyHeader = headers['x-api-key'] || headers['X-API-Key'];
  if (apiKeyHeader) {
    return apiKeyHeader.trim();
  }
  return null;
}

import { UserRole } from './audit-log.service';

export function requireRoles(
  allowedRoles: UserRole[],
  currentRole: UserRole | string = UserRole.ORG_ADMIN,
): { authorized: boolean; errorResponse?: Response } {
  if (allowedRoles.includes(currentRole as UserRole) || currentRole === UserRole.ORG_ADMIN) {
    return { authorized: true };
  }

  return {
    authorized: false,
    errorResponse: new Response(
      JSON.stringify({
        error: {
          code: 'FORBIDDEN',
          message: `Action requires one of the following roles: ${allowedRoles.join(', ')}`,
        },
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ),
  };
}

export async function verifyApiAuth(
  headers: Record<string, string | undefined>,
  requireAuth = false,
): Promise<{
  authenticated: boolean;
  tenantId?: string;
  team?: string;
  keyName?: string;
  role?: UserRole;
  isSandbox?: boolean;
  errorResponse?: Response;
}> {
  const apiKeyRaw = extractApiKeyFromHeaders(headers);
  const isSandboxHeader = headers['x-convey-sandbox'] === 'true' || headers['X-Convey-Sandbox'] === 'true';
  const isSandboxKey = apiKeyRaw?.startsWith('sk_test_') || false;
  const isSandbox = isSandboxHeader || isSandboxKey;
  const rawRoleHeader = (headers['x-convey-role'] || headers['X-Convey-Role']) as UserRole | undefined;
  const role = rawRoleHeader && Object.values(UserRole).includes(rawRoleHeader) ? rawRoleHeader : UserRole.ORG_ADMIN;

  if (!apiKeyRaw) {
    if (requireAuth) {
      return {
        authenticated: false,
        errorResponse: new Response(
          JSON.stringify({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Missing required API authentication header (x-api-key or Authorization: Bearer <key>)',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      };
    }
    return { authenticated: false, tenantId: 'default-tenant', team: 'default-team', role, isSandbox };
  }

  const result = await validateApiKey(apiKeyRaw);
  if (!result.valid) {
    return {
      authenticated: false,
      errorResponse: new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: result.error || 'Invalid API Key',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    };
  }

  return {
    authenticated: true,
    tenantId: result.tenantId,
    team: result.team,
    keyName: result.keyName,
    role,
    isSandbox,
  };
}

import type { Elysia } from 'elysia';

export function authMiddleware(app: Elysia) {
  return app
    .beforeHandle(async ({ headers }) => {
      const auth = await verifyApiAuth(headers, false);
      if (auth.errorResponse) {
        return auth.errorResponse;
      }
    })
    .derive(async ({ headers }: { headers: Record<string, string | undefined> }) => {
      const auth = await verifyApiAuth(headers, false);
      return {
        auth: {
          tenantId: auth.tenantId || 'default-tenant',
          team: auth.team || 'default-team',
          role: auth.role || UserRole.ORG_ADMIN,
          isSandbox: auth.isSandbox || false,
        },
      };
    });
}
