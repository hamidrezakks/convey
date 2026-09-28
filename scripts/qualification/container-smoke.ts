import { createHash, createHmac, randomBytes } from 'node:crypto';

const prefix = `convey-smoke-${crypto.randomUUID().slice(0, 8)}`;
const network = `${prefix}-net`;
const containers: string[] = [];
const key = randomBytes(24).toString('hex');
const encryptionKey = randomBytes(32).toString('hex');
async function run(args: string[]) {
  const child = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code) throw new Error(`${args[0]} failed: ${err}`);
  return out.trim();
}
async function fetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { signal: _signal, ...options } = init;
  const code = `const r=await fetch(${JSON.stringify(url)},{...${JSON.stringify(options)},signal:AbortSignal.timeout(2000)});console.log(JSON.stringify({status:r.status,body:await r.text()}));`;
  const result = JSON.parse(await run(['docker', 'exec', `${prefix}-mock`, 'bun', '-e', code]));
  return new Response(result.body, { status: result.status });
}
async function start(alias: string, image: string, args: string[] = [], command: string[] = []) {
  const name = `${prefix}-${alias}`;
  containers.push(name);
  await run([
    'docker',
    'run',
    '-d',
    '--name',
    name,
    '--network',
    network,
    '--network-alias',
    alias,
    ...args,
    image,
    ...command,
  ]);
  return name;
}
async function retry(check: () => Promise<void>, label: string) {
  let last: unknown;
  for (let i = 0; i < 80; i++) {
    try {
      await check();
      return;
    } catch (error) {
      last = error;
      await Bun.sleep(500);
    }
  }
  throw new Error(`${label}: ${last}`);
}
const common = [
  '-e',
  'NODE_ENV=production',
  '-e',
  'DATABASE_URL=postgres://convey_test:mock-only@pg:5432/convey_smoke_test',
  '-e',
  'POSTGRES_DB=convey_smoke_test',
  '-e',
  'REDIS_URL=redis://redis:6379',
  '-e',
  `PAYLOAD_ENCRYPTION_KEY=${encryptionKey}`,
  '-e',
  `CONVEY_WEBHOOK_SECRET=${key}`,
];
let pg = '';
const query = (text: string) =>
  run([
    'docker',
    'exec',
    pg,
    'psql',
    '-U',
    'convey_test',
    '-d',
    'convey_smoke_test',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-At',
    '-c',
    text,
  ]);
