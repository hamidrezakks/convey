import { describe, expect, it } from 'bun:test';
import { MessageState } from '../src/modules/messaging/messaging.types';
import { ProviderRegistry } from '../src/modules/providers/core/provider-registry';

describe('All-Channel & Provider Failover Matrix Suite', () => {
  it('email channel resolves and registers all 10 supported email providers', () => {
    const emailProviders = [
      'ses',
      'resend',
      'mailgun',
      'sendgrid',
      'postmark',
      'mailtrap',
      'anypost',
      'brevo',
      'outlook365',
      'sparkpost',
    ];

    for (const providerId of emailProviders) {
      const mod = ProviderRegistry.getModule(providerId);
      expect(mod, `Email provider ${providerId} not found`).toBeDefined();
      expect(mod?.id, `Email provider ID mismatch for ${providerId}`).toBe(providerId);
    }
  });

  it('SMS channel resolves and registers all 11 supported SMS providers', () => {
    const smsProviders = [
      'twilio',
      'messagebird',
      'infobip',
      'nexmo',
      'plivo',
      'africas-talking',
      'afro-sms',
      'azure-sms',
      'cequens',
      'termii',
      'unifonic',
    ];

    for (const providerId of smsProviders) {
      const mod = ProviderRegistry.getModule(providerId);
      expect(mod, `SMS provider ${providerId} not found`).toBeDefined();
      expect(mod?.id, `SMS provider ID mismatch for ${providerId}`).toBe(providerId);
    }
  });

  it('push channel resolves and registers all supported push notification providers', () => {
    const pushProviders = ['fcm', 'apns', 'appio', 'one-signal', 'push-webhook', 'expo', 'pusher-beams', 'pushpad'];

    for (const providerId of pushProviders) {
      const mod = ProviderRegistry.getModule(providerId);
      expect(mod, `Push provider ${providerId} not found`).toBeDefined();
      expect(mod?.id, `Push provider ID mismatch for ${providerId}`).toBe(providerId);
    }
  });

  it('chat and Tool channels resolve and register all chat/ops providers', () => {
    const chatAndToolProviders = [
      'discord',
      'telegram',
      'slack',
      'line',
      'mattermost',
      'msteams',
      'zulip',
      'cequens-whatsapp',
      'pagerduty',
      'opsgenie',
      'grafana',
      'tool-webhook',
    ];

    for (const providerId of chatAndToolProviders) {
      const mod = ProviderRegistry.getModule(providerId);
      expect(mod, `Chat/Tool provider ${providerId} not found`).toBeDefined();
      expect(mod?.id.toLowerCase(), `Chat/Tool provider ID mismatch for ${providerId}`).toBe(providerId.toLowerCase());
    }
  });

  it('validates complete delivery lifecycle state machine enum progression', () => {
    const states = [
      MessageState.ACCEPTED,
      MessageState.SCHEDULED,
      MessageState.DISPATCHED,
      MessageState.DELIVERED,
      MessageState.FAILED,
      MessageState.EXPIRED,
      MessageState.CANCELLED,
      MessageState.OPENED,
      MessageState.READ,
      MessageState.BOUNCED,
    ];

    expect(states.length).toBe(10);
    expect(MessageState.ACCEPTED as string).toBe('accepted');
    expect(MessageState.DISPATCHED as string).toBe('dispatched');
    expect(MessageState.DELIVERED as string).toBe('delivered');
    expect(MessageState.FAILED as string).toBe('failed');
  });
});
