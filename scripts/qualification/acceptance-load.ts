import { env } from '../../apps/server/src/config/env';
import { queryClient } from '../../apps/server/src/db';
import { app } from '../../apps/server/src/index';
import { hashString } from '../../apps/server/src/utils/crypto';

if (env.NODE_ENV !== 'test' || !/test|hardening/.test(env.POSTGRES_DB))
  throw new Error('Disposable test database required');
const team = `qualification_${crypto.randomUUID()}`;
const key = crypto.randomUUID();
const tenant = crypto.randomUUID();
const originalAuth = env.CONVEY_REQUIRE_AUTH;
const durations: number[] = [];
const count = 200;
const concurrency = 10;
try {
  env.CONVEY_REQUIRE_AUTH = true;
  await queryClient`INSERT INTO tenants(id,name) VALUES(${tenant},'Mock load fixture')`;
  await queryClient`INSERT INTO api_keys(id,tenant_id,team,key_hash,name) VALUES(${key},${tenant},${team},${hashString(key)},'Mock load fixture')`;
  // No workers are started; this profile measures authenticated durable acceptance only.
  for (let offset = 0; offset < count; offset += concurrency) {
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const start = performance.now();
        const response = await app.handle(
          new Request('http://localhost/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            body: JSON.stringify({
              team,
              userId: 'mock-user',
              category: 'transactional',
              country: 'US',
              priority: 'normal',
              idempotencyKey: crypto.randomUUID(),
              recipients: { email: 'mock@example.test' },
              channels: [{ channel: 'email', content: { subject: 'Mock load', text: 'No external delivery' } }],
            }),
          }),
        );
        durations.push(performance.now() - start);
        if (response.status !== 202) throw new Error(`Acceptance rejected: ${response.status}`);
      }),
    );
  }
  const [messages] = await queryClient`SELECT count(*)::int AS total FROM messages WHERE team=${team}`;
  const [outbox] =
    await queryClient`SELECT count(*)::int AS total FROM outbox WHERE message_id IN (SELECT public_id FROM messages WHERE team=${team})`;
  if (messages.total !== count || outbox.total !== count) throw new Error('Acknowledged work was not durable');
  durations.sort((a, b) => a - b);
  const percentile = (fraction: number) =>
    Math.round(durations[Math.ceil(durations.length * fraction) - 1] * 100) / 100;
  const p95 = percentile(0.95),
    p99 = percentile(0.99);
  console.log(
    JSON.stringify(
      {
        mode: 'mock-only',
        profile: {
          count,
          concurrency,
          payload: 'single short email',
          transport: 'in-process app.handle; local PostgreSQL and Redis',
        },
        acceptanceMs: { p95, p99, max: durations.at(-1) },
        targets: { p95: 250, p99: 1000 },
        passed: p95 <= 250 && p99 <= 1000,
        limitations:
          'Synthetic acceptance burst only, not network/container latency, sustained load or vendor delivery',
      },
      null,
      2,
    ),
  );
  if (p95 > 250 || p99 > 1000) throw new Error('Proposed acceptance target exceeded');
} finally {
  env.CONVEY_REQUIRE_AUTH = originalAuth;
  await queryClient`DELETE FROM outbox WHERE message_id IN (SELECT public_id FROM messages WHERE team=${team})`;
  await queryClient`DELETE FROM messages WHERE team=${team}`;
  await queryClient`DELETE FROM api_keys WHERE tenant_id=${tenant}`;
  await queryClient`DELETE FROM team_owners WHERE tenant_id=${tenant}`;
  await queryClient`DELETE FROM tenants WHERE id=${tenant}`;
}
process.exit(0);
