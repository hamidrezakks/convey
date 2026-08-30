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
