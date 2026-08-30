import { describe, expect, it } from 'bun:test';
import { chatHandlers } from '../src/handlers/chat';
import { pushHandlers } from '../src/handlers/push';
import { toolHandlers } from '../src/handlers/tool';

describe('Chat, Push & Tool Provider Handlers', () => {
  it('handles Slack POST /api/chat.postMessage with authentic timestamp', async () => {
    const handler = chatHandlers.slack;
    const req = new Request('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xoxb-mock-bot-token-12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: 'C12345678', text: 'Hello Slack' }),
    });
    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; ts: string; channel: string };
    expect(data.ok).toBe(true);
    expect(data.ts).toMatch(/^\d{10}\.\d{6}$/);
    expect(data.channel).toBe('C12345678');
  });

  it('handles Telegram POST /bot:token/sendMessage', async () => {
    const handler = chatHandlers.telegram;
    const req = new Request('https://api.telegram.org/bot123456:ABC-DEF/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: 987654321, text: 'Hello Telegram' }),
    });
    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; result: { message_id: number } };
    expect(data.ok).toBe(true);
    expect(data.result.message_id).toBeDefined();
  });

  it('handles Discord Webhook POST', async () => {
    const handler = chatHandlers.discord;
    const req = new Request('https://discord.com/api/webhooks/1234567890/mocktoken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Discord alert', username: 'ConveyBot' }),
    });
    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string };
    expect(data.id).toBeDefined();
  });

  it('handles FCM POST messages:send with authentic name schema', async () => {
    const handler = pushHandlers.fcm;
    const req = new Request('https://fcm.googleapis.com/v1/projects/mock-proj/messages:send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ya29.mock_oauth_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: 'fcm_device_token_123',
          notification: { title: 'New Notification', body: 'You received a message' },
        },
      }),
    });
    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { name: string };
    expect(data.name).toContain('projects/mock-proj/messages/');
  });

  it('handles APNs POST /3/device/:deviceToken', async () => {
    const handler = pushHandlers.apns;
    const req = new Request('https://api.push.apple.com/3/device/0123456789abcdef0123456789abcdef', {
      method: 'POST',
      headers: {
        Authorization: 'bearer mock_jwt_token',
        'apns-topic': 'com.convey.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aps: { alert: { title: 'APNs Alert', body: 'Hello iOS' }, sound: 'default' },
      }),
    });
    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('apns-id')).toBeDefined();
  });

  it('handles PagerDuty POST /v2/enqueue with 202 Accepted', async () => {
    const handler = toolHandlers.pagerduty;
    const req = new Request('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: 'mock_routing_key_12345',
        event_action: 'trigger',
        payload: { summary: 'Production Database High CPU', severity: 'critical', source: 'convey' },
      }),
    });
    const res = await handler.handle(req);
    expect(res.status).toBe(202);
    const data = (await res.json()) as { status: string; dedup_key: string };
    expect(data.status).toBe('success');
    expect(data.dedup_key).toMatch(/^pd_dedup_/);
  });
});
