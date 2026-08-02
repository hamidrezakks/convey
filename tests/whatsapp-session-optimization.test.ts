import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { CequensWhatsappChatAdapter } from '../src/modules/providers/chat/cequens-whatsapp/cequens-whatsapp.adapter';
import { TwilioWhatsappChatAdapter } from '../src/modules/providers/chat/twilio-whatsapp/twilio-whatsapp.adapter';
import { WhatsappBusinessChatAdapter } from '../src/modules/providers/chat/whatsapp-business/whatsapp-business.adapter';
import { applyWhatsAppSessionOptimization } from '../src/modules/providers/whatsapp/session-interceptor';
import { WhatsAppSessionTracker } from '../src/modules/providers/whatsapp/session-tracker';
import { WhatsAppTemplateEngine } from '../src/modules/providers/whatsapp/template-engine';

describe('WhatsApp 24-Hour Session Window & Cost Optimization Subsystem', () => {
  const testProviderId = 'whatsapp-business';
  const testPhone = '+15559876543';

  beforeAll(async () => {
    await WhatsAppSessionTracker.clearSession(testProviderId, testPhone);
  });

  afterAll(async () => {
    await WhatsAppSessionTracker.clearSession(testProviderId, testPhone);
  });

  describe('WhatsAppSessionTracker', () => {
    it('should track active session window in Redis when inbound message is recorded', async () => {
      let active = await WhatsAppSessionTracker.hasActiveSession(testProviderId, testPhone);
      expect(active).toBe(false);

      await WhatsAppSessionTracker.recordInboundMessage(testProviderId, testPhone);

      active = await WhatsAppSessionTracker.hasActiveSession(testProviderId, testPhone);
      expect(active).toBe(true);

      await WhatsAppSessionTracker.clearSession(testProviderId, testPhone);
      active = await WhatsAppSessionTracker.hasActiveSession(testProviderId, testPhone);
      expect(active).toBe(false);
    });

    it('should retrieve detailed session window info and metadata', async () => {
      await WhatsAppSessionTracker.recordInboundMessage(testProviderId, testPhone);

      const info = await WhatsAppSessionTracker.getSessionDetails(testProviderId, testPhone);
      expect(info.active).toBe(true);
      expect(info.remainingSeconds).toBeGreaterThan(0);
      expect(info.metadata?.inboundCount).toBe(1);

      await WhatsAppSessionTracker.recordInboundMessage(testProviderId, testPhone);
      const info2 = await WhatsAppSessionTracker.getSessionDetails(testProviderId, testPhone);
      expect(info2.metadata?.inboundCount).toBe(2);

      await WhatsAppSessionTracker.clearSession(testProviderId, testPhone);
    });

    it('should check active session windows in batch using Redis pipeline', async () => {
      const phone1 = '+15551111111';
      const phone2 = '+15552222222';
      const phone3 = '+15553333333';

      await WhatsAppSessionTracker.recordInboundMessage(testProviderId, phone1);
      await WhatsAppSessionTracker.recordInboundMessage(testProviderId, phone3);

      const batchResult = await WhatsAppSessionTracker.hasActiveSessionsBatch(testProviderId, [phone1, phone2, phone3]);
      expect(batchResult.get(phone1)).toBe(true);
      expect(batchResult.get(phone2)).toBe(false);
      expect(batchResult.get(phone3)).toBe(true);

      await WhatsAppSessionTracker.clearSession(testProviderId, phone1);
      await WhatsAppSessionTracker.clearSession(testProviderId, phone3);
    });
  });

  describe('WhatsAppTemplateEngine', () => {
    it('should correctly interpolate positional and named template placeholders', () => {
      const positionalTemplate = 'Hello {{1}}, your order {{2}} is confirmed!';
      const renderedPositional = WhatsAppTemplateEngine.render(positionalTemplate, {
        '1': 'Alice',
        '2': 'ORD-999',
      });
      expect(renderedPositional).toBe('Hello Alice, your order ORD-999 is confirmed!');

      const namedTemplate = 'Hi {{name}}, your ticket {{ticketId}} status is {{status}}.';
      const renderedNamed = WhatsAppTemplateEngine.render(namedTemplate, {
        name: 'Bob',
        ticketId: 'TCK-42',
        status: 'RESOLVED',
      });
      expect(renderedNamed).toBe('Hi Bob, your ticket TCK-42 status is RESOLVED.');
    });

    it('should pre-compile AST tokens and support dot-path nested variables and default fallbacks', () => {
      const ast = WhatsAppTemplateEngine.compileTemplateToAST('Hello {{user.name | Guest}}, welcome to {{app.name}}!');
      expect(ast).toHaveLength(5);

      const rendered = WhatsAppTemplateEngine.render('Hello {{user.name | Guest}}, welcome to {{app.name}}!', {
        user: { name: 'Charlie' },
        app: { name: 'Convey' },
      });
      expect(rendered).toBe('Hello Charlie, welcome to Convey!');

      const renderedFallback = WhatsAppTemplateEngine.render('Hello {{user.name | Guest}}, welcome to {{app.name}}!', {
        app: { name: 'Convey' },
      });
      expect(renderedFallback).toBe('Hello Guest, welcome to Convey!');
    });

    it('should cache and retrieve template body text in Redis', async () => {
      const templateId = 'order_update_v1';
      const bodyText = 'Your order {{1}} has shipped via {{2}}.';

      await WhatsAppTemplateEngine.cacheTemplateBody(testProviderId, templateId, bodyText);

      const cached = await WhatsAppTemplateEngine.getTemplateBody(testProviderId, templateId);
      expect(cached).toBe(bodyText);
    });
  });

  describe('applyWhatsAppSessionOptimization Interceptor', () => {
    it('should NOT optimize if sessionOptimization is disabled in provider config', async () => {
      await WhatsAppSessionTracker.recordInboundMessage(testProviderId, testPhone);

      const options = {
        recipient: { phone: testPhone },
        content: { templateId: 'order_update', variables: { '1': 'ORD-123' } },
      };

      const result = await applyWhatsAppSessionOptimization(testProviderId, options, {
        sessionOptimization: { enabled: false },
      });

      expect(result.optimized).toBe(false);
      expect(result.options.content.templateId).toBe('order_update');
    });

    it('should NOT optimize if no active 24h session window exists for recipient', async () => {
      await WhatsAppSessionTracker.clearSession(testProviderId, testPhone);

      const options = {
        recipient: { phone: testPhone },
        content: { templateId: 'order_update', variables: { '1': 'ORD-123' } },
      };

      const result = await applyWhatsAppSessionOptimization(testProviderId, options, {
        sessionOptimization: { enabled: true },
      });

      expect(result.optimized).toBe(false);
      expect(result.options.content.templateId).toBe('order_update');
    });

    it('should optimize template message into plain text when 24h window is active', async () => {
      await WhatsAppSessionTracker.recordInboundMessage(testProviderId, testPhone);
      await WhatsAppTemplateEngine.cacheTemplateBody(testProviderId, 'order_update', 'Order {{1}} is confirmed!');

      const options = {
        recipient: { phone: testPhone },
        content: { templateId: 'order_update', variables: { '1': 'ORD-555' } },
      };

      const result = await applyWhatsAppSessionOptimization(testProviderId, options, {
        sessionOptimization: { enabled: true },
      });

      expect(result.optimized).toBe(true);
      expect(result.options.content.templateId).toBeUndefined();
      expect(result.options.content.text).toBe('Order ORD-555 is confirmed!');
      expect(result.options.content.body).toBe('Order ORD-555 is confirmed!');
      expect(result.options.metadata?._sessionOptimizationApplied).toBe(true);
    });
  });

  describe('Provider Inbound Webhook Parsing', () => {
    it('should detect Meta WhatsApp Cloud API inbound user messages', () => {
      const adapter = new WhatsappBusinessChatAdapter();
      const metaPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WBA_123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  messages: [
                    {
                      from: '15551234567',
                      id: 'wamid.HBgL123',
                      timestamp: '1690000000',
                      text: { body: 'I need help with my order' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const events = adapter.parseWebhook(metaPayload);
      expect(events).toHaveLength(1);
      expect(events[0].providerMessageId).toBe('wamid.HBgL123');

      const raw = events[0].rawPayload as Record<string, unknown>;
      expect(raw.isInboundUserMessage).toBe(true);
      expect(raw.senderPhone).toBe('15551234567');
    });

    it('should detect Twilio WhatsApp inbound user messages', () => {
      const adapter = new TwilioWhatsappChatAdapter();
      const twilioPayload = {
        MessageSid: 'SM1234567890',
        From: 'whatsapp:+15559876543',
        To: 'whatsapp:+15550000000',
        Body: 'Where is my package?',
        SmsStatus: 'received',
      };

      const events = adapter.parseWebhook(twilioPayload);
      expect(events).toHaveLength(1);
      expect(events[0].providerMessageId).toBe('SM1234567890');

      const raw = events[0].rawPayload as Record<string, unknown>;
      expect(raw.isInboundUserMessage).toBe(true);
      expect(raw.senderPhone).toBe('whatsapp:+15559876543');
    });

    it('should detect Cequens WhatsApp inbound user messages', () => {
      const adapter = new CequensWhatsappChatAdapter();
      const cequensPayload = {
        messageId: 'CEQ_IN_999',
        direction: 'inbound',
        senderPhone: '+15559876543',
        status: 'DELIVERED',
      };

      const events = adapter.parseWebhook(cequensPayload);
      expect(events).toHaveLength(1);
      expect(events[0].providerMessageId).toBe('CEQ_IN_999');

      const raw = events[0].rawPayload as Record<string, unknown>;
      expect(raw.isInboundUserMessage).toBe(true);
      expect(raw.senderPhone).toBe('+15559876543');
    });
  });
});
