import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { queryClient } from '../../../apps/server/src/db';
import { app } from '../../../apps/server/src/index';
import { hashString } from '../../../apps/server/src/utils/crypto';
import { Channel, Convey, MessagePriority, MessageStatus } from '../src';

const tenantId = crypto.randomUUID();
const team = `sdk_${crypto.randomUUID()}`;
const apiKey = `sdk_test_${crypto.randomUUID()}`;
const adminKey = `sdk_admin_${crypto.randomUUID()}`;

describe('SDK Live Integration with Convey Server Routes', () => {
  beforeAll(async () => {
    await queryClient`INSERT INTO tenants(id,name,slug) VALUES(${tenantId},'SDK integration',${team})`;
    for (const [key, role, scope] of [
      [apiKey, 'DEVELOPER', 'tenant'],
      [adminKey, 'ORG_ADMIN', 'platform'],
    ]) {
      await queryClient`INSERT INTO api_keys(id,tenant_id,team,key_hash,name,role,scope) VALUES(${key},${tenantId},${team},${hashString(key)},'SDK fixture',${role},${scope})`;
    }
  });

  afterAll(async () => {
    await queryClient`DELETE FROM outbox WHERE message_id IN (SELECT public_id FROM messages WHERE team=${team})`;
    await queryClient`DELETE FROM messages WHERE team=${team}`;
    await queryClient`DELETE FROM api_keys WHERE tenant_id=${tenantId}`;
    await queryClient`DELETE FROM team_owners WHERE tenant_id=${tenantId}`;
    await queryClient`DELETE FROM tenants WHERE id=${tenantId}`;
  });

  // Custom fetch delegating directly to Elysia in-memory app handler
  const elysiaFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input.toString(), init);
    return app.handle(req);
  };

  const client = new Convey({
    apiKey,
    teamId: team,
    baseUrl: 'http://localhost:3000',
    isSandbox: true,
    fetch: elysiaFetch as unknown as typeof fetch,
  });

  const operator = new Convey({
    apiKey: adminKey,
    baseUrl: 'http://localhost:3000',
    fetch: elysiaFetch as unknown as typeof fetch,
  });

  it('should accept message dispatch through real Elysia router', async () => {
    const result = await client.messages.send({
      channel: Channel.EMAIL,
      recipient: 'integration@test.com',
      priority: MessagePriority.HIGH,
      content: {
        subject: 'E2E Live Integration Test',
        body: '<p>Integration test body</p>',
      },
      category: 'TESTING',
    });

    expect(result.success).toBe(true);
    expect(result.publicId).toMatch(/^msg_/);
    expect(result.status).toBe(MessageStatus.ACCEPTED);
    expect(result.isSandbox).toBe(true);
  });

  it('should preview templates with parameter substitutions', async () => {
    const result = await client.messages.previewTemplate({
      template: 'Hello {{name}}, your balance is {{amount}}.',
      variables: { name: 'Alice', amount: '$50.00' },
      recipient: 'alice@test.com',
    });

    expect(result.rendered).toBe('Hello Alice, your balance is $50.00.');
    expect(result.missingVariables).toEqual([]);
  });

  it('should list configured providers from admin route', async () => {
    const providers = await operator.admin.listConfiguredProviders();
    expect(Array.isArray(providers)).toBe(true);
  });

  it('should fetch real-time live telemetry snapshot', async () => {
    const telemetry = await operator.admin.getLiveTelemetry();
    expect(telemetry.throughputRps).toBeDefined();
    expect(telemetry.queues).toBeDefined();
    expect(telemetry.runtimeGuard).toBeDefined();
  });
});
