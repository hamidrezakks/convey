import { app } from '../../apps/server/src/index';

if (process.env.NODE_ENV !== 'test') throw new Error('Route inventory must run in test mode without workers');
const rows = app.routes
  .filter((route) => route.path.startsWith('/v1/'))
  .map((route) => {
    const boundary = route.path.startsWith('/v1/admin/')
      ? 'Platform role; writes require admin'
      : route.path.startsWith('/v1/webhooks/')
        ? 'Provider-specific signature or verification token'
        : route.path.startsWith('/v1/t/')
          ? 'Tracking token'
          : 'API credential; tenant/team/environment scope';
    return `| ${route.method} | ${route.path} | ${boundary} |`;
  })
  .sort();
const content = `# Registered API access inventory\n\nGenerated from Elysia route registration. Boundary labels are expected policy, not proof of every authorized combination. The strict-auth suite checks every registered API-key route for anonymous rejection; webhook signatures and tracking tokens require their separate tests. Role, cross-team and sandbox cases are exercised by access-policy and hardening/security tests.\n\n| Method | Route | Expected boundary |\n| --- | --- | --- |\n${rows.join('\n')}\n`;
const file = new URL('../../docs/operations/api-access-matrix.md', import.meta.url);
if (process.argv.includes('--check')) {
  if ((await Bun.file(file).text()) !== content)
    throw new Error('Route inventory drift: regenerate qualification:access');
} else await Bun.write(file, content);
console.log(`Inventoried ${rows.length} API routes`);
process.exit(0);
