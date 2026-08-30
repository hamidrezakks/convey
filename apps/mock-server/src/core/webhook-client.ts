import crypto from 'node:crypto';
import { mockConfig } from '../config';
import { mockLogger } from './logger';

export interface WebhookEventOptions {
  eventType?: 'delivered' | 'bounced' | 'failed' | 'read' | 'clicked';
  messageId: string;
  recipient: string;
  statusCallback?: string;
  errorReason?: string;
}

export function buildWebhookPayload(
  providerId: string,
  options: WebhookEventOptions,
): { payload: unknown; headers: Record<string, string> } {
  const eventType = options.eventType || 'delivered';
  const now = new Date();
  const timestamp = now.toISOString();

  switch (providerId.toLowerCase()) {
    case 'resend': {
      const svixId = `msg_${crypto.randomUUID().replace(/-/g, '')}`;
      const svixTimestamp = Math.floor(now.getTime() / 1000).toString();
      const payload = {
        type: `email.${eventType}`,
        created_at: timestamp,
        data: {
          created_at: timestamp,
          email_id: options.messageId,
          from: 'onboarding@convey.dev',
          to: [options.recipient],
          subject: 'Delivery Notification',
        },
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': `v1,${crypto.randomBytes(32).toString('base64')}`,
        },
      };
    }

    case 'twilio':
    case 'twilio-whatsapp': {
      const params = new URLSearchParams({
        MessageSid: options.messageId,
        MessageStatus: eventType === 'failed' ? 'undelivered' : eventType,
        To: options.recipient,
        From: '+15559876543',
        AccountSid: 'ACmockaccount1234567890abcdef',
        ApiVersion: '2010-04-01',
      });
      return {
        payload: params.toString(),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': crypto.randomBytes(20).toString('base64'),
        },
      };
    }

    case 'whatsapp-business': {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_MOCK_ACCOUNT',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15559876543',
                    phone_number_id: '123456789',
                  },
                  statuses: [
                    {
                      id: options.messageId,
                      status: eventType,
                      timestamp: Math.floor(now.getTime() / 1000).toString(),
                      recipient_id: options.recipient.replace(/\D/g, ''),
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': `sha256=${crypto.randomBytes(32).toString('hex')}`,
        },
      };
    }

    case 'sendgrid': {
      const payload = [
        {
          email: options.recipient,
          timestamp: Math.floor(now.getTime() / 1000),
          event: eventType === 'failed' ? 'dropped' : eventType,
          sg_message_id: options.messageId,
          response: '250 2.0.0 OK',
        },
      ];
      return {
        payload,
        headers: {
          'content-type': 'application/json',
          'x-twilio-email-event-webhook-signature': crypto.randomBytes(32).toString('base64'),
        },
      };
    }

    case 'mailgun': {
      const payload = {
        'event-data': {
          event: eventType,
          id: crypto.randomUUID(),
          timestamp: now.getTime() / 1000,
          recipient: options.recipient,
          message: {
            headers: {
              'message-id': options.messageId,
            },
          },
        },
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    default: {
      const payload = {
        providerId,
        providerMessageId: options.messageId,
        status: eventType,
        recipient: options.recipient,
        timestamp,
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }
  }
}

export function scheduleWebhookCallback(providerId: string, options: WebhookEventOptions): void {
  const targetUrl = options.statusCallback || `${mockConfig.webhookUrl.replace(/\/$/, '')}/${providerId.toLowerCase()}`;

  setTimeout(async () => {
    try {
      const { payload, headers } = buildWebhookPayload(providerId, options);
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body,
      });

      mockLogger.info(`[WEBHOOK-DISPATCH] Sent async DLR callback for ${providerId} to ${targetUrl}`, {
        status: res.status,
        messageId: options.messageId,
        eventType: options.eventType || 'delivered',
      });
    } catch (err: unknown) {
      mockLogger.error(`[WEBHOOK-DISPATCH-ERROR] Failed to send webhook callback to ${targetUrl}`, {
        error: (err as Error).message,
        providerId,
        messageId: options.messageId,
      });
    }
  }, mockConfig.webhookDelayMs);
}
