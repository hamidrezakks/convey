import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../../../apps/server/src/index';
import { SEEDED_API_KEY_RAW, seedDatabaseWithRealisticData } from '../../../apps/server/tests/helpers/db-seeder';
import { Channel, Convey, MessagePriority, MessageStatus } from '../src';

describe('SDK Live Integration with Convey Server Routes', () => {
  beforeAll(async () => {
    await seedDatabaseWithRealisticData();
  });

  // Custom fetch delegating directly to Elysia in-memory app handler
  const elysiaFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input.toString(), init);
    return app.handle(req);
  };

  const client = new Convey({
    apiKey: SEEDED_API_KEY_RAW,
    isSandbox: true,
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
    const providers = await client.admin.listConfiguredProviders();
    expect(Array.isArray(providers)).toBe(true);
  });

  it('should fetch real-time live telemetry snapshot', async () => {
    const telemetry = await client.admin.getLiveTelemetry();
    expect(telemetry.throughputRps).toBeDefined();
    expect(telemetry.queues).toBeDefined();
    expect(telemetry.runtimeGuard).toBeDefined();
  });
});
