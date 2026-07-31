import { ProviderRegistry } from '../../src/modules/providers/core/provider-registry';

export interface WebhookSimulationParams {
  providerId: string;
  providerMessageId: string;
  event: 'delivered' | 'opened' | 'read' | 'failed' | 'bounced';
  recipient?: string;
  timestamp?: Date;
}

export function buildProviderWebhookPayload(params: WebhookSimulationParams) {
  const { providerId, providerMessageId, event, recipient = 'user@example.com', timestamp = new Date() } = params;
  const unixTs = Math.floor(timestamp.getTime() / 1000);

  const registeredModule = ProviderRegistry.getModule(providerId);
  if (registeredModule?.mock?.buildWebhookPayload) {
    const mappedEventType =
      event === 'opened' || event === 'read'
        ? 'read'
        : event === 'bounced' || event === 'failed'
          ? 'failed'
          : 'delivered';
    return registeredModule.mock.buildWebhookPayload({
      eventType: mappedEventType,
      providerMessageId,
      recipient,
    }).payload;
  }

  switch (providerId) {
    case 'sendgrid':
      return [
        {
          email: recipient,
          event: event === 'opened' ? 'open' : event === 'bounced' ? 'bounce' : event === 'failed' ? 'dropped' : event,
          sg_message_id: providerMessageId,
          timestamp: unixTs,
        },
      ];

    case 'resend':
      return {
        type: `email.${event}`,
        created_at: timestamp.toISOString(),
        data: {
          email_id: providerMessageId,
          to: [recipient],
        },
      };

    case 'twilio':
    case 'twilio-whatsapp':
      return {
        MessageSid: providerMessageId,
        MessageStatus: event === 'opened' || event === 'read' ? 'read' : event,
        To: recipient,
        AccountSid: 'AC_mock_account',
      };

    case 'cequens':
    case 'cequens-whatsapp':
      return {
        messageId: providerMessageId,
        status: event.toUpperCase(),
        phone: recipient,
        timestamp: unixTs,
      };

    case 'brevo':
    case 'brevo-sms':
      return {
        'message-id': providerMessageId,
        event: event === 'opened' ? 'opened' : event,
        email: recipient,
        date: timestamp.toISOString(),
      };

    case 'mailgun':
      return {
        'event-data': {
          id: providerMessageId,
          event: event === 'opened' ? 'opened' : event,
          recipient,
          timestamp: unixTs,
        },
      };

    default:
      return {
        id: providerMessageId,
        event,
        recipient,
        timestamp: timestamp.toISOString(),
      };
  }
}
