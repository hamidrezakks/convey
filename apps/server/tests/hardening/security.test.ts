import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import type { BudgetPolicyDto } from '@convey/shared';
import { initializePluginTables } from '../../../plugins/src/db';
import { pluginsApp } from '../../../plugins/src/index';
import { env } from '../../src/config/env';
import { queryClient } from '../../src/db';
import { app } from '../../src/index';
import { verifyIngressSignature } from '../../src/modules/webhooks/signature';
import { verifyHubChallenge } from '../../src/modules/webhooks/webhooks.service';
import { dispatchNormalQueue } from '../../src/queues/queue-definitions';
import { processOutboxBatchForShard } from '../../src/queues/workers/outbox-relay.worker';
import { hashString } from '../../src/utils/crypto';
import { generateMessageId } from '../../src/utils/id';
import { redactLogMetadata } from '../../src/utils/logger';

if (env.NODE_ENV !== 'test' || !/test|hardening/.test(env.POSTGRES_DB))
  throw new Error('Hardening tests require an explicitly named disposable test database');
const prefix = `security_${crypto.randomUUID()}`;
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const teamA = `${prefix}_a`;
const teamB = `${prefix}_b`;
const secrets = new Map<string, string>();
const originalRequireAuth = env.CONVEY_REQUIRE_AUTH;
const unsignedSetting = process.env.CONVEY_ALLOW_UNSIGNED_WEBHOOKS;
const hookSecret = process.env.CONVEY_WEBHOOK_SECRET;

async function call(path: string, key?: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${secrets.get(key)}` } : {}),
        ...extra,
      },
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    }),
  );
}
const payload = (team: string, key = crypto.randomUUID()) => ({
  team,
  userId: 'test',
  category: 'transactional',
  country: 'US',
  priority: 'normal',
  idempotencyKey: key,
  recipients: { email: 'test@example.invalid' },
  channels: [{ channel: 'email', content: { subject: 'Test', text: 'No provider workers are started by this suite' } }],
});
async function accept(team: string, key: string) {
  const response = await call('/v1/messages', key, 'POST', payload(team));
  expect(response.status).toBe(202);
  return ((await response.json()) as { messageId: string }).messageId;
}

beforeAll(async () => {
  env.CONVEY_REQUIRE_AUTH = true;
  process.env.CONVEY_ALLOW_UNSIGNED_WEBHOOKS = 'false';
  process.env.CONVEY_WEBHOOK_SECRET = 'hardening-test-signing-secret';
  await initializePluginTables();
  await queryClient`INSERT INTO tenants(id,name,slug) VALUES(${tenantA},'Security A',${teamA}),(${tenantB},'Security B',${teamB})`;
  for (const [name, tenant, team, role, scope, sandbox] of [
    ['a', tenantA, teamA, 'DEVELOPER', 'tenant', false],
    ['b', tenantB, teamB, 'DEVELOPER', 'tenant', false],
    ['admin', tenantA, teamA, 'ORG_ADMIN', 'platform', false],
    ['auditor', tenantA, teamA, 'AUDITOR', 'platform', false],
    ['sandbox', tenantA, teamA, 'DEVELOPER', 'tenant', true],
    ['revoked', tenantA, teamA, 'DEVELOPER', 'tenant', false],
  ] as const) {
    const secret = `${prefix}_${name}`;
    secrets.set(name, secret);
    await queryClient`INSERT INTO api_keys(id,tenant_id,team,key_hash,name,role,scope,sandbox_only) VALUES(${secret},${tenant},${team},${hashString(secret)},${name},${role},${scope},${sandbox})`;
  }
});
afterAll(async () => {
  env.CONVEY_REQUIRE_AUTH = originalRequireAuth;
  if (unsignedSetting === undefined) delete process.env.CONVEY_ALLOW_UNSIGNED_WEBHOOKS;
  else process.env.CONVEY_ALLOW_UNSIGNED_WEBHOOKS = unsignedSetting;
  if (hookSecret === undefined) delete process.env.CONVEY_WEBHOOK_SECRET;
  else process.env.CONVEY_WEBHOOK_SECRET = hookSecret;
  await queryClient`DELETE FROM outbox WHERE message_id IN (SELECT public_id FROM messages WHERE team IN (${teamA},${teamB}))`;
  await queryClient`DELETE FROM messages WHERE team IN (${teamA},${teamB})`;
  for (const table of [
    'in_app_notifications',
    'recipient_preferences',
    'subscription_topics',
    'batches',
    'templates',
  ]) {
    await queryClient.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1, $2)`, [tenantA, tenantB]);
  }
  await queryClient`DELETE FROM budget_policies WHERE team IN (${teamA},${teamB})`;
  await queryClient`DELETE FROM api_keys WHERE tenant_id IN (${tenantA},${tenantB})`;
  await queryClient`DELETE FROM team_owners WHERE tenant_id IN (${tenantA},${tenantB})`;
  await queryClient`DELETE FROM tenants WHERE id IN (${tenantA},${tenantB})`;
});

