import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { CequensWhatsappChatAdapter } from '../src/modules/providers/chat/cequens-whatsapp/cequens-whatsapp.adapter';
import { TwilioWhatsappChatAdapter } from '../src/modules/providers/chat/twilio-whatsapp/twilio-whatsapp.adapter';
import { WhatsappBusinessChatAdapter } from '../src/modules/providers/chat/whatsapp-business/whatsapp-business.adapter';
import { NormalizedStatus } from '../src/modules/providers/core/provider-types';
import { applyWhatsAppSessionOptimization } from '../src/modules/providers/whatsapp/session-interceptor';
import { WhatsAppSessionTracker } from '../src/modules/providers/whatsapp/session-tracker';
import { WhatsAppTemplateEngine } from '../src/modules/providers/whatsapp/template-engine';
import { webhooksController } from '../src/modules/webhooks/webhooks.controller';

describe('WhatsApp Dual-Webhook Architecture & 24-Hour Cost Optimization Flows', () => {
  const app = new Elysia().use(webhooksController);
  const testPhone = '+15550998877';
  const testProviderId = 'whatsapp-business';
  const verifyToken = 'convey_wh_test_secret_789';

  beforeAll(async () => {
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN = verifyToken;
    await WhatsAppSessionTracker.clearSession(testProviderId, testPhone);
    await WhatsAppSessionTracker.clearSession('twilio-whatsapp', testPhone);
    await WhatsAppSessionTracker.clearSession('cequens-whatsapp', testPhone);
  });

  afterAll(async () => {
    await WhatsAppSessionTracker.clearSession(testProviderId, testPhone);
    await WhatsAppSessionTracker.clearSession('twilio-whatsapp', testPhone);
    await WhatsAppSessionTracker.clearSession('cequens-whatsapp', testPhone);
  });

  describe('1. Meta Webhook Handshake Verification (GET)', () => {
    it('should verify challenge on GET /v1/webhooks/whatsapp-business with valid token', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/v1/webhooks/whatsapp-business?hub.mode=subscribe&hub.challenge=99887766&hub.verify_token=${verifyToken}`,
          { method: 'GET' },
        ),
      );

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('99887766');
    });

    it('should verify challenge on GET /v1/webhooks/whatsapp/status and /v1/webhooks/whatsapp/incoming', async () => {
      const statusRes = await app.handle(
        new Request(
          `http://localhost/v1/webhooks/whatsapp/status?hub.mode=subscribe&hub.challenge=status_challenge_123&hub.verify_token=${verifyToken}`,
          { method: 'GET' },
        ),
      );
      expect(statusRes.status).toBe(200);
      expect(await statusRes.text()).toBe('status_challenge_123');

      const incomingRes = await app.handle(
        new Request(
          `http://localhost/v1/webhooks/whatsapp/incoming?hub.mode=subscribe&hub.challenge=incoming_challenge_456&hub.verify_token=${verifyToken}`,
          { method: 'GET' },
        ),
      );
      expect(incomingRes.status).toBe(200);
      expect(await incomingRes.text()).toBe('incoming_challenge_456');

      const inboundAliasRes = await app.handle(
        new Request(
          `http://localhost/v1/webhooks/whatsapp/inbound?hub.mode=subscribe&hub.challenge=inbound_challenge_789&hub.verify_token=${verifyToken}`,
          { method: 'GET' },
        ),
      );
      expect(inboundAliasRes.status).toBe(200);
      expect(await inboundAliasRes.text()).toBe('inbound_challenge_789');
    });

    it('should reject handshake with 403 when verify_token is invalid', async () => {
      const response = await app.handle(
        new Request(
          'http://localhost/v1/webhooks/whatsapp-business?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=wrong_token',
          { method: 'GET' },
        ),
      );

      expect(response.status).toBe(403);
    });

    it('should reject handshake when hub.mode is not subscribe', async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/v1/webhooks/whatsapp-business?hub.mode=unsubscribe&hub.challenge=12345&hub.verify_token=${verifyToken}`,
          { method: 'GET' },
        ),
      );

      expect(response.status).toBe(403);
    });
  });

  describe('2. Dedicated Webhook HTTP Routes & Flow Ingestion (POST)', () => {
    it('should accept Status Update Webhook at /v1/webhooks/whatsapp/status', async () => {
      const metaStatusPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WBA_123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [
                    {
                      id: 'wamid.HBgLMTU1NTA5OTg4Nzc=',
                      status: 'delivered',
                      timestamp: '1690000100',
                      recipient_id: '15550998877',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const response = await app.handle(
        new Request('http://localhost/v1/webhooks/whatsapp/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-event-id': `status-route-${Date.now()}` },
          body: JSON.stringify(metaStatusPayload),
        }),
      );

      expect(response.status).toBe(200);
      const resJson = (await response.json()) as { status: string };
      expect(resJson.status).toBe('accepted');
    });

    it('should accept Incoming Message Webhook at /v1/webhooks/whatsapp/incoming and /inbound', async () => {
      const metaInboundPayload = {
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
                      from: '15550998877',
                      id: 'wamid.INBOUND_MSG_1',
                      timestamp: '1690000000',
                      text: { body: 'Hello' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res1 = await app.handle(
        new Request('http://localhost/v1/webhooks/whatsapp/incoming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-event-id': `incoming-route-${Date.now()}-1` },
          body: JSON.stringify(metaInboundPayload),
        }),
      );
      expect(res1.status).toBe(200);

      const res2 = await app.handle(
        new Request('http://localhost/v1/webhooks/whatsapp/inbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-event-id': `inbound-route-${Date.now()}-2` },
          body: JSON.stringify(metaInboundPayload),
        }),
      );
      expect(res2.status).toBe(200);
    });

    it('should accept Twilio WhatsApp status & incoming webhooks', async () => {
      const statusRes = await app.handle(
        new Request('http://localhost/v1/webhooks/twilio-whatsapp/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-event-id': `twilio-status-${Date.now()}` },
          body: JSON.stringify({ MessageSid: 'SM123', MessageStatus: 'delivered' }),
        }),
      );
      expect(statusRes.status).toBe(200);

      const incomingRes = await app.handle(
        new Request('http://localhost/v1/webhooks/twilio-whatsapp/incoming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-event-id': `twilio-incoming-${Date.now()}` },
          body: JSON.stringify({
            MessageSid: 'SM456',
            From: 'whatsapp:+15550998877',
            Body: 'Order inquiry',
            SmsStatus: 'received',
          }),
        }),
      );
      expect(incomingRes.status).toBe(200);
    });
  });

  describe('3. WhatsApp Inbound Messages & 24-Hour Cost Optimization Window', () => {
    it('should activate 24-hour window when Meta incoming message is recorded', async () => {
      const sessionPhone = '+15551112233';
      await WhatsAppSessionTracker.clearSession(testProviderId, sessionPhone);
      expect(await WhatsAppSessionTracker.hasActiveSession(testProviderId, sessionPhone)).toBe(false);

      // 1. Ingest inbound message
      await WhatsAppSessionTracker.recordInboundMessage(testProviderId, sessionPhone);

      // 2. Verify 24-hour window is active in Redis and L1 cache
      const isActive = await WhatsAppSessionTracker.hasActiveSession(testProviderId, sessionPhone);
      expect(isActive).toBe(true);

      const details = await WhatsAppSessionTracker.getSessionDetails(testProviderId, sessionPhone);
      expect(details.active).toBe(true);
      expect(details.remainingSeconds).toBeGreaterThan(80_000);
      expect(details.metadata?.inboundCount).toBe(1);

      // 3. Outbound template message is dynamically transformed to plain text ($0.00 Meta fee)
      await WhatsAppTemplateEngine.cacheTemplateBody(
        testProviderId,
        'shipping_alert_v1',
        'Hi {{name}}, your package #{{tracking}} is arriving today!',
      );

      const outboundOptions = {
        recipient: { phone: sessionPhone },
        content: {
          templateId: 'shipping_alert_v1',
          variables: { name: 'Sarah', tracking: 'TRK-9901' },
        },
      };

      const optResult = await applyWhatsAppSessionOptimization(testProviderId, outboundOptions, {
        sessionOptimization: { enabled: true, estimatedCostSavedUsd: 0.015 },
      });

      expect(optResult.optimized).toBe(true);
      expect(optResult.options.content.templateId).toBeUndefined();
      expect(optResult.options.content.text).toBe('Hi Sarah, your package #TRK-9901 is arriving today!');
      expect(optResult.options.content.body).toBe('Hi Sarah, your package #TRK-9901 is arriving today!');
      expect(optResult.options.metadata?._sessionOptimizationApplied).toBe(true);
      expect(optResult.savedUsd).toBe(0.015);

      await WhatsAppSessionTracker.clearSession(testProviderId, sessionPhone);
    });

    it('should not optimize if 24-hour window is not active or has expired', async () => {
      const expiredPhone = '+15554445566';
      await WhatsAppSessionTracker.clearSession(testProviderId, expiredPhone);

      const outboundOptions = {
        recipient: { phone: expiredPhone },
        content: {
          templateId: 'shipping_alert_v1',
          variables: { name: 'Sarah', tracking: 'TRK-9901' },
        },
      };

      const optResult = await applyWhatsAppSessionOptimization(testProviderId, outboundOptions, {
        sessionOptimization: { enabled: true },
      });

      expect(optResult.optimized).toBe(false);
      expect(optResult.options.content.templateId).toBe('shipping_alert_v1');
    });
  });

  describe('4. Provider Adapter Webhook Parsing (Statuses & Inbound)', () => {
    it('should parse Meta status updates and rich inbound text/interactive messages', () => {
      const adapter = new WhatsappBusinessChatAdapter();

      // Test Status Update
      const statusPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WBA_123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [
                    {
                      id: 'wamid.STATUS_001',
                      status: 'delivered',
                      timestamp: '1690000010',
                    },
                    {
                      id: 'wamid.STATUS_002',
                      status: 'read',
                      timestamp: '1690000020',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const statusEvents = adapter.parseWebhook(statusPayload);
      expect(statusEvents).toHaveLength(2);
      expect(statusEvents[0].providerMessageId).toBe('wamid.STATUS_001');
      expect(statusEvents[0].normalizedStatus).toBe(NormalizedStatus.DELIVERED);
      expect(statusEvents[1].providerMessageId).toBe('wamid.STATUS_002');
      expect(statusEvents[1].normalizedStatus).toBe(NormalizedStatus.READ);

      // Test Inbound Interactive / Button Reply
      const interactiveInboundPayload = {
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
                      from: '15550998877',
                      id: 'wamid.INBOUND_BUTTON_01',
                      timestamp: '1690000030',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'btn_confirm_yes',
                          title: 'Yes, Confirm Booking',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const inboundEvents = adapter.parseWebhook(interactiveInboundPayload);
      expect(inboundEvents).toHaveLength(1);
      expect(inboundEvents[0].providerMessageId).toBe('wamid.INBOUND_BUTTON_01');

      const raw = inboundEvents[0].rawPayload as Record<string, unknown>;
      expect(raw.isInboundUserMessage).toBe(true);
      expect(raw.senderPhone).toBe('15550998877');
      expect(raw.body).toBe('Yes, Confirm Booking');
      expect(raw.text).toBe('Yes, Confirm Booking');
    });

    it('should parse Twilio WhatsApp status updates and inbound messages', () => {
      const adapter = new TwilioWhatsappChatAdapter();

      const twilioStatus = adapter.parseWebhook({
        MessageSid: 'SM_STATUS_123',
        MessageStatus: 'delivered',
        To: 'whatsapp:+15550998877',
      });
      expect(twilioStatus).toHaveLength(1);
      expect(twilioStatus[0].providerMessageId).toBe('SM_STATUS_123');
      expect(twilioStatus[0].normalizedStatus).toBe(NormalizedStatus.DELIVERED);

      const twilioInbound = adapter.parseWebhook({
        MessageSid: 'SM_INBOUND_456',
        From: 'whatsapp:+15550998877',
        Body: 'Where is my delivery driver?',
        SmsStatus: 'received',
      });
      expect(twilioInbound).toHaveLength(1);
      const rawInbound = twilioInbound[0].rawPayload as Record<string, unknown>;
      expect(rawInbound.isInboundUserMessage).toBe(true);
      expect(rawInbound.senderPhone).toBe('whatsapp:+15550998877');
      expect(rawInbound.body).toBe('Where is my delivery driver?');
    });

    it('should parse Cequens WhatsApp status updates and inbound messages', () => {
      const adapter = new CequensWhatsappChatAdapter();

      const cequensStatus = adapter.parseWebhook({
        messageId: 'CEQ_STATUS_111',
        status: 'READ',
      });
      expect(cequensStatus).toHaveLength(1);
      expect(cequensStatus[0].providerMessageId).toBe('CEQ_STATUS_111');
      expect(cequensStatus[0].normalizedStatus).toBe(NormalizedStatus.READ);

      const cequensInbound = adapter.parseWebhook({
        messageId: 'CEQ_INBOUND_222',
        direction: 'inbound',
        senderPhone: '+15550998877',
        text: 'Confirming attendance',
      });
      expect(cequensInbound).toHaveLength(1);
      const rawInbound = cequensInbound[0].rawPayload as Record<string, unknown>;
      expect(rawInbound.isInboundUserMessage).toBe(true);
      expect(rawInbound.senderPhone).toBe('+15550998877');
      expect(rawInbound.body).toBe('Confirming attendance');
    });
  });
});
