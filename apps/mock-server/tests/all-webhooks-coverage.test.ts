import { describe, expect, it } from 'bun:test';
import { buildWebhookPayload } from '../src/core/webhook-client';

describe('All Webhook Payloads & Signatures Coverage', () => {
  const providersToTest = [
    { id: 'resend', expectedSignatureHeader: 'svix-signature' },
    { id: 'twilio', expectedSignatureHeader: 'x-twilio-signature' },
    { id: 'twilio-whatsapp', expectedSignatureHeader: 'x-twilio-signature' },
    { id: 'whatsapp-business', expectedSignatureHeader: 'x-hub-signature-256' },
    { id: 'sendgrid', expectedSignatureHeader: 'x-twilio-email-event-webhook-signature' },
    { id: 'mailgun' },
    { id: 'postmark' },
    { id: 'brevo' },
    { id: 'ses' },
    { id: 'infobip' },
    { id: 'plivo' },
    { id: 'telnyx' },
    { id: 'bandwidth' },
    { id: 'cequens' },
    { id: 'cequens-whatsapp' },
    { id: 'pagerduty' },
    { id: 'discord' },
    { id: 'slack' },
    { id: 'expo' },
    { id: 'one-signal' },
  ];

  for (const p of providersToTest) {
    it(`generates valid authentic webhook payload for ${p.id}`, () => {
      const { payload, headers } = buildWebhookPayload(p.id, {
        eventType: 'delivered',
        messageId: `msg_${p.id}_12345`,
        recipient: '+15550192834',
      });

      expect(payload).toBeDefined();
      expect(headers['content-type']).toBeDefined();

      if (p.expectedSignatureHeader) {
        expect(headers[p.expectedSignatureHeader]).toBeDefined();
      }
    });
  }
});