describe('Real API security boundaries', () => {
  test('budget policies persist only through authorized platform administrators', async () => {
    const path = `/v1/admin/budgets/${teamA}`;
    const body = { monthlyBudget: 125.75, currency: 'eur', hardStop: true };
    expect((await call(path)).status).toBe(401);
    expect((await call(path, 'a')).status).toBe(403);
    expect((await call(path, 'auditor', 'PUT', body)).status).toBe(403);
    expect((await call(path, 'sandbox', 'PUT', body)).status).toBe(403);
    expect((await call(path, 'admin', 'PUT', { ...body, monthlyBudget: -1 })).status).toBe(400);
    expect((await call(path, 'admin', 'PUT', { ...body, currency: 'NOPE' })).status).toBe(400);
    expect((await call('/v1/admin/budgets/unregistered-budget-team', 'admin', 'PUT', body)).status).toBe(400);
    expect((await call(path, 'admin', 'PUT', body)).status).toBe(200);
    const response = await call(path, 'auditor');
    expect(response.status).toBe(200);
    const saved = (await response.json()) as BudgetPolicyDto;
    expect(saved.monthlyBudget).toBe(125.75);
    expect(saved.currency).toBe('EUR');
    expect(saved.hardStop).toBe(true);
    expect(saved.usedAmount).toBe(0);
    expect(saved.reservedAmount).toBe(0);
    expect((await call(path, 'admin', 'PUT', { ...body, monthlyBudget: 0, hardStop: false })).status).toBe(200);
  });
  test('all protected route families reject absent credentials', async () => {
    for (const path of [
      '/v1/admin/overview',
      '/v1/messages/not-found',
      '/v1/dlq',
      '/v1/templates',
      '/v1/batches',
      '/v1/suppressions',
      '/v1/webhook-subscriptions',
      '/v1/sandbox/messages',
      '/v1/auth/session',
    ]) {
      expect((await call(path)).status).toBe(401);
    }
  });
  test('stored scope and role control platform access', async () => {
    expect((await call('/v1/admin/providers', 'a', 'GET', undefined, { 'x-convey-role': 'ORG_ADMIN' })).status).toBe(
      403,
    );
    expect(
      (await call('/v1/admin/providers/unknown/circuit', 'auditor', 'POST', { action: 'FORCE_OPEN' })).status,
    ).toBe(403);
    expect((await call('/v1/admin/providers', 'admin')).status).toBe(200);
  });
  test('single and bulk sends reject another team before any write', async () => {
    expect((await call('/v1/messages', 'a', 'POST', payload(teamB))).status).toBe(403);
    expect((await call('/v1/messages/bulk', 'a', 'POST', { messages: [payload(teamA), payload(teamB)] })).status).toBe(
      403,
    );
  });
  test('message status, timeline, trace and receipts enforce ownership', async () => {
    const id = await accept(teamA, 'a');
    for (const suffix of ['', '/timeline', '/trace'])
      expect((await call(`/v1/messages/${id}${suffix}`, 'b')).status).toBe(404);
    expect((await call(`/v1/messages/${id}`, 'a')).status).toBe(200);
    expect((await call('/v1/receipts', 'b', 'POST', { messageId: id })).status).toBe(404);
  });
  test('sandbox credentials cannot read production messages', async () => {
    const id = await accept(teamA, 'a');
    expect(
      (await call(`/v1/messages/${id}`, 'sandbox', 'GET', undefined, { 'x-convey-environment': 'production' })).status,
    ).toBe(404);
  });
  test('team identifiers cannot be reassigned to another tenant', async () => {
    await expect(
      (async () => {
        await queryClient`INSERT INTO api_keys(id,tenant_id,team,key_hash,name) VALUES(${crypto.randomUUID()},${tenantB},${teamA},${hashString(crypto.randomUUID())},'illegal')`;
      })(),
    ).rejects.toThrow();
  });
  test('identical idempotency keys remain independent across teams', async () => {
    const key = crypto.randomUUID();
    const a = await call('/v1/messages', 'a', 'POST', payload(teamA, key));
    const b = await call('/v1/messages', 'b', 'POST', payload(teamB, key));
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(((await a.json()) as { messageId: string }).messageId).not.toBe(
      ((await b.json()) as { messageId: string }).messageId,
    );
  });
  test('DLQ replay is scoped and concurrent requests create one durable outbox record', async () => {
    const id = await accept(teamA, 'a');
    await queryClient`DELETE FROM outbox WHERE message_id=${id}`;
    await queryClient`UPDATE messages SET state='failed' WHERE public_id=${id}`;
    const denied = await call('/v1/dlq/replay', 'b', 'POST', { messageIds: [id] });
    expect(((await denied.json()) as { replayedCount: number }).replayedCount).toBe(0);
    const responses = await Promise.all([
      call('/v1/dlq/replay', 'a', 'POST', { messageIds: [id] }),
      call('/v1/dlq/replay', 'a', 'POST', { messageIds: [id] }),
    ]);
    const results = await Promise.all(
      responses.map((response) => response.json() as Promise<{ replayedCount: number }>),
    );
    expect(results.reduce((total, result) => total + result.replayedCount, 0)).toBe(1);
    const rows = await queryClient`SELECT state FROM outbox WHERE message_id=${id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe('pending');
  });
  test('revocation and expiration apply without a cache delay', async () => {
    expect((await call('/v1/auth/session', 'revoked')).status).toBe(200);
    await queryClient`UPDATE api_keys SET active=false WHERE id=${secrets.get('revoked')}`;
    expect((await call('/v1/auth/session', 'revoked')).status).toBe(401);
    await queryClient`UPDATE api_keys SET active=true,expires_at=now()-interval '1 second' WHERE id=${secrets.get('revoked')}`;
    expect((await call('/v1/auth/session', 'revoked')).status).toBe(401);
  });
});

test('webhook handlers verify raw bytes and reject absent, malformed, stale and tampered signatures', async () => {
  const raw = `{ "id": "${prefix}", "event": "delivered" }`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', 'hardening-test-signing-secret').update(`${timestamp}.${raw}`).digest('hex');
  const headers = { 'x-convey-webhook-timestamp': timestamp, 'x-convey-webhook-signature': signature };
  expect((await call('/v1/webhooks/resend', undefined, 'POST', raw)).status).toBe(401);
  expect(
    (
      await call('/v1/webhooks/resend', undefined, 'POST', raw, {
        ...headers,
        'x-convey-webhook-signature': 'malformed',
      })
    ).status,
  ).toBe(401);
  expect((await call('/v1/webhooks/resend', undefined, 'POST', `${raw} `, headers)).status).toBe(401);
  expect((await call('/v1/webhooks/resend', undefined, 'POST', raw, headers)).status).toBe(200);
  const duplicate = await call('/v1/webhooks/resend', undefined, 'POST', raw, headers);
  expect(((await duplicate.json()) as { status: string }).status).toBe('duplicate_ignored');
  expect(
    verifyIngressSignature(
      new Request('http://localhost', { headers }),
      raw,
      process.env.CONVEY_WEBHOOK_SECRET,
      Date.now() + 301000,
    ),
  ).toBe(false);
});

test('real log metadata redaction removes nested credentials and recipients', () => {
  const metadata = redactLogMetadata({
    detail: [{ apiKey: 'private-key', recipients: { email: 'private@example.invalid' } }],
    state: 'failed',
  });
  expect(JSON.stringify(metadata)).not.toContain('private');
  expect(JSON.stringify(metadata)).toContain('failed');
});

test('outbox queue failure releases its claim and stale claims can be recovered', async () => {
  const id = generateMessageId();
  const shard = 99; // Reserved fixture shard; production scheduler does not poll it.
  await queryClient`INSERT INTO outbox(id,message_id,shard_id,type,payload,state,available_at) VALUES(${id},${id},${shard},'message_dispatch',${JSON.stringify({ publicId: id, team: teamA, priority: 'normal' })}::jsonb,'pending',now())`;
  const original = dispatchNormalQueue.addBulk;
  try {
    dispatchNormalQueue.addBulk = async () => {
      throw new Error('Simulated queue failure');
    };
    await expect(processOutboxBatchForShard(shard)).rejects.toThrow('Simulated queue failure');
    let rows = await queryClient`SELECT state FROM outbox WHERE id=${id}`;
    expect(rows[0].state).toBe('pending');
    await queryClient`UPDATE outbox SET state='processing',locked_at=now()-interval '2 minutes' WHERE id=${id}`;
    dispatchNormalQueue.addBulk = async () => [];
    expect(await processOutboxBatchForShard(shard)).toBe(1);
    rows = await queryClient`SELECT state FROM outbox WHERE id=${id}`;
    expect(rows[0].state).toBe('processed');
  } finally {
    dispatchNormalQueue.addBulk = original;
    await queryClient`DELETE FROM outbox WHERE id=${id}`;
  }
});

test('templates and batches remain inside the authenticated tenant and team', async () => {
  const slug = `${prefix}_template`;
  expect((await call('/v1/templates', 'a', 'POST', { slug, name: 'Fixture template' })).status).toBe(201);
  expect((await call(`/v1/templates/${slug}`, 'b')).status).toBe(404);
  const response = await call('/v1/batches', 'a', 'POST', { totalCount: 1 });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { batch: { id: string } };
  expect((await call(`/v1/batches/${body.batch.id}`, 'b')).status).toBe(404);
});

test('plugins authenticate through core and reject forged tenant parameters', async () => {
  const server = Bun.serve({ port: 0, fetch: (request) => app.handle(request) });
  const previousUrl = process.env.CONVEY_API_INTERNAL_URL;
  process.env.CONVEY_API_INTERNAL_URL = `http://127.0.0.1:${server.port}`;
  const pluginCall = (path: string, key?: string, method = 'GET', body?: unknown) =>
    pluginsApp.handle(
      new Request(`http://localhost/api/v1/plugins${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(key ? { authorization: `Bearer ${secrets.get(key)}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  try {
    expect((await pluginCall(`/inbox/recipient?tenantId=${tenantA}`)).status).toBe(401);
    expect((await pluginCall(`/inbox/recipient?tenantId=${tenantA}`, 'b')).status).toBe(403);
    expect(
      (
        await pluginCall('/inbox', 'auditor', 'POST', {
          tenantId: tenantA,
          team: teamA,
          recipientId: 'test',
          title: 'Test',
          body: 'Test',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await pluginCall('/inbox', 'a', 'POST', {
          tenantId: tenantA,
          team: teamA,
          recipientId: 'test',
          title: 'Test',
          body: 'Test',
        })
      ).status,
    ).toBe(201);
    const feed = await pluginCall(`/inbox/test?tenantId=${tenantA}`, 'a');
    expect(feed.status).toBe(200);
    expect(((await feed.json()) as { items: unknown[] }).items).toHaveLength(1);
    expect((await pluginCall(`/inbox/test?tenantId=${tenantA}`, 'sandbox')).status).toBe(403);
  } finally {
    server.stop(true);
    if (previousUrl === undefined) delete process.env.CONVEY_API_INTERNAL_URL;
    else process.env.CONVEY_API_INTERNAL_URL = previousUrl;
  }
});

test('single and bulk idempotency isolate sandbox and production in either order', async () => {
  for (const bulk of [false, true]) {
    for (const order of [
      ['a', 'sandbox'],
      ['sandbox', 'a'],
    ]) {
      const request = payload(teamA);
      const path = bulk ? '/v1/messages/bulk' : '/v1/messages';
      const body = bulk ? { messages: [request] } : request;
      const ids: string[] = [];
      for (const key of order) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await call(path, key, 'POST', body);
          expect(response.status).toBe(202);
          const data = (await response.json()) as { messageId: string; items: Array<{ body: { messageId: string } }> };
          const id = bulk ? data.items[0].body.messageId : data.messageId;
          if (attempt === 0) ids.push(id);
          else expect(id).toBe(ids[ids.length - 1]);
        }
      }
      expect(ids[0]).not.toBe(ids[1]);
      const rows =
        await queryClient`SELECT is_sandbox FROM messages WHERE public_id IN (${ids[0]},${ids[1]}) AND created_at >= now() - interval '1 hour'`;
      expect(rows.map((row: { is_sandbox: boolean }) => row.is_sandbox).sort()).toEqual([false, true]);
    }
  }
});

test('Meta verification uses the deployment-configured token', () => {
  const previous = process.env.META_WEBHOOK_VERIFY_TOKEN;
  process.env.META_WEBHOOK_VERIFY_TOKEN = 'test-meta-challenge';
  try {
    const query = { 'hub.mode': 'subscribe', 'hub.verify_token': 'test-meta-challenge', 'hub.challenge': '123' };
    expect(verifyHubChallenge('whatsapp', query)).toEqual({ verified: true, challenge: '123' });
    expect(verifyHubChallenge('whatsapp', { ...query, 'hub.verify_token': 'wrong' }).verified).toBe(false);
  } finally {
    if (previous === undefined) delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    else process.env.META_WEBHOOK_VERIFY_TOKEN = previous;
  }
});
