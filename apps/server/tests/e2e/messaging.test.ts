import { describe, expect, it } from 'bun:test';
import { app } from '../../src/index';

describe('Convey Messaging Service E2E Test Suite', () => {
  it('1. Simple SMS Message Send (POST /v1/messages)', async () => {
    const res = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `test_sms_${Date.now()}`,
          userId: 'usr_e2e_123',
          team: 'payments',
          category: 'otp',
          country: 'AE',
          recipients: {
            phone: '+971501234567',
          },
          channels: [
            {
              channel: 'sms',
              content: {
                text: 'Your OTP code is 987654',
              },
            },
          ],
        }),
      }),
    );

    expect(res.status).toBe(202);
    const body = (await res.json()) as {
      messageId?: string;
      state?: string;
      createdAt?: string;
      providerMessageId?: string;
      error?: { code?: string };
      received?: boolean;
      channels?: unknown[];
    };
    expect(body.messageId).toMatch(/^msg_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(body.state).toBe('accepted');
    expect(body.createdAt).toBeDefined();
    expect(body.providerMessageId).toBeUndefined(); // NEVER exposed
  });

  it('2. Simple Email Send with Direct HTML', async () => {
    const res = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `test_email_${Date.now()}`,
          userId: 'usr_e2e_123',
          team: 'marketing',
          category: 'transactional',
          country: 'US',
          recipients: {
            email: 'user@example.com',
          },
          channels: [
            {
              channel: 'email',
              content: {
                subject: 'Welcome to Convey',
                html: '<h1>Welcome!</h1>',
                text: 'Welcome!',
              },
            },
          ],
        }),
      }),
    );

    expect(res.status).toBe(202);
    const body = (await res.json()) as {
      messageId?: string;
      state?: string;
      createdAt?: string;
      providerMessageId?: string;
      error?: { code?: string };
      received?: boolean;
      channels?: unknown[];
    };
    expect(body.messageId).toMatch(/^msg_/);
  });

  it('3. Email Send with Render Template', async () => {
    const res = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `test_render_email_${Date.now()}`,
          userId: 'usr_e2e_123',
          team: 'orders',
          category: 'transactional',
          country: 'AE',
          recipients: {
            email: 'user@example.com',
          },
          channels: [
            {
              channel: 'email',
              content: {
                subject: 'Order Confirmation',
                render: {
                  template: 'order-success',
                  version: 'v1',
                  locale: 'en',
                  props: { orderId: 'ord_9988' },
                },
              },
            },
          ],
        }),
      }),
    );

    expect(res.status).toBe(202);
  });

  it('4. WhatsApp Template Message Send', async () => {
    const res = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `test_wa_${Date.now()}`,
          userId: 'usr_e2e_123',
          team: 'orders',
          category: 'transactional',
          country: 'AE',
          recipients: {
            whatsapp: '+971501234567',
          },
          channels: [
            {
              channel: 'whatsapp',
              content: {
                template: 'payment_success',
                language: 'en',
                variables: { amount: '250 AED' },
              },
            },
          ],
        }),
      }),
    );

    expect(res.status).toBe(202);
  });

  it('5. Multi-Channel Concurrent Send & Fallback Branching payload', async () => {
    const res = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `test_fallback_${Date.now()}`,
          userId: 'usr_e2e_123',
          team: 'payments',
          category: 'transactional',
          country: 'AE',
          recipients: {
            whatsapp: '+971501234567',
            phone: '+971501234567',
            email: 'kk@example.com',
          },
          channels: [
            {
              channel: 'whatsapp',
              content: { text: 'Payment confirmation' },
            },
          ],
          fallback: {
            rules: [
              {
                when: { channel: 'whatsapp', event: 'failed' },
                send: [{ channel: 'sms' }, { channel: 'email' }],
              },
              {
                when: { channel: 'whatsapp', event: 'not_delivered', afterSeconds: 30 },
                send: [{ channel: 'sms' }],
              },
            ],
          },
        }),
      }),
    );

    expect(res.status).toBe(202);
  });

  it('6. Duplicate Idempotency Key Returns Original Response', async () => {
    const idempotencyKey = `test_dup_${Date.now()}`;
    const payload = {
      idempotencyKey,
      userId: 'usr_e2e_123',
      team: 'payments',
      category: 'transactional',
      country: 'AE',
      recipients: { phone: '+971501234567' },
      channels: [{ channel: 'sms', content: { text: 'Hello' } }],
    };

    const res1 = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );

    const body1 = (await res1.json()) as {
      messageId?: string;
      state?: string;
      createdAt?: string;
      providerMessageId?: string;
      error?: { code?: string };
      received?: boolean;
      channels?: unknown[];
    };

    const res2 = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );

    const body2 = (await res2.json()) as {
      messageId?: string;
      state?: string;
      createdAt?: string;
      providerMessageId?: string;
      error?: { code?: string };
      received?: boolean;
      channels?: unknown[];
    };

    expect(res1.status).toBe(202);
    expect(res2.status).toBe(202);
    expect(body1.messageId).toBe(body2.messageId);
  });

  it('7. Conflicting Idempotency Request Payload Returns 409 Conflict', async () => {
    const idempotencyKey = `test_conflict_${Date.now()}`;
    const payload1 = {
      idempotencyKey,
      userId: 'usr_e2e_123',
      team: 'payments',
      category: 'transactional',
      country: 'AE',
      recipients: { phone: '+971501234567' },
      channels: [{ channel: 'sms', content: { text: 'Hello' } }],
    };

    const payload2 = {
      ...payload1,
      category: 'different_category',
    };

    await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload1),
      }),
    );

    const resConflict = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload2),
      }),
    );

    expect(resConflict.status).toBe(409);
    const body = (await resConflict.json()) as {
      messageId?: string;
      state?: string;
      createdAt?: string;
      providerMessageId?: string;
      error?: { code?: string };
      received?: boolean;
      channels?: unknown[];
    };
    expect(body.error?.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('8. Missing Recipient Validation Returns 400 Bad Request', async () => {
    const res = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `test_missing_${Date.now()}`,
          userId: 'usr_e2e_123',
          team: 'payments',
          category: 'transactional',
          country: 'AE',
          recipients: {}, // No email provided
          channels: [{ channel: 'email', content: { subject: 'Hi', text: 'Hi' } }],
        }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      messageId?: string;
      state?: string;
      createdAt?: string;
      providerMessageId?: string;
      error?: { code?: string };
      received?: boolean;
      channels?: unknown[];
    };
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('9. Email Open Tracking Pixel (GET /v1/t/:token.gif) Returns 1x1 GIF', async () => {
    const res = await app.fetch(new Request('http://localhost:3000/v1/t/token123.gif'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/gif');
  });

  it('10. Provider Webhook Ingestion (POST /v1/webhooks/sendgrid)', async () => {
    const res = await app.fetch(
      new Request('http://localhost:3000/v1/webhooks/sendgrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            email: 'user@example.com',
            event: 'delivered',
            sg_message_id: 'sg_msg_12345',
            timestamp: 1786290603,
          },
        ]),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      messageId?: string;
      state?: string;
      createdAt?: string;
      providerMessageId?: string;
      error?: { code?: string };
      received?: boolean;
      status?: string;
      channels?: unknown[];
    };
    expect(body.received === true || body.status === 'accepted' || body.status === 'duplicate_ignored').toBe(true);
  });

  it('11. Status API (GET /v1/messages/:messageId) Verifies No Provider Message ID Exposed', async () => {
    const createRes = await app.fetch(
      new Request('http://localhost:3000/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `test_status_${Date.now()}`,
          userId: 'usr_e2e_123',
          team: 'payments',
          category: 'transactional',
          country: 'AE',
          recipients: { phone: '+971501234567' },
          channels: [{ channel: 'sms', content: { text: 'Hello' } }],
        }),
      }),
    );

    const createBody = (await createRes.json()) as {
      messageId?: string;
      state?: string;
      createdAt?: string;
      providerMessageId?: string;
      error?: { code?: string };
      received?: boolean;
      channels?: unknown[];
    };
    const messageId = createBody.messageId;

    const statusRes = await app.fetch(new Request(`http://localhost:3000/v1/messages/${messageId}?include=timeline`));

    if (statusRes.status !== 200) {
      console.error('Test 11 GET Status Error:', statusRes.status, await statusRes.text());
    }
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as {
      messageId?: string;
      state?: string;
      createdAt?: string;
      providerMessageId?: string;
      error?: { code?: string };
      received?: boolean;
      channels?: unknown[];
    };

    expect(statusBody.messageId).toBe(messageId);
    expect(statusBody.channels).toBeDefined();
    expect(JSON.stringify(statusBody)).not.toContain('providerMessageId');
  });
});
