import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { baselineFingerprint } from '../../apps/server/src/db/schema-baseline';

// Own every resource: never accept a user database URL or container name.
const name = `convey-recovery-${crypto.randomUUID()}`;
const root = join(import.meta.dir, '../..');
const started = performance.now();
async function run(args: string[], input?: string | Uint8Array): Promise<string> {
  const child = Bun.spawn(args, { stdin: input === undefined ? 'ignore' : 'pipe', stdout: 'pipe', stderr: 'pipe' });
  if (input !== undefined && child.stdin && typeof child.stdin !== 'number') {
    child.stdin.write(input);
    child.stdin.end();
  }
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code) throw new Error(`${args[0]} failed: ${err}`);
  return out;
}
const sql = (database: string, text: string) =>
  run(
    ['docker', 'exec', '-i', name, 'psql', '-U', 'convey_test', '-d', database, '-X', '-v', 'ON_ERROR_STOP=1', '-At'],
    text,
  );
try {
  await run([
    'docker',
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_USER=convey_test',
    '-e',
    'POSTGRES_PASSWORD=disposable-mock-only',
    '-e',
    'POSTGRES_DB=source_test',
    'postgres:18-alpine',
  ]);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await run(['docker', 'exec', name, 'pg_isready', '-U', 'convey_test', '-d', 'source_test']);
      ready = true;
      break;
    } catch {
      await Bun.sleep(500);
    }
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not start');
  const dir = join(root, 'apps/server/src/db/migrations');
  const sources = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
  const fingerprint = baselineFingerprint(sources);
  await sql(
    'source_test',
    `BEGIN;\n${sources.map((s) => s.sql).join('\n')}\nCREATE TABLE convey_schema_baseline(id integer PRIMARY KEY CHECK(id=1), fingerprint text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());\nINSERT INTO convey_schema_baseline(id,fingerprint) VALUES(1,'${fingerprint}');\nCOMMIT;`,
  );
  await sql(
    'source_test',
    `INSERT INTO tenants(id,name) VALUES('restore-team','Recovery fixture');
INSERT INTO recipient_revocations(recipient_id) VALUES('revoked-fixture');
INSERT INTO budget_reservations(id,message_id,team,channel,provider_id,month,currency,policy_currency,amount_usd,amount_in_policy_currency,exchange_rate) VALUES('uncertain-fixture','mock-message','restore-team','sms','mock','2026-09','USD','USD',0.25,0.25,1);
INSERT INTO outbox(id,message_id,type,payload,state,available_at) VALUES('pending-fixture','mock-message','message_dispatch','{"publicId":"mock-message"}','pending',now());`,
  );
  const snapshot = `SELECT json_build_object('baseline',(SELECT fingerprint FROM convey_schema_baseline),'tenants',(SELECT json_agg(t ORDER BY id) FROM tenants t),'holds',(SELECT json_agg(t ORDER BY id) FROM budget_reservations t),'revocations',(SELECT json_agg(t ORDER BY recipient_id) FROM recipient_revocations t),'outbox',(SELECT json_agg(t ORDER BY id) FROM outbox t))::text;`;
  const before = await sql('source_test', snapshot);
  const dump = await run([
    'docker',
    'exec',
    name,
    'pg_dump',
    '-U',
    'convey_test',
    '-d',
    'source_test',
    '--no-owner',
    '--no-acl',
  ]);
  await run(['docker', 'exec', name, 'createdb', '-U', 'convey_test', 'restored_test']);
  const restoreStarted = performance.now();
  await sql('restored_test', dump);
  if ((await sql('restored_test', snapshot)) !== before)
    throw new Error('Restored accounting, revocation or outbox evidence differs');
  await run(['docker', 'restart', name]);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await sql('restored_test', 'SELECT 1');
      break;
    } catch {
      await Bun.sleep(500);
    }
  }
  if ((await sql('restored_test', snapshot)) !== before) throw new Error('Restart lost durable evidence');
  console.log(
    JSON.stringify(
      {
        mode: 'mock-only',
        baseline: fingerprint,
        restoreAndRestartMs: Math.round(performance.now() - restoreStarted),
        totalMs: Math.round(performance.now() - started),
        preserved: ['baseline', 'tenant', 'uncertain hold', 'pending outbox', 'revocation'],
        limitations: 'Synthetic database snapshot; not a production RPO/RTO or queue-loss certification',
      },
      null,
      2,
    ),
  );
} finally {
  await run(['docker', 'rm', '-f', name]);
}
