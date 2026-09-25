import { describe, expect, it, spyOn } from 'bun:test';
import { COMPLETE_88_PROVIDER_CATALOG, isNativeProviderIncomplete } from '@convey/shared';
import { Channel } from '../src/modules/messaging/messaging.types';
import { normalizeProviderConfig } from '../src/modules/providers/core/provider-config';
import { ProviderRegistry } from '../src/modules/providers/core/provider-registry';
import { ErrorCategory } from '../src/modules/providers/core/provider-types';
import { BrevoSmsSmsAdapter } from '../src/modules/providers/sms/brevo-sms/brevo-sms.adapter';
import { NexmoSmsAdapter } from '../src/modules/providers/sms/nexmo/nexmo.adapter';
import { TelnyxSmsAdapter } from '../src/modules/providers/sms/telnyx/telnyx.adapter';

const sms = { recipient: { phone: '+15005550006' }, from: '+15005550007', content: { text: 'Hello' } };

describe('provider configuration and routing', () => {
  for (const item of COMPLETE_88_PROVIDER_CATALOG) {
    it(`${item.category}/${item.id}: console credential names reach setup validation`, () => {
      const adapter = ProviderRegistry.getModuleByChannel(item.category as Channel, item.id.toLowerCase())?.adapter;
      expect(adapter).toBeDefined();
      expect(adapter?.hasSetup?.(item.defaultCredentials || {})).toBe(!isNativeProviderIncomplete(item.id));
    });
  }
  it('preserves explicit native overrides and parses booleans safely', () => {
    expect(normalizeProviderConfig('apns', { APNS_PRODUCTION: 'false', APNS_PRIVATE_KEY_P8: 'key' })).toMatchObject({
      production: false,
      key: 'key',
    });
    expect(
      normalizeProviderConfig('nodemailer', {
        SMTP_PORT: '587',
        SMTP_PASSWORD: 'secret',
        host: 'explicit',
        SMTP_HOST: 'ignored',
      }),
    ).toMatchObject({ port: 587, pass: 'secret', host: 'explicit' });
    expect(normalizeProviderConfig('fcm', { FCM_SERVICE_ACCOUNT_JSON: '{invalid' }).privateKey).toBeUndefined();
  });
  it('routes concrete push/chat channels and rejects channel mismatches', () => {
    for (const [channel, id] of [
      [Channel.FCM, 'fcm'],
      [Channel.APNS, 'apns'],
      [Channel.SLACK, 'slack'],
      [Channel.TELEGRAM, 'telegram'],
      [Channel.WHATSAPP, 'twilio-whatsapp'],
    ] as const) {
      expect(ProviderRegistry.getByChannel(channel).map((adapter) => adapter.id)).toContain(id);
      expect(ProviderRegistry.getModuleByChannel(channel, id)?.id).toBe(id);
    }
    expect(ProviderRegistry.getModuleByChannel(Channel.EMAIL, 'twilio')).toBeUndefined();
    expect(ProviderRegistry.getModuleByChannel(Channel.APNS, 'fcm')).toBeUndefined();
    expect(ProviderRegistry.getModuleByChannel(Channel.EMAIL, 'infobip')?.channel).toBe(Channel.EMAIL);
    expect(ProviderRegistry.getModuleByChannel(Channel.SMS, 'infobip')?.channel).toBe(Channel.SMS);
  });
  it('unimplemented native adapters cannot send, even with a custom URL', async () => {
    const fetch = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network should occur'));
    try {
      for (const item of COMPLETE_88_PROVIDER_CATALOG.filter((provider) => isNativeProviderIncomplete(provider.id))) {
        const adapter = ProviderRegistry.getModuleByChannel(Channel.SMS, item.id)?.adapter;
        const result = await adapter?.send(sms, { apiKey: 'secret', baseUrl: 'https://example.test' });
        expect(result?.success).toBe(false);
        expect(result?.error?.code).toBe('PROVIDER_NOT_IMPLEMENTED');
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
  it('uses native Telnyx, Brevo and Vonage protocols', async () => {
    const urls: string[] = [];
    const fetch = spyOn(globalThis, 'fetch').mockImplementation((async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('telnyx')) return Response.json({ data: { id: 'telnyx-id' } });
      if (url.includes('brevo')) {
        expect(new Headers(init?.headers).get('api-key')).toBe('key');
        return Response.json({ messageId: 123 });
      }
      expect(JSON.parse(String(init?.body))).toMatchObject({ api_key: 'key', api_secret: 'secret' });
      return Response.json({ messages: [{ status: '0', 'message-id': 'vonage-id' }] });
    }) as typeof globalThis.fetch);
    try {
      expect((await new TelnyxSmsAdapter({ apiKey: 'key' }).send(sms)).success).toBe(true);
      expect((await new BrevoSmsSmsAdapter({ apiKey: 'key' }).send(sms)).success).toBe(true);
      expect((await new NexmoSmsAdapter({ apiKey: 'key', apiSecret: 'secret' }).send(sms)).success).toBe(true);
      expect(urls).toEqual([
        'https://api.telnyx.com/v2/messages',
        'https://api.brevo.com/v3/transactionalSMS/send',
        'https://rest.nexmo.com/sms/json',
      ]);
    } finally {
      fetch.mockRestore();
    }
  });
});

describe('additional native SMS wire contracts', () => {
  const cases = [
    {
      id: 'messagebird',
      config: { apiKey: 'key' },
      url: 'https://rest.messagebird.com/messages',
      header: ['authorization', 'AccessKey key'],
      bodyField: 'body',
      response: { id: 'bird-id' },
    },
    {
      id: 'sinch',
      config: { apiKey: 'key', servicePlanId: 'plan' },
      url: 'https://us.sms.api.sinch.com/xms/v1/plan/batches',
      header: ['authorization', 'Bearer key'],
      bodyField: 'body',
      response: { id: 'sinch-id' },
    },
    {
      id: 'forty-six-elks',
      config: { username: 'user', password: 'pass' },
      url: 'https://api.46elks.com/a1/sms',
      header: ['authorization', `Basic ${Buffer.from('user:pass').toString('base64')}`],
      bodyField: 'message',
      response: { id: 'elks-id', status: 'created' },
    },
    {
      id: 'sms77',
      config: { apiKey: 'key' },
      url: 'https://gateway.seven.io/api/sms',
      header: ['x-api-key', 'key'],
      bodyField: 'text',
      response: { success: '100', messages: [{ id: 'seven-id', success: true }] },
    },
    {
      id: 'firetext',
      config: { apiKey: 'key' },
      url: 'https://www.firetext.co.uk/api/sendsms',
      header: [],
      bodyField: 'message',
      response: '0:1 SMS successfully queued',
    },
  ];
  for (const fixture of cases) {
    it(`${fixture.id}: authenticates and handles native success, errors and malformed acknowledgements`, async () => {
      const adapter = ProviderRegistry.getModuleByChannel(Channel.SMS, fixture.id)?.adapter;
      expect(adapter).toBeDefined();
      let status = 200;
      let response: unknown = fixture.response;
      const fetch = spyOn(globalThis, 'fetch').mockImplementation((async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        expect(String(input)).toBe(fixture.url);
        if (fixture.header[0]) expect(new Headers(init?.headers).get(fixture.header[0])).toBe(fixture.header[1]);
        const body =
          init?.body instanceof URLSearchParams ? Object.fromEntries(init.body) : JSON.parse(String(init?.body));
        expect(body[fixture.bodyField]).toBe('Hello');
        return typeof response === 'string'
          ? new Response(response, { status, headers: { 'X-Message': 'firetext-id' } })
          : Response.json(response, { status });
      }) as typeof globalThis.fetch);
      try {
        expect((await adapter?.send(sms, fixture.config))?.success).toBe(true);
        status = 429;
        expect((await adapter?.send(sms, fixture.config))?.error?.category).toBe(ErrorCategory.RATE_LIMITED);
        status = 503;
        expect((await adapter?.send(sms, fixture.config))?.error?.category).toBe(ErrorCategory.TRANSIENT);
        status = 200;
        response = {};
        expect((await adapter?.send(sms, fixture.config))?.success).toBe(false);
      } finally {
        fetch.mockRestore();
      }
    });
  }
});
