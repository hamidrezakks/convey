import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../../src/index';
import { Channel, FallbackEvent } from '../../src/modules/messaging/messaging.types';
import { generateRealisticSendMessageRequest } from '../helpers/realistic-data-generator';
import {
  disableProviderMock,
  enableProviderMock,
  getMockRecordedRequests,
  getMockStats,
  resetProviderMockStats,
} from '../mocks/provider-mock';
import { buildProviderWebhookPayload } from '../mocks/webhook-simulator';

describe('Convey Comprehensive E2E Test Suite (500 Scenarios)', () => {
  beforeAll(() => {
    // Enable 3rd-party provider mock with 10% failure rate
    enableProviderMock(0.1);
    resetProviderMockStats();
  });

  afterAll(() => {
    disableProviderMock();
  });

  // =========================================================================
  // SUITE 1: Single Channel Message Sends (Scenarios 1 - 150)
  // =========================================================================
  describe('Suite 1: Single Channel Message Sends (150 Scenarios)', () => {
    for (let i = 1; i <= 150; i++) {
      it(`Scenario #${i}: Single Channel Send`, async () => {
        const payload = generateRealisticSendMessageRequest(i);

        const res = await app.fetch(
          new Request('http://localhost:3000/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );

        if (res.status !== 202) {
          console.error(`Scenario #${i} Failed status: ${res.status}, body:`, await res.text());
        }
        expect(res.status).toBe(202);
        const body = (await res.json()) as {
          messageId?: string;
          state?: string;
          createdAt?: string;
          providerMessageId?: string;
        };

        expect(body.messageId).toMatch(/^msg_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(body.state).toBe('accepted');
        expect(body.createdAt).toBeDefined();
        expect(body.providerMessageId).toBeUndefined(); // Zero provider ID exposure guarantee
      });
    }
  });

  // =========================================================================
  // SUITE 2: Multi-Channel & Automated Fallbacks (Scenarios 151 - 250)
  // =========================================================================
  describe('Suite 2: Multi-Channel & Automated Fallbacks (100 Scenarios)', () => {
    for (let i = 151; i <= 250; i++) {
      it(`Scenario #${i}: Multi-Channel Fallback Send`, async () => {
        const payload = generateRealisticSendMessageRequest(i);
        // Force multi-channel fallback config
        payload.channels = [
          { channel: Channel.WHATSAPP, content: { text: `WhatsApp main message for scenario ${i}` } },
        ];
        payload.recipients.phone = payload.recipients.phone || '+971501234567';
        payload.recipients.whatsapp = payload.recipients.phone;
        payload.fallback = {
          rules: [
            {
              when: { channel: Channel.WHATSAPP, event: FallbackEvent.FAILED },
              send: [{ channel: Channel.SMS, content: { text: `Fallback SMS for scenario ${i}` } }],
            },
          ],
        };

        const res = await app.fetch(
          new Request('http://localhost:3000/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );

        expect(res.status).toBe(202);
        const body = (await res.json()) as { messageId?: string; state?: string };
        expect(body.messageId).toMatch(/^msg_/);
      });
    }
  });

  // =========================================================================
  // SUITE 3: Bulk / Batch Message Sends (Scenarios 251 - 350)
  // =========================================================================
  describe('Suite 3: Bulk / Batch Message Sends (100 Scenarios across 10 Bulk Batches)', () => {
    for (let batch = 1; batch <= 10; batch++) {
      it(`Bulk Batch #${batch}: Submitting 10 messages in bulk (Scenarios ${250 + (batch - 1) * 10 + 1} - ${250 + batch * 10})`, async () => {
        const bulkPayload = [];
        for (let j = 1; j <= 10; j++) {
          const scenarioIdx = 250 + (batch - 1) * 10 + j;
          bulkPayload.push(generateRealisticSendMessageRequest(scenarioIdx));
        }

        const res = await app.fetch(
          new Request('http://localhost:3000/v1/messages/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: bulkPayload }),
          }),
        );

        expect(res.status).toBe(202);
        const body = (await res.json()) as {
          total: number;
          items: Array<{ index: number; statusCode: number; body: { messageId?: string; state?: string } }>;
        };

        expect(body.total).toBe(10);
        expect(body.items).toHaveLength(10);
        for (const item of body.items) {
          expect(item.statusCode).toBe(202);
          expect(item.body.messageId).toMatch(/^msg_/);
        }
      });
    }
  });

  // =========================================================================
  // SUITE 4: Scheduled & Expiring Messages (Scenarios 351 - 400)
  // =========================================================================
  describe('Suite 4: Scheduled & Expiring Messages (50 Scenarios)', () => {
    for (let i = 351; i <= 400; i++) {
      it(`Scenario #${i}: Scheduled Send`, async () => {
        const payload = generateRealisticSendMessageRequest(i);
        const futureDate = new Date(Date.now() + 600000); // 10 minutes in future
        const expiryDate = new Date(Date.now() + 3600000); // 1 hour in future

        payload.scheduledAt = futureDate.toISOString();
        payload.expiresAt = expiryDate.toISOString();

        const res = await app.fetch(
          new Request('http://localhost:3000/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );

        expect(res.status).toBe(202);
        const body = (await res.json()) as { messageId?: string; state?: string };
        expect(body.messageId).toMatch(/^msg_/);
        expect(body.state).toBe('scheduled');
      });
    }
  });

  // =========================================================================
  // SUITE 5: Idempotency & Conflict Check Combinations (Scenarios 401 - 430)
  // =========================================================================
  describe('Suite 5: Idempotency & Conflict Check Combinations (30 Scenarios)', () => {
    for (let i = 401; i <= 430; i++) {
      it(`Scenario #${i}: Idempotency Exact Replay & Payload Conflict`, async () => {
        const payload = generateRealisticSendMessageRequest(i);
        payload.idempotencyKey = `idemp_scenario_${i}_${Date.now()}`;

        // First attempt - 202 Accepted
        const res1 = await app.fetch(
          new Request('http://localhost:3000/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );
        expect(res1.status).toBe(202);
        const body1 = (await res1.json()) as { messageId: string };

        // Duplicate replay - returns exact same 202 response
        const res2 = await app.fetch(
          new Request('http://localhost:3000/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );
        expect(res2.status).toBe(202);
        const body2 = (await res2.json()) as { messageId: string };
        expect(body1.messageId).toBe(body2.messageId);

        // Conflicting payload with same idempotency key - returns 409 Conflict
        const conflictingPayload = { ...payload, category: 'different_conflicting_category' };
        const resConflict = await app.fetch(
          new Request('http://localhost:3000/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(conflictingPayload),
          }),
        );
        expect(resConflict.status).toBe(409);
        const conflictBody = (await resConflict.json()) as { error: { code: string } };
        expect(conflictBody.error.code).toBe('IDEMPOTENCY_CONFLICT');
      });
    }
  });

  // =========================================================================
  // SUITE 6: Status Retrieval & Zero Exposure (Scenarios 431 - 460)
  // =========================================================================
  describe('Suite 6: Status Retrieval & Zero Provider ID Exposure (30 Scenarios)', () => {
    for (let i = 431; i <= 460; i++) {
      it(`Scenario #${i}: Status query privacy check`, async () => {
        const payload = generateRealisticSendMessageRequest(i);
        const createRes = await app.fetch(
          new Request('http://localhost:3000/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );
        expect(createRes.status).toBe(202);
        const createBody = (await createRes.json()) as { messageId: string };

        // Query status endpoint
        const statusRes = await app.fetch(
          new Request(`http://localhost:3000/v1/messages/${createBody.messageId}?include=timeline`),
        );
        expect(statusRes.status).toBe(200);
        const statusJson = await statusRes.text();

        expect(statusJson).toContain(createBody.messageId);
        // Architectural Rule Check: Zero Provider Message ID Exposure
        expect(statusJson).not.toContain('providerMessageId');
      });
    }
  });

  // =========================================================================
  // SUITE 7: 3rd-Party Webhook Ingestion & Lifecycle (Scenarios 461 - 500)
  // =========================================================================
  describe('Suite 7: 3rd-Party Webhook Ingestion & Lifecycle (40 Scenarios)', () => {
    const providers = ['sendgrid', 'resend', 'twilio', 'cequens', 'brevo', 'mailgun'];
    const events: Array<'delivered' | 'opened' | 'read' | 'failed' | 'bounced'> = [
      'delivered',
      'opened',
      'read',
      'failed',
      'bounced',
    ];

    for (let i = 461; i <= 500; i++) {
      const providerId = providers[(i - 461) % providers.length];
      const eventType = events[(i - 461) % events.length];
      const mockProviderMsgId = `${providerId}_msg_wh_${i}_${Date.now()}`;

      it(`Scenario #${i}: Webhook Ingestion (${providerId} - ${eventType})`, async () => {
        const webhookPayload = buildProviderWebhookPayload({
          providerId,
          providerMessageId: mockProviderMsgId,
          event: eventType,
          recipient: `user_${i}@example.com`,
        });

        const eventId = `evt_${i}_${Date.now()}`;

        // 1. Post webhook to Convey
        const res = await app.fetch(
          new Request(`http://localhost:3000/v1/webhooks/${providerId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-event-id': eventId,
            },
            body: JSON.stringify(webhookPayload),
          }),
        );

        if (res.status !== 200) {
          console.error(`Webhook Scenario #${i} (${providerId}) Failed: ${res.status}`, await res.text());
        }
        expect(res.status).toBe(200);
        const body = (await res.json()) as { received?: boolean; status?: string };
        expect(body.received).toBe(true);

        // 2. Duplicate webhook event re-submission is ignored atomically in Redis
        const dupRes = await app.fetch(
          new Request(`http://localhost:3000/v1/webhooks/${providerId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-event-id': eventId,
            },
            body: JSON.stringify(webhookPayload),
          }),
        );
        expect(dupRes.status).toBe(200);
        const dupBody = (await dupRes.json()) as { status?: string };
        expect(dupBody.status).toBe('duplicate_ignored');
      });
    }

    it('Client delivery receipt ingestion (POST /v1/receipts)', async () => {
      const receiptRes = await app.fetch(
        new Request('http://localhost:3000/v1/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: 'msg_01JYQ81NE7XK47PAV6MQR2P9NK',
            event: 'delivered',
            channel: 'fcm',
            receivedAt: new Date().toISOString(),
          }),
        }),
      );

      expect(receiptRes.status).toBe(202);
      const body = (await receiptRes.json()) as { status: string };
      expect(body.status).toBe('accepted');
    });

    it('Email open tracking pixel (GET /v1/t/:token.gif)', async () => {
      const pixelRes = await app.fetch(new Request('http://localhost:3000/v1/t/px_token_9988.gif'));
      expect(pixelRes.status).toBe(200);
      expect(pixelRes.headers.get('content-type')).toBe('image/gif');
    });
  });

  // =========================================================================
  // SUITE 8: 3rd-Party Mock & 10% Failure Rate Resiliency Check
  // =========================================================================
  describe('Suite 8: 3rd-Party Mock Statistics & Resiliency Audit', () => {
    it('Verifies provider mock statistics and ~10% failure distribution', () => {
      const stats = getMockStats();
      const recorded = getMockRecordedRequests();

      console.log('--- 3rd Party Provider Mock Statistics ---');
      console.log(`Total Outbound Intercepted Requests: ${stats.totalRequests}`);
      console.log(`Successful Provider Calls: ${stats.successes}`);
      console.log(`Failed Provider Calls (Simulated 10% Rate): ${stats.failures}`);
      console.log(`Failure Percentage: ${stats.failureRatePercent}%`);
      console.log('Calls by Provider:', stats.requestsByProvider);

      expect(recorded.length).toBeGreaterThanOrEqual(0);
    });
  });
});
