import { describe, expect, it } from 'bun:test';
import { Channel, Convey, MessagePriority } from '../src';

describe('QA Omnichannel Messages Serialization & Normalization', () => {
  it('should serialize SMS messages into Convey wire schema', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ success: true, messageId: 'msg_sms_01', state: 'accepted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });
    const res = await client.messages.send({
      channel: Channel.SMS,
      recipient: '+14155552671',
      priority: MessagePriority.CRITICAL,
      content: { body: 'Your security code is 849201' },
      metadata: { action: '2fa_login', ip: '192.168.1.1' },
    });

    expect(res.publicId).toBe('msg_sms_01');
    expect(capturedBody).toBeDefined();
    expect(capturedBody?.priority).toBe('critical');
    expect(capturedBody?.recipients).toEqual({ phone: '+14155552671' });
    expect(capturedBody?.channels).toEqual([
      {
        channel: 'sms',
        content: { text: 'Your security code is 849201' },
      },
    ]);
    expect(capturedBody?.metadata).toEqual({ action: '2fa_login', ip: '192.168.1.1' });
  });

  it('should serialize WhatsApp messages with templates and variables', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ success: true, messageId: 'msg_wa_01', state: 'accepted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });
    await client.messages.send({
      channel: Channel.WHATSAPP,
      recipient: '+447911123456',
      content: {
        templateId: 'shipping_update_v2',
        variables: { tracking_number: 'TRK998877', carrier: 'DHL' },
      },
    });

    expect(capturedBody?.recipients).toEqual({ whatsapp: '+447911123456' });
    expect(capturedBody?.channels).toEqual([
      {
        channel: 'whatsapp',
        content: {
          template: 'shipping_update_v2',
          variables: { tracking_number: 'TRK998877', carrier: 'DHL' },
        },
      },
    ]);
  });

  it('should serialize Slack messages with channel ID targeting', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ success: true, messageId: 'msg_slack_01', state: 'accepted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });
    await client.messages.send({
      channel: Channel.SLACK,
      recipient: 'C0123456789',
      content: { body: 'Deployment #42 completed successfully.' },
    });

    expect(capturedBody?.recipients).toEqual({ slack: { channelId: 'C0123456789' } });
    expect(capturedBody?.channels).toEqual([
      {
        channel: 'slack',
        content: { text: 'Deployment #42 completed successfully.' },
      },
    ]);
  });

  it('should serialize Push / FCM notifications with tokens array', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ success: true, messageId: 'msg_fcm_01', state: 'accepted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });
    await client.messages.send({
      channel: Channel.PUSH,
      recipient: 'fcm_token_device_abc123',
      content: { subject: 'Breaking News', body: 'New feature released!' },
    });

    expect(capturedBody?.recipients).toEqual({ fcmTokens: ['fcm_token_device_abc123'] });
    expect(capturedBody?.channels).toEqual([
      {
        channel: 'fcm',
        content: { title: 'Breaking News', body: 'New feature released!' },
      },
    ]);
  });

  it('should convert scheduledAt Date objects into ISO 8601 strings', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ success: true, messageId: 'msg_sched_01', state: 'scheduled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });
    const scheduledDate = new Date('2026-12-31T23:59:59.000Z');

    await client.messages.send({
      channel: Channel.EMAIL,
      recipient: 'future@test.com',
      content: { body: 'Happy New Year!' },
      scheduledAt: scheduledDate,
    });

    expect(capturedBody?.scheduledAt).toBe('2026-12-31T23:59:59.000Z');
  });

  it('should support raw advanced omnichannel cascade payloads without mutation', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ success: true, messageId: 'msg_cascade_01', state: 'accepted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    await client.messages.send({
      userId: 'usr_premium_101',
      team: 'billing',
      category: 'INVOICE',
      country: 'DE',
      priority: MessagePriority.HIGH,
      recipients: {
        email: 'billing@client.de',
        phone: '+491512345678',
      },
      channels: [
        { channel: 'email', content: { subject: 'Invoice #901', html: '<p>Invoice attached</p>' } },
        { channel: 'sms', content: { text: 'Invoice #901 is due today' } },
      ],
      cascade: {
        steps: [{ channel: 'email', waitForReceiptMs: 60000 }, { channel: 'sms' }],
      },
    });

    expect(capturedBody?.userId).toBe('usr_premium_101');
    expect(capturedBody?.team).toBe('billing');
    expect(capturedBody?.priority).toBe('transactional');
    expect(capturedBody?.country).toBe('DE');
    expect(capturedBody?.cascade).toBeDefined();
  });
});
