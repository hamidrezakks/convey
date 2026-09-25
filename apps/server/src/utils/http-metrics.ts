import type { Elysia } from 'elysia';
import { Counter, Histogram, type Registry } from 'prom-client';

export function createHttpMetrics(registry: Registry) {
  const requests = new Counter({
    name: 'convey_http_requests_total',
    help: 'Completed HTTP requests',
    labelNames: ['method', 'path', 'status'],
    registers: [registry],
  });
  const duration = new Histogram({
    name: 'convey_http_request_duration_seconds',
    help: 'HTTP response latency; not provider delivery latency',
    labelNames: ['method', 'path'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });
  function instrument(app: Elysia) {
    let patterns: Array<{ method: string; path: string; regex: RegExp }> = [];
    let routeCount = -1;
    return app.wrap((next) => async (request, ...rest) => {
      if (routeCount !== app.routes.length) {
        patterns = app.routes.map(({ method, path }) => ({
          method,
          path,
          regex: new RegExp(
            `^${path
              .split('/')
              .map((segment) =>
                segment.startsWith(':')
                  ? '[^/]+'
                  : segment === '*'
                    ? '.*'
                    : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              )
              .join('/')}/*$`,
          ),
        }));
        routeCount = app.routes.length;
      }
      const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(request.method)
        ? request.method
        : 'OTHER';
      const pathname = new URL(request.url).pathname;
      const candidates = patterns.filter((entry) => entry.method === request.method || entry.method === 'ALL');
      const matched =
        candidates.find((entry) => entry.path === pathname) || candidates.find((entry) => entry.regex.test(pathname));
      const path = matched?.path || '__unmatched__';
      const started = performance.now();
      let status = 500;
      try {
        const response = await next(request, ...rest);
        status = response.status;
        return response;
      } finally {
        requests.inc({ method, path, status: String(status) });
        duration.observe({ method, path }, (performance.now() - started) / 1000);
      }
    });
  }
  return { requests, duration, instrument };
}
