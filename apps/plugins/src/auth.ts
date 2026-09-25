import type { Elysia } from 'elysia';

interface PluginIdentity {
  tenantId: string;
  team: string;
  role: string;
  isSandbox: boolean;
}
export async function resolvePluginIdentity(
  headers: Record<string, string | undefined>,
): Promise<PluginIdentity | Response> {
  const authorization = headers.authorization || (headers['x-api-key'] ? `Bearer ${headers['x-api-key']}` : '');
  if (!authorization) return Response.json({ error: 'API credentials required' }, { status: 401 });
  try {
    const response = await fetch(`${process.env.CONVEY_API_INTERNAL_URL || 'http://localhost:3000'}/v1/auth/session`, {
      headers: {
        authorization,
        'x-convey-environment': headers['x-convey-environment'] || 'production',
        'x-convey-sandbox': headers['x-convey-sandbox'] || 'false',
      },
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok)
      return Response.json({ error: 'Authentication failed' }, { status: response.status === 401 ? 401 : 503 });
    const identity = (await response.json()) as PluginIdentity;
    if (
      !identity.tenantId ||
      !identity.team ||
      !['ORG_ADMIN', 'DEVELOPER', 'AUDITOR', 'SUPPORT_AGENT'].includes(identity.role)
    )
      throw new Error('Invalid identity');
    return identity;
  } catch {
    return Response.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }
}

export function pluginAuth(app: Elysia) {
  return app
    .derive(async ({ headers, path }) => ({
      pluginIdentity: path.endsWith('/preferences/unsubscribe') ? undefined : await resolvePluginIdentity(headers),
    }))
    .beforeHandle(({ pluginIdentity, body, query, request }) => {
      if (pluginIdentity === undefined) return;
      if (pluginIdentity instanceof Response) return pluginIdentity;
      if (pluginIdentity.isSandbox)
        return Response.json({ error: 'Plugins do not yet support sandbox data' }, { status: 403 });
      if (!['GET', 'HEAD'].includes(request.method) && !['ORG_ADMIN', 'DEVELOPER'].includes(pluginIdentity.role))
        return Response.json({ error: 'Read-only credential' }, { status: 403 });
      for (const input of [body, query]) {
        if (!input || typeof input !== 'object') continue;
        const values = input as Record<string, unknown>;
        if (
          (values.tenantId !== undefined && values.tenantId !== pluginIdentity.tenantId) ||
          (values.team !== undefined && values.team !== pluginIdentity.team)
        ) {
          return Response.json({ error: 'Tenant or team mismatch' }, { status: 403 });
        }
      }
    });
}
