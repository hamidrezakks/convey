import crypto from 'node:crypto';
import { mockConfig } from '../config';
import { mockLogger } from './logger';

export interface WebhookEventOptions {
  eventType?: 'delivered' | 'bounced' | 'failed' | 'read' | 'clicked' | 'opened';
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

    case 'postmark': {
      const payload = {
        RecordType: eventType === 'bounced' ? 'Bounce' : eventType === 'opened' ? 'Open' : 'Delivery',
        MessageID: options.messageId,
        Recipient: options.recipient,
        DeliveredAt: timestamp,
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'brevo':
    case 'brevo-sms': {
      const payload = {
        event: eventType,
        'message-id': options.messageId,
        email: options.recipient,
        date: timestamp,
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'ses': {
      const payload = {
        eventType: eventType === 'bounced' ? 'bounce' : eventType === 'failed' ? 'reject' : 'delivery',
        mail: {
          messageId: options.messageId,
          destination: [options.recipient],
          timestamp,
        },
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'infobip': {
      const payload = {
        results: [
          {
            messageId: options.messageId,
            to: options.recipient,
            status: {
              name: eventType === 'delivered' ? 'DELIVERED_TO_HANDSET' : 'UNDELIVERABLE',
              groupName: eventType === 'delivered' ? 'DELIVERED' : 'UNDELIVERABLE',
            },
          },
        ],
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'plivo': {
      const params = new URLSearchParams({
        MessageUUID: options.messageId,
        Status: eventType,
        To: options.recipient,
      });
      return {
        payload: params.toString(),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      };
    }

    case 'telnyx': {
      const payload = {
        data: {
          event_type: 'message.finalized',
          payload: {
            id: options.messageId,
            to: [{ phone_number: options.recipient, status: eventType }],
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

    case 'bandwidth': {
      const payload = [
        {
          type: eventType === 'delivered' ? 'message-delivered' : 'message-failed',
          message: {
            id: options.messageId,
            to: [options.recipient],
          },
        },
      ];
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'cequens': {
      const payload = {
        message_id: options.messageId,
        status: eventType === 'delivered' ? 'DELIVERED' : 'FAILED',
        timestamp,
        recipient: options.recipient,
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'cequens-whatsapp': {
      const payload = {
        message_id: options.messageId,
        status: eventType === 'delivered' ? 'DELIVERED' : 'FAILED',
        recipientPhone: options.recipient,
        timestamp,
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'pagerduty': {
      const payload = {
        event: {
          id: options.messageId,
          event_action: eventType === 'failed' ? 'trigger' : 'resolve',
          client: 'Convey Mock Pipeline',
          created_at: timestamp,
        },
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'discord': {
      const payload = {
        id: options.messageId,
        type: 0,
        content: `Webhook event: ${eventType}`,
        timestamp,
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'slack': {
      const payload = {
        event: {
          type: 'message',
          ts: options.messageId,
          channel: 'C12345678',
          text: `Message event: ${eventType}`,
        },
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'expo': {
      const payload = {
        data: [
          {
            id: options.messageId,
            status: eventType === 'failed' ? 'error' : 'ok',
            message: eventType === 'failed' ? 'DeviceNotRegistered' : undefined,
          },
        ],
      };
      return {
        payload,
        headers: {
          'content-type': 'application/json',
        },
      };
    }

    case 'one-signal': {
      const payload = {
        id: options.messageId,
        recipients: 1,
        external_id: options.recipient,
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

      // Broadcast live webhook event to connected WebSockets
      const { mockWsManager } = await import('./websocket-manager');
      mockWsManager.broadcastInspectorEvent('webhook', {
        providerId,
        messageId: options.messageId,
        eventType: options.eventType || 'delivered',
        status: res.status,
        targetUrl,
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
