import { describe, expect, it } from 'bun:test';
import { Channel, Convey, MessagePriority, MessageStatus, SuppressionReason } from '../src';

const BASE_URL = process.env.CONVEY_BASE_URL;
const API_KEY = process.env.CONVEY_API_KEY || 'cv_live_secret_key_e2e_testing_99887766554433221100';

const describeLive = BASE_URL ? describe : describe.skip;

describeLive('TypeScript SDK Live End-to-End Test Suite', () => {
  const client = new Convey({
    apiKey: API_KEY,
    baseUrl: BASE_URL || 'http://127.0.0.1:3999',
    isSandbox: true,
    timeoutMs: 10000,
    maxRetries: 2,
  });

  it('1. Live Telemetry & Health: should fetch telemetry from running server', async () => {
    const telemetry = await client.admin.getLiveTelemetry();
    expect(telemetry).toBeDefined();
    expect(telemetry.subsystems).toBeDefined();
    expect(telemetry.queues).toBeDefined();
  });

  it('2. Messages: should send single transactional message via live HTTP endpoint', async () => {
    const response = await client.messages.send({
      channel: Channel.EMAIL,
      recipient: 'ts_e2e@example.com',
      priority: MessagePriority.HIGH,
      content: {
        subject: 'TypeScript SDK E2E Live Test',
        body: '<p>Testing live Convey server integration with TypeScript SDK</p>',
      },
      category: 'TESTING',
    });

    expect(response.success).toBe(true);
    expect(response.publicId).toMatch(/^msg_/);
    expect(response.status).toBe(MessageStatus.ACCEPTED);
  });

  it('3. Bulk Messages: should dispatch multiple messages in a single batch', async () => {
    const bulk = await client.messages.sendBulk([
      {
        channel: Channel.EMAIL,
        recipient: 'ts_bulk_1@example.com',
        content: { subject: 'Bulk 1', body: 'Body 1' },
      },
      {
        channel: Channel.EMAIL,
        recipient: 'ts_bulk_2@example.com',
        content: { subject: 'Bulk 2', body: 'Body 2' },
      },
    ]);

    expect(bulk.total).toBe(2);
    expect(bulk.items.length).toBe(2);
    expect(bulk.items[0].publicId).toMatch(/^msg_/);
  });

  it('4. Template Preview: should preview and substitute variables against live engine', async () => {
    const preview = await client.messages.previewTemplate({
      template: 'Hello {{user}}, your order {{orderNum}} is confirmed.',
      variables: { user: 'Alice', orderNum: '#9988' },
      recipient: 'ts_e2e@example.com',
    });

    expect(preview.rendered).toBe('Hello Alice, your order #9988 is confirmed.');
    expect(preview.missingVariables).toEqual([]);
  });

  it('5. Suppressions: should add, list, and verify suppression records', async () => {
    const sup = await client.suppressions.add({
      recipient: 'ts_blocked@example.com',
      channel: Channel.EMAIL,
      reason: SuppressionReason.MANUAL_BLOCK,
    });

    expect(sup.success).toBe(true);
    expect(sup.suppression).toBeDefined();

    const listing = await client.suppressions.list({ limit: 10 });
    expect(listing.items).toBeDefined();
    expect(listing.total).toBeGreaterThanOrEqual(1);
  });

  it('6. Sandbox: should inspect simulated messages and clear them', async () => {
    const res = await client.sandbox.listMessages();
    expect(Array.isArray(res.messages)).toBe(true);

    const cleared = await client.sandbox.clearMessages();
    expect(cleared.success).toBe(true);
  });
});