try {
  await run(['docker', 'network', 'create', '--internal', network]);
  pg = await start('pg', 'postgres:18-alpine', [
    '-e',
    'POSTGRES_USER=convey_test',
    '-e',
    'POSTGRES_PASSWORD=mock-only',
    '-e',
    'POSTGRES_DB=convey_smoke_test',
  ]);
  await start('redis', 'redis:7.4-alpine');
  await retry(async () => {
    await query('SELECT 1');
  }, 'PostgreSQL readiness');
  const mockCode = `let calls=0; Bun.serve({port:4000,fetch:async request=>{if(request.method==='POST'){calls++;return Response.json({sid:'SMmock'+calls,status:'queued'},{status:201});}return Response.json({calls});}});`;
  await start('mock', 'convey-qualification:server', ['--entrypoint', 'bun'], ['-e', mockCode]);
  await run([
    'docker',
    'run',
    '--rm',
    '--network',
    network,
    ...common,
    '--entrypoint',
    'bun',
    'convey-qualification:server',
    'apps/server/src/db/migrate.ts',
  ]);
  const fixture = `import {queryClient as db,db as orm} from './apps/server/src/db'; import {providers} from './apps/server/src/db/schema'; import {encryptProviderCredentials} from './apps/server/src/utils/payload-encryption';
await db\`INSERT INTO tenants(id,name) VALUES('mock-tenant','Mock')\`;
await db\`INSERT INTO api_keys(id,tenant_id,team,key_hash,name,role,scope) VALUES('mock-key','mock-tenant','mock-team','${createHash('sha256').update(key).digest('hex')}','Mock','ORG_ADMIN','platform')\`;
await orm.insert(providers).values({id:'twilio',channel:'sms',credentials:encryptProviderCredentials({accountSid:'ACmock',authToken:'mock-only',from:'+15005550006'}),config:{baseUrl:'http://mock:4000/messages',pricing:{cost:0.01,currency:'USD'}}});
await db\`INSERT INTO budget_policies(id,team,monthly_budget_usd,currency,hard_stop) VALUES('mock-budget','mock-team',0.01,'USD','true')\`;
await db.close(); process.exit(0);`;
  await run([
    'docker',
    'run',
    '--rm',
    '--network',
    network,
    ...common,
    '--entrypoint',
    'bun',
    'convey-qualification:server',
    '-e',
    fixture,
  ]);
  const server = await start('server', 'convey-qualification:server', common);
  const plugins = await start('plugins', 'convey-qualification:plugins', [
    ...common,
    '-e',
    'CONVEY_API_INTERNAL_URL=http://server:3000',
  ]);
  const web = await start('web', 'convey-qualification:web', []);
  const address = async (name: string, port: number) => `http://${name.slice(prefix.length + 1)}:${port}`;
  for (const name of [server, plugins, web]) {
    if ((await run(['docker', 'exec', name, 'id', '-u'])) === '0')
      throw new Error('Application container runs as root');
  }
  const base = await address(server, 3000);
  for (const [url, label] of [
    [`${base}/health/readiness`, 'server'],
    [`${await address(plugins, 3001)}/health`, 'plugins'],
    [await address(web, 5173), 'console'],
  ]) {
    await retry(async () => {
      if (!(await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) throw new Error('Not ready');
    }, label);
  }
  if ((await fetch(`${base}/v1/admin/providers`)).status !== 401) throw new Error('Anonymous admin access');
  const send = async (scheduledAt?: string) => {
    const response = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        scheduledAt,
        team: 'mock-team',
        userId: 'mock-user',
        category: 'transactional',
        country: 'US',
        priority: 'normal',
        idempotencyKey: crypto.randomUUID(),
        recipients: { phone: '+15005550009' },
        channels: [{ channel: 'sms', providerId: 'twilio', content: { text: 'Container mock' } }],
      }),
    });
    if (response.status !== 202) throw new Error(`Send rejected ${response.status}: ${await response.text()}`);
    return ((await response.json()) as { messageId: string }).messageId;
  };
  const first = await send(new Date(Date.now() + 5000).toISOString());
  if ((await query("SELECT count(*) FROM budget_ledger WHERE team='mock-team'")) !== '0')
    throw new Error('Scheduled message sent early');
  await retry(async () => {
    if ((await query("SELECT count(*) FROM budget_ledger WHERE team='mock-team'")) !== '1')
      throw new Error('Mock send not committed');
  }, 'Worker dispatch and settlement');
  const receipt = JSON.stringify({ MessageSid: 'SMmock1', MessageStatus: 'delivered' });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', key).update(`${timestamp}.${receipt}`).digest('hex');
  const receiptOptions = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-convey-webhook-timestamp': timestamp,
      'x-convey-webhook-signature': signature,
    },
    body: receipt,
  };
  if (!(await fetch(`${base}/v1/webhooks/twilio`, receiptOptions)).ok) throw new Error('Signed receipt rejected');
  await retry(async () => {
    if ((await query(`SELECT state FROM messages WHERE public_id='${first}'`)) !== 'delivered')
      throw new Error('Receipt not applied');
  }, 'Durable signed receipt');
  const duplicate = await fetch(`${base}/v1/webhooks/twilio`, receiptOptions);
  if (((await duplicate.json()) as { status: string }).status !== 'duplicate_ignored')
    throw new Error('Receipt was not deduplicated');
  const second = await send();
  await retry(async () => {
    if ((await query(`SELECT state FROM messages WHERE public_id='${second}'`)) !== 'failed')
      throw new Error('Budget rejection not applied');
  }, 'Budget hard stop');
  await query("UPDATE providers SET config=jsonb_set(config,'{pricing,cost}','0'::jsonb) WHERE id='twilio'");
  await query("UPDATE budget_policies SET monthly_budget_usd=0 WHERE team='mock-team'");
  await run(['docker', 'restart', server]);
  await retry(async () => {
    if (!(await fetch(`${base}/health/readiness`)).ok) throw new Error('Not ready');
  }, 'Restart readiness');
  if ((await fetch(`${base}/v1/messages/${first}`, { headers: { authorization: `Bearer ${key}` } })).status !== 200)
    throw new Error('Lost message after restart');
  if ((await query("SELECT count(*) FROM budget_ledger WHERE team='mock-team'")) !== '1')
    throw new Error('Duplicate settlement');
  await send();
  await retry(async () => {
    if ((await query("SELECT count(*) FROM budget_ledger WHERE team='mock-team'")) !== '2')
      throw new Error('Free route blocked after cap reduction');
  }, 'Free dispatch after cap reduction');
  if ((await query("SELECT sum(amount_usd)::text FROM budget_ledger WHERE team='mock-team'")) !== '0.0100')
    throw new Error('Free dispatch changed committed amount');
  const mockCalls = JSON.parse(
    await run(['docker', 'exec', server, 'bun', '-e', "console.log(await (await fetch('http://mock:4000')).text())"]),
  );
  if (mockCalls.calls !== 2) throw new Error(`Unexpected provider requests: ${mockCalls.calls}`);
  console.log(
    JSON.stringify(
      {
        mode: 'mock-only',
        network: 'internal; external egress disabled',
        checks: [
          'production image startup as non-root',
          'authenticated API',
          'real worker -> mock HTTP provider',
          'atomic budget settlement',
          'scheduled dispatch does not send early',
          'signed durable receipt and duplicate suppression',
          'hard-cap blocks paid provider call',
          'free route works after cap reduction',
          'restart preserves message and charge',
          'plugins health',
          'console HTTP',
        ],
        images: await run([
          'docker',
          'image',
          'inspect',
          '--format',
          '{{.Id}}',
          'convey-qualification:server',
          'convey-qualification:plugins',
          'convey-qualification:web',
        ]),
      },
      null,
      2,
    ),
  );
} catch (error) {
  for (const name of containers.filter((name) => /-(server|plugins|web)$/.test(name))) {
    console.error(`${name}: ${await run(['docker', 'logs', '--tail', '25', name]).catch(() => 'Logs unavailable')}`);
  }
  throw error;
} finally {
  for (const name of containers.reverse()) await run(['docker', 'rm', '-f', name]).catch(() => {});
  await run(['docker', 'network', 'rm', network]).catch(() => {});
}
