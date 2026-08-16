import { and, eq, gte, isNull, or } from 'drizzle-orm';
import { db } from '../../db';
import { apiKeys, tenants } from '../../db/schema';
import { hashString } from '../../utils/crypto';

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

  const keys = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.active, true),
        or(isNull(apiKeys.expiresAt), gte(apiKeys.expiresAt, now)),
      ),
    );

  if (!keys.length) {
    return { valid: false, error: 'Invalid or expired API Key' };
  }

  const key = keys[0];

  // Validate active status of parent tenant organization
  const tenantRows = await db.select().from(tenants).where(eq(tenants.id, key.tenantId));
  if (!tenantRows.length || tenantRows[0].status !== 'active') {
    return { valid: false, error: 'Associated tenant organization is inactive' };
  }

  return {
    valid: true,
    tenantId: key.tenantId,
    team: key.team,
    keyName: key.name,
  };
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
