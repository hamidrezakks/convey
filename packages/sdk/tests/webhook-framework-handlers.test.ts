import { describe, expect, it } from 'bun:test';
import { Convey, type ConveyWebhookEvent, createWebhookHandler, generateTestWebhookEvent } from '../src';

describe('Webhook Framework Handlers & Test Event Fixture Suite', () => {
  const testSecret = 'whsec_test_secret_1234567890abcdef';

  it('should generate test event fixtures and verify them correctly', async () => {
    const fixture = await Convey.webhooks.generateTestEvent({
      type: 'message.delivered',
      data: { messageId: 'msg_98765', recipient: 'user@test.com', deliveredAt: new Date().toISOString() },
      secret: testSecret,
    });

    expect(fixture.rawBody).toBeDefined();
    expect(fixture.signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(fixture.headers['convey-signature']).toBe(fixture.signature);

    const verified = await Convey.webhooks.verifySignature(fixture.rawBody, fixture.signature, testSecret);
    expect(verified).toBe(true);
  });

  it('should process Web Standard Request/Response in createWebhookHandler (Next.js, Cloudflare, Hono)', async () => {
    let handledEvent: ConveyWebhookEvent | undefined;

    const handler = Convey.webhooks.createHandler({
      secret: testSecret,
      handlers: {
        'message.delivered': (event) => {
          handledEvent = event;
        },
      },
    });

    const fixture = await generateTestWebhookEvent({
      type: 'message.delivered',
      data: { messageId: 'msg_112233' },
      secret: testSecret,
    });

    const req = new Request('https://api.mycorp.com/api/webhooks/convey', {
      method: 'POST',
      headers: fixture.headers,
      body: fixture.rawBody,
    });

    const res = await handler.handleRequest(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(handledEvent).toBeDefined();
    expect(handledEvent?.data.messageId).toBe('msg_112233');
  });

  it('should reject invalid or forged webhook signatures with 400 status', async () => {
    const handler = createWebhookHandler({
      secret: testSecret,
    });

    const fakeReq = new Request('https://api.mycorp.com/webhooks', {
      method: 'POST',
      headers: {
        'convey-signature': 't=1724520000,v1=bad_fake_signature_hex_0000000000000000000000000000000000000000',
      },
      body: JSON.stringify({ type: 'message.failed' }),
    });

    const res = await handler.handleRequest(fakeReq);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Webhook signature verification failed');
  });
});
