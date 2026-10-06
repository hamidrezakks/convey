import { afterEach, expect, spyOn, test } from 'bun:test';
import { ErrorCategory } from '../src/modules/providers/core/provider-types';
import { ResendEmailAdapter } from '../src/modules/providers/email/resend/resend.adapter';
import { TwilioSmsAdapter } from '../src/modules/providers/sms/twilio/twilio.adapter';

let restore: (() => void) | undefined;
afterEach(() => restore?.());
const cases = [
  {
    name: 'resend',
    adapter: new ResendEmailAdapter({ apiKey: 'mock-only-secret', from: 'sender@example.test' }),
    options: { recipient: { email: 'recipient@example.test' }, content: { subject: 'Mock', text: 'Test' } },
    endpoint: 'https://api.resend.com/emails',
    response: { id: 'mock-resend-accepted' },
    receipt: { type: 'email.delivered', data: { email_id: 'mock-resend-accepted' } },
    authorization: 'Bearer mock-only-secret',
  },
  {
    name: 'twilio',
    adapter: new TwilioSmsAdapter({ accountSid: 'ACmock', authToken: 'mock-only-secret', from: '+15005550006' }),
    options: { recipient: { phone: '+15005550009' }, content: { text: 'Test' } },
    endpoint: 'https://api.twilio.com/2010-04-01/Accounts/ACmock/Messages.json',
    response: { sid: 'SMmockaccepted', status: 'queued' },
    receipt: { MessageSid: 'SMmockaccepted', MessageStatus: 'delivered' },
    authorization: `Basic ${Buffer.from('ACmock:mock-only-secret').toString('base64')}`,
  },
];
for (const scenario of cases) {
  test(`${scenario.name}: bounded mock outcomes never become false acceptance`, async () => {
    const outcomes: Array<Response | Error> = [
      Response.json(scenario.response, { status: 201 }),
      Response.json({ message: 'Invalid credentials' }, { status: 401 }),
      Response.json({ message: 'Too many requests' }, { status: 429, headers: { 'retry-after': '2' } }),
      Response.json({ message: 'Unavailable' }, { status: 503 }),
      new Response('not-json', { status: 200 }),
      Response.json({}, { status: 200 }),
      new Error('Mock connection lost after acceptance'),
    ];
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const mock = spyOn(globalThis, 'fetch').mockImplementation((async (input, init) => {
      calls.push({ url: String(input), init });
      const outcome = outcomes.shift();
      if (!outcome) throw new Error('Unexpected additional provider call');
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }) as typeof fetch);
    restore = () => mock.mockRestore();
    const accepted = await scenario.adapter.send(scenario.options);
    expect(accepted.success).toBe(true);
    expect(scenario.adapter.parseWebhook(scenario.receipt)[0].providerMessageId).toBe(
      accepted.providerMessageId ?? 'missing',
    );
    const denied = await scenario.adapter.send(scenario.options);
    expect(denied.success).toBe(false);
    expect(denied.error?.category).toBe(ErrorCategory.PERMANENT);
    const throttled = await scenario.adapter.send(scenario.options);
    expect(throttled.success).toBe(false);
    expect(throttled.error?.category).toBe(ErrorCategory.RATE_LIMITED);
    for (let i = 0; i < 4; i++) expect((await scenario.adapter.send(scenario.options)).success).toBe(false);
    expect(outcomes).toHaveLength(0);
    expect(calls).toHaveLength(7);
    for (const call of calls) {
      expect(call.url).toBe(scenario.endpoint);
      expect(call.init?.method).toBe('POST');
      expect(new Headers(call.init?.headers).get('authorization')).toBe(scenario.authorization);
      const body = String(call.init?.body);
      expect(body).toContain('Test');
      expect(body).not.toContain('mock-only-secret');
    }
  });
}
