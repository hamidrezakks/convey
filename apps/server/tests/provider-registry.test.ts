import { describe, expect, it } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { ProviderRegistry } from '../src/modules/providers/core/provider-registry';
import { SendgridEmailAdapter } from '../src/modules/providers/email/sendgrid/sendgrid.adapter';
import type { SendgridEmailAdapterConfig } from '../src/modules/providers/email/sendgrid/types';
import { TwilioSmsAdapter } from '../src/modules/providers/sms/twilio/twilio.adapter';
import type { TwilioSmsAdapterConfig } from '../src/modules/providers/sms/twilio/types';

describe('Provider Registry & Lazy Modern Architecture', () => {
  it('should instantiate SendgridEmailAdapter with typed config', () => {
    const config: SendgridEmailAdapterConfig = {
      apiKey: 'test_sg_key',
      from: 'test@example.com',
      senderName: 'Test Sender',
      ipPoolName: 'main-pool',
      region: 'eu',
    };
    const adapter = new SendgridEmailAdapter(config);
    expect(adapter.id).toBe('sendgrid');
    expect(adapter.name).toBe('Sendgrid Email');
  });

  it('should instantiate TwilioSmsAdapter with typed config', () => {
    const config: TwilioSmsAdapterConfig = {
      accountSid: 'AC123456789',
      authToken: 'auth_token_123',
      from: '+1234567890',
      region: 'us1',
    };
    const adapter = new TwilioSmsAdapter(config);
    expect(adapter.id).toBe('twilio');
    expect(adapter.name).toBe('Twilio SMS');
  });

  it('should retrieve registered providers lazily from ProviderRegistry', () => {
    const telegramAdapter = ProviderRegistry.get(Channel.CHAT, 'telegram');
    expect(telegramAdapter).toBeDefined();
    expect(telegramAdapter?.id).toBe('telegram');

    const sendgridAdapter = ProviderRegistry.get(Channel.EMAIL, 'sendgrid');
    expect(sendgridAdapter).toBeDefined();
    expect(sendgridAdapter?.id).toBe('sendgrid');
  });

  it('should validate isWorkable for providers with custom configs', () => {
    const workable = ProviderRegistry.isWorkable('discord', {
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
    });
    expect(workable).toBe(true);

    const nonWorkable = ProviderRegistry.isWorkable('non-existent-provider-id-xyz');
    expect(nonWorkable).toBe(false);
  });

  it('should only initialize workable providers via initializeProvider', async () => {
    const unworkable = await ProviderRegistry.initializeProvider('unconfigured-fake-provider-123');
    expect(unworkable).toBeUndefined();

    const initialized = await ProviderRegistry.initializeProvider('discord', {
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
    });
    expect(initialized).toBeDefined();
    expect(initialized?.id).toBe('discord');
    expect(ProviderRegistry.getActiveProviders()).toContain('discord');
  });
});
