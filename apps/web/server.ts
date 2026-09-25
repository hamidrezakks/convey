import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dir, 'dist');
export async function serveConsole(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const plugin = url.pathname.startsWith('/api/v1/plugins/');
  const core = ['/v1/', '/health', '/metrics', '/swagger'].some((prefix) => url.pathname.startsWith(prefix));
  if (plugin || core) {
    const base = plugin
      ? process.env.CONVEY_PLUGINS_INTERNAL_URL || 'http://localhost:3001'
      : process.env.CONVEY_API_INTERNAL_URL || 'http://localhost:3000';
    const target = new URL(base);
    target.pathname = url.pathname;
    target.search = url.search;
    const headers = new Headers(request.headers);
    for (const name of ['host', 'connection', 'content-length']) headers.delete(name);
    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
        signal: request.signal,
      });
      return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
    } catch {
      return Response.json({ error: 'Upstream service unavailable' }, { status: 503 });
    }
  }
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const path = resolve(root, `.${pathname}`);
  if (!path.startsWith(`${root}${sep}`) && path !== root) return new Response('Not found', { status: 404 });
  const asset = Bun.file(path);
  const file = (await asset.exists()) ? asset : Bun.file(resolve(root, 'index.html'));
  return new Response(request.method === 'HEAD' ? null : file, {
    headers: { 'Content-Type': file.type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' },
  });
}
if (import.meta.main) Bun.serve({ port: Number(process.env.PORT || 5173), hostname: '0.0.0.0', fetch: serveConsole });
