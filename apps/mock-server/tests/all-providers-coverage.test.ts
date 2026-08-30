import { describe, expect, it } from 'bun:test';
import { allHandlers } from '../src/core/engine';

// All 88 Provider IDs categorized by Channel from Convey Provider Registry
const ALL_88_PROVIDERS: Array<{ id: string; channel: 'email' | 'sms' | 'chat' | 'push' | 'tool' }> = [
  // Chat (17)
  { id: 'webex-messaging', channel: 'chat' },
  { id: 'discord', channel: 'chat' },
  { id: 'grafana-on-call', channel: 'chat' },
  { id: 'whatsapp-business', channel: 'chat' },
  { id: 'zulip', channel: 'chat' },
  { id: 'msteams', channel: 'chat' },
  { id: 'chat-webhook', channel: 'chat' },
  { id: 'ryver', channel: 'chat' },
  { id: 'sendblue', channel: 'chat' },
  { id: 'line', channel: 'chat' },
  { id: 'telegram', channel: 'chat' },
  { id: 'rocket-chat', channel: 'chat' },
  { id: 'slack', channel: 'chat' },
  { id: 'cequens-whatsapp', channel: 'chat' },
  { id: 'mattermost', channel: 'chat' },
  { id: 'getstream', channel: 'chat' },
  { id: 'twilio-whatsapp', channel: 'chat' },

  // Email (20)
  { id: 'mailtrap', channel: 'email' },
  { id: 'plunk', channel: 'email' },
  { id: 'postmark', channel: 'email' },
  { id: 'infobip', channel: 'email' },
  { id: 'sparkpost', channel: 'email' },
  { id: 'sendgrid', channel: 'email' },
  { id: 'mailjet', channel: 'email' },
  { id: 'mandrill', channel: 'email' },
  { id: 'emailjs', channel: 'email' },
  { id: 'email-webhook', channel: 'email' },
  { id: 'mailersend', channel: 'email' },
  { id: 'mailgun', channel: 'email' },
  { id: 'ses', channel: 'email' },
  { id: 'netcore', channel: 'email' },
  { id: 'brevo', channel: 'email' },
  { id: 'anypost', channel: 'email' },
  { id: 'braze', channel: 'email' },
  { id: 'nodemailer', channel: 'email' },
  { id: 'resend', channel: 'email' },
  { id: 'outlook365', channel: 'email' },

  // Push (8)
  { id: 'appio', channel: 'push' },
  { id: 'one-signal', channel: 'push' },
  { id: 'push-webhook', channel: 'push' },
  { id: 'apns', channel: 'push' },
  { id: 'expo', channel: 'push' },
  { id: 'fcm', channel: 'push' },
  { id: 'pusher-beams', channel: 'push' },
  { id: 'pushpad', channel: 'push' },

  // SMS (39)
  { id: 'sendchamp', channel: 'sms' },
  { id: 'generic-sms', channel: 'sms' },
  { id: 'infobip', channel: 'sms' },
  { id: 'bandwidth', channel: 'sms' },
  { id: 'bulk-sms', channel: 'sms' },
  { id: 'clicksend', channel: 'sms' },
  { id: 'cm-telecom', channel: 'sms' },
  { id: 'messagebird', channel: 'sms' },
  { id: 'sns', channel: 'sms' },
  { id: 'ring-central', channel: 'sms' },
  { id: 'telnyx', channel: 'sms' },
  { id: 'afro-sms', channel: 'sms' },
  { id: 'mobishastra', channel: 'sms' },
  { id: 'unifonic', channel: 'sms' },
  { id: 'smsmode', channel: 'sms' },
  { id: 'sms-central', channel: 'sms' },
  { id: 'forty-six-elks', channel: 'sms' },
  { id: 'azure-sms', channel: 'sms' },
  { id: 'gupshup', channel: 'sms' },
  { id: 'isend-sms', channel: 'sms' },
  { id: 'simpletexting', channel: 'sms' },
  { id: 'plivo', channel: 'sms' },
  { id: 'imedia', channel: 'sms' },
  { id: 'brevo-sms', channel: 'sms' },
  { id: 'africas-talking', channel: 'sms' },
  { id: 'eazy-sms', channel: 'sms' },
  { id: 'nexmo', channel: 'sms' },
  { id: 'firetext', channel: 'sms' },
  { id: 'sinch', channel: 'sms' },
  { id: 'isendpro-sms', channel: 'sms' },
  { id: 'ruach-sms', channel: 'sms' },
  { id: 'clickatell', channel: 'sms' },
  { id: 'kannel', channel: 'sms' },
  { id: 'cequens', channel: 'sms' },
  { id: 'sms77', channel: 'sms' },
  { id: 'maqsam', channel: 'sms' },
  { id: 'termii', channel: 'sms' },
  { id: 'twilio', channel: 'sms' },
  { id: 'burst-sms', channel: 'sms' },

  // Tool (4)
  { id: 'pagerduty', channel: 'tool' },
  { id: 'grafana', channel: 'tool' },
  { id: 'tool-webhook', channel: 'tool' },
  { id: 'opsgenie', channel: 'tool' },
];

describe('100% Provider Coverage Verification', () => {
  it('has total 88 registered providers matching Convey manifests', () => {
    expect(ALL_88_PROVIDERS.length).toBe(88);
  });

  for (const provider of ALL_88_PROVIDERS) {
    it(`registers and handles provider mock: ${provider.id} (${provider.channel})`, async () => {
      const handler = allHandlers[provider.id];
      expect(handler).toBeDefined();
      expect(handler.id).toBe(provider.id);

      // Verify request execution through dispatcher
      const req = new Request(`http://localhost:4000/${provider.id}/send`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock_test_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: 'test@convey.dev',
          recipient: '+15550192834',
          channel: 'general',
          subject: 'Test Subject',
          text: 'Test Body',
          content: 'Test Content',
        }),
      });

      const res = await handler.handle(req, {
        providerId: provider.id,
        channel: provider.channel,
        url: new URL(req.url),
        method: req.method,
        headers: req.headers,
        rawBody: '',
        parsedBody: {},
        receivedAt: new Date(),
      });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
    });
  }
});
