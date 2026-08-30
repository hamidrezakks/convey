import { describe, expect, it } from 'bun:test';
import { applyChaosSimulation } from '../src/core/chaos';
import { dispatchMockRequest, recordedRequests } from '../src/core/engine';
import { buildWebhookPayload } from '../src/core/webhook-client';

describe('Webhook & Chaos Engine', () => {
  it('applies header-based rate limiting chaos overrides (429)', () => {
    const headers = new Headers({ 'x-mock-status': '429' });
    const result = applyChaosSimulation({ headers });
    expect(result.shouldHalt).toBe(true);
    expect(result.status).toBe(429);
  });

  it('applies header-based error chaos overrides (500)', () => {
    const headers = new Headers({ 'x-mock-error': 'true' });
    const result = applyChaosSimulation({ headers });
    expect(result.shouldHalt).toBe(true);
    expect(result.status).toBe(500);
  });

  it('formats authentic webhook payloads for Resend', () => {
    const webhook = buildWebhookPayload('resend', {
      eventType: 'delivered',
      messageId: 're_1234567890',
      recipient: 'user@example.com',
    });
    expect(webhook.headers['content-type']).toBe('application/json');
    expect(webhook.headers['svix-signature']).toBeDefined();
    const payload = webhook.payload as { type: string; data: { email_id: string; to: string[] } };
    expect(payload.type).toBe('email.delivered');
    expect(payload.data.email_id).toBe('re_1234567890');
    expect(payload.data.to).toContain('user@example.com');
  });

  it('formats authentic webhook payloads for Twilio', () => {
    const webhook = buildWebhookPayload('twilio', {
      eventType: 'delivered',
      messageId: 'SM1234567890abcdef',
      recipient: '+15550192834',
    });
    expect(webhook.headers['content-type']).toBe('application/x-www-form-urlencoded');
    const params = new URLSearchParams(webhook.payload as string);
    expect(params.get('MessageSid')).toBe('SM1234567890abcdef');
    expect(params.get('MessageStatus')).toBe('delivered');
  });

  it('formats authentic webhook payloads for WhatsApp Business with HMAC signature', () => {
    const webhook = buildWebhookPayload('whatsapp-business', {
      eventType: 'delivered',
      messageId: 'wamid.HBgL12345',
      recipient: '+15550192834',
    });
    expect(webhook.headers['content-type']).toBe('application/json');
    expect(webhook.headers['x-hub-signature-256']).toMatch(/^sha256=[0-9a-f]{64}$/);
    const payload = webhook.payload as {
      entry: Array<{ changes: Array<{ value: { statuses: Array<{ id: string; status: string }> } }> }>;
    };
    expect(payload.entry[0].changes[0].value.statuses[0].id).toBe('wamid.HBgL12345');
    expect(payload.entry[0].changes[0].value.statuses[0].status).toBe('delivered');
  });

  it('formats authentic webhook payloads for Postmark, Brevo, SES, Infobip, Telnyx, Bandwidth', () => {
    const postmark = buildWebhookPayload('postmark', { messageId: 'pm-123', recipient: 'user@test.com' });
    expect((postmark.payload as { MessageID: string }).MessageID).toBe('pm-123');

    const brevo = buildWebhookPayload('brevo', { messageId: 'br-123', recipient: 'user@test.com' });
    expect((brevo.payload as { 'message-id': string })['message-id']).toBe('br-123');

    const ses = buildWebhookPayload('ses', { messageId: 'ses-123', recipient: 'user@test.com' });
    expect((ses.payload as { mail: { messageId: string } }).mail.messageId).toBe('ses-123');

    const infobip = buildWebhookPayload('infobip', { messageId: 'info-123', recipient: 'user@test.com' });
    expect((infobip.payload as { results: Array<{ messageId: string }> }).results[0].messageId).toBe('info-123');

    const telnyx = buildWebhookPayload('telnyx', { messageId: 'tel-123', recipient: 'user@test.com' });
    expect((telnyx.payload as { data: { payload: { id: string } } }).data.payload.id).toBe('tel-123');

    const bandwidth = buildWebhookPayload('bandwidth', { messageId: 'bw-123', recipient: 'user@test.com' });
    expect((bandwidth.payload as Array<{ message: { id: string } }>)[0].message.id).toBe('bw-123');
  });

  it('dispatches request and records payload in inspection history', async () => {
    const req = new Request('http://localhost:4000/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer re_test_key_12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'sender@convey.dev',
        to: 'user@example.com',
        subject: 'Inspection Test',
        text: 'Hello Inspect',
      }),
    });

    const res = await dispatchMockRequest(req);
    expect(res.status).toBe(200);
    expect(recordedRequests.length).toBeGreaterThan(0);
    const last = recordedRequests[recordedRequests.length - 1];
    expect(last.providerId).toBe('resend');
    expect(last.status).toBe(200);
  });
});
