import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { bootstrapService } from '../../src/bootstrap';
import { app } from '../../src/index';
import { redisClient } from '../../src/queues/connection';
import { closeAllProviderQueues } from '../../src/queues/provider-queues';
import { messageDispatchWorker } from '../../src/queues/workers/message-dispatch.worker';
import { SEEDED_API_KEY_RAW, seedDatabaseWithRealisticData } from '../helpers/db-seeder';
import { disableProviderMock, enableProviderMock } from '../mocks/provider-mock';

describe('Convey Complete Real API Endpoints E2E Test Suite', () => {
  beforeAll(async () => {
    enableProviderMock(0.0);
    await bootstrapService();
    await redisClient.flushall();
    await seedDatabaseWithRealisticData();
  });

  afterAll(async () => {
    disableProviderMock();
    await closeAllProviderQueues();
    try {
      await messageDispatchWorker.close();
    } catch {
      // Worker close safeguard
    }
  });

  // =========================================================================
  // 1. Health, Readiness, Liveness, Metrics & Swagger
  // =========================================================================
  describe('1. Health & Observability Endpoints', () => {
    it('GET /health returns service health details and subsystem statuses', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      expect([200, 503]).toContain(res.status);

      const body = (await res.json()) as {
        status: string;
        ready: boolean;
        uptime: number;
        db: string;
        redis: string;
        partitions: unknown;
        circuitBreakers: unknown;
        configuredProvidersCount: number;
        timestamp: string;
      };

      expect(body.db).toBe('connected');
      expect(body.redis).toBe('connected');
      expect(typeof body.uptime).toBe('number');
      expect(body.timestamp).toBeDefined();
      expect(body.circuitBreakers).toBeDefined();
    });

    it('GET /health/readiness returns detailed readiness probe inspection', async () => {
      const res = await app.fetch(new Request('http://localhost/health/readiness'));
      expect([200, 503]).toContain(res.status);

      const body = (await res.json()) as {
        ready: boolean;
        uptime: number;
        checks: { db: string; redis: string; partitions: unknown };
        circuitBreakers: { counts: unknown; statuses: unknown };
        providers: { configuredCount: number; byChannel: unknown };
        timestamp: string;
      };

      expect(body.checks.db).toBe('connected');
      expect(body.checks.redis).toBe('connected');
      expect(body.circuitBreakers).toBeDefined();
      expect(body.providers).toBeDefined();
    });

    it('GET /health/liveness returns liveness status alive', async () => {
      const res = await app.fetch(new Request('http://localhost/health/liveness'));
      expect(res.status).toBe(200);

      const body = (await res.json()) as { status: string; uptime: number; timestamp: string };
      expect(body.status).toBe('alive');
      expect(typeof body.uptime).toBe('number');
      expect(body.timestamp).toBeDefined();
    });

    it('GET /metrics returns Prometheus formatted metric exposition', async () => {
      const res = await app.fetch(new Request('http://localhost/metrics'));
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('convey_http_requests_total');
      expect(text).toContain('convey_http_request_duration_seconds');
      expect(text).toContain('convey_messages_accepted_total');
    });

    it('GET /swagger returns OpenAPI interactive documentation UI', async () => {
      const res = await app.fetch(new Request('http://localhost/swagger'));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text.toLowerCase()).toContain('html');
    });
  });

  // =========================================================================
  // 2. Authentication, API Keys & W3C Trace Context
  // =========================================================================
  describe('2. Authentication, Headers & Trace Context Propagation', () => {
    it('Accepts requests authenticated with x-api-key header', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/batches', {
          method: 'GET',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(res.status).toBe(200);
    });

    it('Accepts requests authenticated with Authorization: Bearer <key> header', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/batches', {
          method: 'GET',
          headers: { Authorization: `Bearer ${SEEDED_API_KEY_RAW}` },
        }),
      );
      expect(res.status).toBe(200);
    });

    it('Rejects invalid API keys with 401 Unauthorized', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/batches', {
          method: 'GET',
          headers: { 'x-api-key': 'cv_invalid_secret_key_99999' },
        }),
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code?: string; message?: string } };
      expect(body.error?.message || '').toMatch(/Invalid.*API Key/i);
    });

    it('Propagates incoming W3C traceparent header in response', async () => {
      const incomingTrace = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': SEEDED_API_KEY_RAW,
            traceparent: incomingTrace,
          },
          body: JSON.stringify({
            idempotencyKey: `idemp_trace_${Date.now()}`,
            userId: 'usr_trace_test',
            team: 'payments',
            category: 'otp',
            country: 'AE',
            recipients: { phone: '+971501234567' },
            channels: [{ channel: 'sms', content: { text: 'Trace test OTP' } }],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const traceHeader = res.headers.get('traceparent');
      expect(traceHeader).toBeDefined();
      expect(traceHeader).toContain('4bf92f3577b34da6a3ce929d0e0e4736');
    });
  });

  // =========================================================================
  // 3. Messages API (/v1/messages) - Single, Bulk, Channels, Lifecycle
  // =========================================================================
  describe('3. Messages API (/v1/messages)', () => {
    it('Dispatches SMS message successfully (202 Accepted)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_sms_${Date.now()}`,
            userId: 'usr_sms_01',
            team: 'payments',
            category: 'otp',
            country: 'AE',
            recipients: { phone: '+971501112233' },
            channels: [{ channel: 'sms', content: { text: 'Your verification code is 432109' } }],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string; state: string; providerMessageId?: string };
      expect(body.messageId).toMatch(/^msg_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(body.state).toBe('accepted');
      expect(body.providerMessageId).toBeUndefined(); // Zero provider ID exposure
    });

    it('Dispatches Email with Direct HTML & Text (202 Accepted)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_email_${Date.now()}`,
            userId: 'usr_email_01',
            team: 'payments',
            category: 'transactional',
            country: 'US',
            recipients: { email: 'customer@acme.com' },
            channels: [
              {
                channel: 'email',
                content: {
                  subject: 'Receipt for Order #8877',
                  html: '<h2>Thank you for your purchase!</h2><p>Amount: $49.99</p>',
                  text: 'Thank you for your purchase! Amount: $49.99',
                },
              },
            ],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string; state: string };
      expect(body.messageId).toMatch(/^msg_/);
      expect(body.state).toBe('accepted');
    });

    it('Dispatches Email with Render Template (202 Accepted)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_tmpl_${Date.now()}`,
            userId: 'usr_email_tmpl',
            team: 'orders',
            category: 'transactional',
            country: 'AE',
            recipients: { email: 'buyer@example.com' },
            channels: [
              {
                channel: 'email',
                content: {
                  subject: 'Your Order is on the Way!',
                  render: {
                    template: 'shipping_update',
                    version: 'v2',
                    locale: 'en',
                    props: { trackingNumber: 'TRK99887766', carrier: 'DHL' },
                  },
                },
              },
            ],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string };
      expect(body.messageId).toMatch(/^msg_/);
    });

    it('Dispatches WhatsApp template message (202 Accepted)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_wa_${Date.now()}`,
            userId: 'usr_wa_01',
            team: 'payments',
            category: 'transactional',
            country: 'AE',
            recipients: { whatsapp: '+971501234567' },
            channels: [
              {
                channel: 'whatsapp',
                content: {
                  template: 'delivery_notice',
                  language: 'en',
                  variables: { customerName: 'Ahmed', orderId: '10928' },
                },
              },
            ],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string };
      expect(body.messageId).toMatch(/^msg_/);
    });

    it('Dispatches Push Notification (FCM) (202 Accepted)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_fcm_${Date.now()}`,
            userId: 'usr_push_01',
            team: 'payments',
            category: 'notification',
            country: 'US',
            recipients: { fcmTokens: ['fcm_token_device_abc123xyz'] },
            channels: [
              {
                channel: 'fcm',
                content: {
                  title: 'Payment Received',
                  body: 'You received $150.00 from Jane',
                  data: { txId: 'tx_998811' },
                },
              },
            ],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string };
      expect(body.messageId).toMatch(/^msg_/);
    });

    it('Dispatches Slack Notification (202 Accepted)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_slack_${Date.now()}`,
            userId: 'usr_chat_01',
            team: 'payments',
            category: 'alerts',
            country: 'US',
            recipients: { slack: { channelId: 'C0123456789' } },
            channels: [
              {
                channel: 'slack',
                content: {
                  text: '🚨 High-volume transaction alert: $10,000 processed',
                },
              },
            ],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string };
      expect(body.messageId).toMatch(/^msg_/);
    });

    it('Dispatches Telegram Notification (202 Accepted)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_tg_${Date.now()}`,
            userId: 'usr_tg_01',
            team: 'payments',
            category: 'otp',
            country: 'AE',
            recipients: { telegramChatId: '123456789' },
            channels: [
              {
                channel: 'telegram',
                content: {
                  text: 'Your one-time authentication code is 7721.',
                },
              },
            ],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string };
      expect(body.messageId).toMatch(/^msg_/);
    });

    it('Dispatches Scheduled message (>30m in future) with status "scheduled"', async () => {
      const futureDate = new Date(Date.now() + 45 * 60 * 1000).toISOString(); // 45 min in future
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_sched_${Date.now()}`,
            userId: 'usr_sched_01',
            team: 'payments',
            category: 'marketing',
            country: 'US',
            scheduledAt: futureDate,
            recipients: { email: 'future_user@example.com' },
            channels: [{ channel: 'email', content: { subject: 'Scheduled Reminder', text: 'See you tomorrow' } }],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string; state: string };
      expect(body.messageId).toMatch(/^msg_/);
      expect(body.state).toBe('scheduled');
    });

    it('Dispatches Sandbox test mode message', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': SEEDED_API_KEY_RAW,
            'x-convey-sandbox': 'true',
          },
          body: JSON.stringify({
            idempotencyKey: `idemp_sandbox_${Date.now()}`,
            userId: 'usr_sandbox_01',
            team: 'payments',
            category: 'otp',
            country: 'AE',
            recipients: { phone: '+971500000001' },
            channels: [{ channel: 'sms', content: { text: 'Sandbox SMS Test' } }],
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string; state: string };
      expect(body.messageId).toMatch(/^msg_/);
    });

    it('Dispatches Multi-Channel message with Fallback Branching Rules', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_fallback_${Date.now()}`,
            userId: 'usr_fallback_01',
            team: 'payments',
            category: 'transactional',
            country: 'AE',
            recipients: {
              whatsapp: '+971501234567',
              phone: '+971501234567',
              email: 'fallback@acme.com',
            },
            channels: [{ channel: 'whatsapp', content: { text: 'Primary WhatsApp message' } }],
            fallback: {
              rules: [
                {
                  when: { channel: 'whatsapp', event: 'failed' },
                  send: [{ channel: 'sms', content: { text: 'Fallback SMS message' } }],
                },
                {
                  when: { channel: 'sms', event: 'failed' },
                  send: [{ channel: 'email', content: { subject: 'Fallback Email', text: 'Email fallback' } }],
                },
              ],
            },
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { messageId: string };
      expect(body.messageId).toMatch(/^msg_/);
    });

    it('Guarantees Idempotency: exact re-send returns original response', async () => {
      const idempotencyKey = `idemp_e2e_${Date.now()}`;
      const payload = {
        idempotencyKey,
        userId: 'usr_idemp_01',
        team: 'payments',
        category: 'transactional',
        country: 'AE',
        recipients: { phone: '+971507766554' },
        channels: [{ channel: 'sms', content: { text: 'Idempotency test OTP' } }],
      };

      const res1 = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify(payload),
        }),
      );
      expect(res1.status).toBe(202);
      const body1 = (await res1.json()) as { messageId: string };

      // Duplicate Re-send
      const res2 = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify(payload),
        }),
      );
      expect(res2.status).toBe(202);
      const body2 = (await res2.json()) as { messageId: string };
      expect(body1.messageId).toBe(body2.messageId);
    });

    it('Rejects conflicting payload with same idempotency key with 409 Conflict', async () => {
      const idempotencyKey = `idemp_conflict_${Date.now()}`;
      const payload1 = {
        idempotencyKey,
        userId: 'usr_idemp_conflict',
        team: 'payments',
        category: 'transactional',
        country: 'AE',
        recipients: { phone: '+971507766554' },
        channels: [{ channel: 'sms', content: { text: 'Initial payload' } }],
      };

      await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify(payload1),
        }),
      );

      // Conflicting payload
      const payload2 = {
        ...payload1,
        category: 'conflicting_category',
      };

      const resConflict = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify(payload2),
        }),
      );

      expect(resConflict.status).toBe(409);
      const conflictBody = (await resConflict.json()) as { error: { code: string } };
      expect(conflictBody.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('Rejects invalid payload without recipients with 400 Bad Request', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_inv_${Date.now()}`,
            userId: 'usr_invalid_01',
            team: 'payments',
            category: 'otp',
            country: 'AE',
            recipients: {}, // Missing phone for SMS
            channels: [{ channel: 'sms', content: { text: 'No recipient' } }],
          }),
        }),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string; details?: unknown[] } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Accepts Bulk Messages (POST /v1/messages/bulk)', async () => {
      const bulkPayload = [
        {
          idempotencyKey: `idemp_bulk_1_${Date.now()}`,
          userId: 'usr_bulk_1',
          team: 'payments',
          category: 'otp',
          country: 'AE',
          recipients: { phone: '+971501110001' },
          channels: [{ channel: 'sms', content: { text: 'Bulk SMS 1' } }],
        },
        {
          idempotencyKey: `idemp_bulk_2_${Date.now()}`,
          userId: 'usr_bulk_2',
          team: 'payments',
          category: 'otp',
          country: 'AE',
          recipients: { phone: '+971501110002' },
          channels: [{ channel: 'sms', content: { text: 'Bulk SMS 2' } }],
        },
      ];

      const res = await app.fetch(
        new Request('http://localhost/v1/messages/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({ messages: bulkPayload }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as {
        total: number;
        items: Array<{ index: number; statusCode: number; body: { messageId?: string; state?: string } }>;
      };
      expect(body.total).toBe(2);
      expect(body.items).toHaveLength(2);
      expect(body.items[0].body.messageId).toMatch(/^msg_/);
      expect(body.items[1].body.messageId).toMatch(/^msg_/);
    });

    it('Retrieves message status (GET /v1/messages/:messageId) and timeline', async () => {
      const createRes = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `idemp_status_${Date.now()}`,
            userId: 'usr_status_query',
            team: 'payments',
            category: 'otp',
            country: 'AE',
            recipients: { phone: '+971501234567' },
            channels: [{ channel: 'sms', content: { text: 'Query status check' } }],
          }),
        }),
      );

      const createBody = (await createRes.json()) as { messageId: string };
      const messageId = createBody.messageId;

      // 1. Basic Status Query
      const statusRes = await app.fetch(
        new Request(`http://localhost/v1/messages/${messageId}`, {
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(statusRes.status).toBe(200);
      const statusBody = (await statusRes.json()) as { messageId: string; state: string; channels?: unknown[] };
      expect(statusBody.messageId).toBe(messageId);
      expect(statusBody.state).toBe('accepted');
      expect(JSON.stringify(statusBody)).not.toContain('providerMessageId');

      // 2. Status Query with timeline include
      const statusTimelineRes = await app.fetch(
        new Request(`http://localhost/v1/messages/${messageId}?include=timeline`, {
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(statusTimelineRes.status).toBe(200);
      const statusTimelineBody = (await statusTimelineRes.json()) as { messageId: string; timeline?: unknown[] };
      expect(statusTimelineBody.messageId).toBe(messageId);
      expect(Array.isArray(statusTimelineBody.timeline)).toBe(true);

      // 3. Direct Timeline Query
      const timelineRes = await app.fetch(
        new Request(`http://localhost/v1/messages/${messageId}/timeline`, {
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(timelineRes.status).toBe(200);
      const timelineBody = (await timelineRes.json()) as { messageId: string; timeline: unknown[] };
      expect(timelineBody.messageId).toBe(messageId);
      expect(Array.isArray(timelineBody.timeline)).toBe(true);
    });

    it('Returns 404 for non-existent message ID', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/messages/msg_00000000-0000-7000-8000-000000000000', {
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // 4. Batches API (/v1/batches) - Lifecycle & Control
  // =========================================================================
  describe('4. Batches API (/v1/batches)', () => {
    let createdBatchId: string;

    it('Creates batch dispatch context (POST /v1/batches)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            totalCount: 500,
            metadata: { campaignName: 'Q3 Newsletter Blast', tags: ['vip', 'promo'] },
          }),
        }),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        success: boolean;
        batch: { id: string; status: string; totalCount: number };
      };
      expect(body.success).toBe(true);
      expect(body.batch.id).toMatch(/^batch_/);
      expect(body.batch.status).toBe('processing');
      expect(body.batch.totalCount).toBe(500);
      createdBatchId = body.batch.id;
    });

    it('Lists batch dispatches for authenticated team (GET /v1/batches)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/batches', {
          method: 'GET',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; batches: Array<{ id: string; totalCount: number }> };
      expect(body.success).toBe(true);
      expect(body.batches.length).toBeGreaterThan(0);
      expect(body.batches.some((b) => b.id === createdBatchId)).toBe(true);
    });

    it('Retrieves live batch metrics & ETA (GET /v1/batches/:batchId)', async () => {
      const res = await app.fetch(
        new Request(`http://localhost/v1/batches/${createdBatchId}`, {
          method: 'GET',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        batch: { id: string; status: string; totalCount: number; progressPercent: number };
      };
      expect(body.success).toBe(true);
      expect(body.batch.id).toBe(createdBatchId);
      expect(body.batch.totalCount).toBe(500);
      expect(typeof body.batch.progressPercent).toBe('number');
    });

    it('Pauses an active batch dispatch (POST /v1/batches/:batchId/pause)', async () => {
      const res = await app.fetch(
        new Request(`http://localhost/v1/batches/${createdBatchId}/pause`, {
          method: 'POST',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; batch: { status: string } };
      expect(body.success).toBe(true);
      expect(body.batch.status).toBe('paused');
    });

    it('Resumes a paused batch dispatch (POST /v1/batches/:batchId/resume)', async () => {
      const res = await app.fetch(
        new Request(`http://localhost/v1/batches/${createdBatchId}/resume`, {
          method: 'POST',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; batch: { status: string } };
      expect(body.success).toBe(true);
      expect(body.batch.status).toBe('processing');
    });

    it('Cancels a batch dispatch (POST /v1/batches/:batchId/cancel)', async () => {
      const res = await app.fetch(
        new Request(`http://localhost/v1/batches/${createdBatchId}/cancel`, {
          method: 'POST',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; batch: { status: string } };
      expect(body.success).toBe(true);
      expect(body.batch.status).toBe('cancelled');
    });

    it('Returns 404 for non-existent batch ID', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/batches/batch_non_existent_99999', {
          method: 'GET',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 5. Dead-Letter Queue (DLQ) API (/v1/dlq)
  // =========================================================================
  describe('5. Dead-Letter Queue (DLQ) API (/v1/dlq)', () => {
    it('Queries DLQ failed messages list (GET /v1/dlq)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/dlq?limit=10&offset=0&team=payments', {
          method: 'GET',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        items: unknown[];
        total: number;
      };
      expect(Array.isArray(body.items)).toBe(true);
      expect(typeof body.total).toBe('number');
    });

    it('Replays failed DLQ messages (POST /v1/dlq/replay)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/dlq/replay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            messageIds: ['msg_01JYQ81NE7XK47PAV6MQR2P9NK'],
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { replayedCount: number; messageIds: string[] };
      expect(typeof body.replayedCount).toBe('number');
      expect(Array.isArray(body.messageIds)).toBe(true);
    });

    it('Rejects DLQ replay with empty array with 400 Bad Request', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/dlq/replay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({ messageIds: [] }),
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 6. Sandbox API (/v1/sandbox)
  // =========================================================================
  describe('6. Sandbox API (/v1/sandbox)', () => {
    it('Lists and clears sandbox test mode dispatches', async () => {
      // 1. Send sandbox message first
      await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': SEEDED_API_KEY_RAW,
            'x-convey-sandbox': 'true',
          },
          body: JSON.stringify({
            idempotencyKey: `idemp_sandbox_chk_${Date.now()}`,
            userId: 'usr_sandbox_check',
            team: 'payments',
            category: 'otp',
            country: 'AE',
            recipients: { phone: '+971509990001' },
            channels: [{ channel: 'sms', content: { text: 'Sandbox message for listing' } }],
          }),
        }),
      );

      // 2. Query sandbox messages
      const listRes = await app.fetch(
        new Request('http://localhost/v1/sandbox/messages', {
          method: 'GET',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as { messages: Array<{ isSandbox: boolean }> };
      expect(listBody.messages.length).toBeGreaterThan(0);
      expect(listBody.messages.every((m) => m.isSandbox)).toBe(true);

      // 3. Clear sandbox messages
      const deleteRes = await app.fetch(
        new Request('http://localhost/v1/sandbox/messages', {
          method: 'DELETE',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(deleteRes.status).toBe(200);
      const deleteBody = (await deleteRes.json()) as { success: boolean; count: number };
      expect(deleteBody.success).toBe(true);
      expect(deleteBody.count).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 7. Suppressions API (/v1/suppressions)
  // =========================================================================
  describe('7. Suppressions API (/v1/suppressions)', () => {
    let createdSuppressionId: string;

    it('Adds a recipient suppression record (POST /v1/suppressions)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/suppressions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            identifier: 'complaint_user@domain.com',
            identifierType: 'email',
            reason: 'spam_complaint',
            category: 'marketing',
            channel: 'email',
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; suppression: { id: string; recipient: string } };
      expect(body.success).toBe(true);
      expect(body.suppression.recipient).toBe('complaint_user@domain.com');
      createdSuppressionId = body.suppression.id;
    });

    it('Bulk adds recipient suppression records (POST /v1/suppressions/bulk)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/suppressions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            items: [
              {
                identifier: 'bulk_bounce_1@domain.com',
                identifierType: 'email',
                reason: 'hard_bounce',
                channel: 'email',
              },
              {
                identifier: '+971509998877',
                identifierType: 'phone',
                reason: 'user_optout',
                channel: 'sms',
              },
            ],
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; count: number; suppressions: unknown[] };
      expect(body.success).toBe(true);
      expect(body.count).toBe(2);
      expect(body.suppressions).toHaveLength(2);
    });

    it('Queries suppression records with filters and search (GET /v1/suppressions)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/suppressions?channel=email&limit=10', {
          method: 'GET',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { suppressions: Array<{ channel: string }>; total: number };
      expect(Array.isArray(body.suppressions)).toBe(true);
      expect(body.total).toBeGreaterThan(0);
    });

    it('Removes a suppression record (DELETE /v1/suppressions/:id)', async () => {
      const res = await app.fetch(
        new Request(`http://localhost/v1/suppressions/${createdSuppressionId}`, {
          method: 'DELETE',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('Returns 404 for non-existent suppression record', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/suppressions/non_existent_supp_9999', {
          method: 'DELETE',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 8. Webhook Subscriptions API (/v1/webhook-subscriptions)
  // =========================================================================
  describe('8. Webhook Subscriptions API (/v1/webhook-subscriptions)', () => {
    let createdSubscriptionId: string;

    it('Creates outgoing webhook subscription (POST /v1/webhook-subscriptions)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/webhook-subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            url: 'https://webhook.site/test-endpoint-e2e',
            events: ['message.delivered', 'message.failed'],
            secret: 'whsec_test_secret_key_12345',
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        subscription: { id: string; url: string; events: string[] };
      };
      expect(body.success).toBe(true);
      expect(body.subscription.id).toBeDefined();
      expect(body.subscription.url).toBe('https://webhook.site/test-endpoint-e2e');
      createdSubscriptionId = body.subscription.id;
    });

    it('Lists outgoing webhook subscriptions (GET /v1/webhook-subscriptions)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/webhook-subscriptions', {
          method: 'GET',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { subscriptions: Array<{ id: string; url: string }> };
      expect(body.subscriptions.some((s) => s.id === createdSubscriptionId)).toBe(true);
    });

    it('Sends test ping to webhook subscription (POST /v1/webhook-subscriptions/:id/test)', async () => {
      const res = await app.fetch(
        new Request(`http://localhost/v1/webhook-subscriptions/${createdSubscriptionId}/test`, {
          method: 'POST',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; message: string };
      expect(body.success).toBe(true);
      expect(body.message).toContain('queued for delivery');
    });

    it('Deletes outgoing webhook subscription (DELETE /v1/webhook-subscriptions/:id)', async () => {
      const res = await app.fetch(
        new Request(`http://localhost/v1/webhook-subscriptions/${createdSubscriptionId}`, {
          method: 'DELETE',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('Returns 404 for non-existent webhook subscription ID', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/webhook-subscriptions/non_existent_wh_sub_9999', {
          method: 'DELETE',
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 9. Inbound Webhooks & Email Open Tracking Pixel
  // =========================================================================
  describe('9. Inbound Provider Webhooks & Tracking Endpoints', () => {
    it('Ingests SendGrid delivery webhook (POST /v1/webhooks/sendgrid)', async () => {
      const eventId = `evt_sg_${Date.now()}`;
      const res = await app.fetch(
        new Request('http://localhost/v1/webhooks/sendgrid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-event-id': eventId },
          body: JSON.stringify([
            {
              email: 'customer@acme.com',
              event: 'delivered',
              sg_message_id: 'sg_msg_e2e_9988',
              timestamp: Math.floor(Date.now() / 1000),
            },
          ]),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { received?: boolean; status?: string };
      expect(body.received === true || body.status === 'accepted').toBe(true);

      // Duplicate delivery is gracefully deduplicated
      const dupRes = await app.fetch(
        new Request('http://localhost/v1/webhooks/sendgrid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-event-id': eventId },
          body: JSON.stringify([
            {
              email: 'customer@acme.com',
              event: 'delivered',
              sg_message_id: 'sg_msg_e2e_9988',
              timestamp: Math.floor(Date.now() / 1000),
            },
          ]),
        }),
      );
      expect(dupRes.status).toBe(200);
      const dupBody = (await dupRes.json()) as { status?: string };
      expect(dupBody.status).toBe('duplicate_ignored');
    });

    it('Ingests Twilio SMS webhook (POST /v1/webhooks/twilio)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/webhooks/twilio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            MessageSid: 'SM_twilio_msg_e2e_1122',
            MessageStatus: 'delivered',
            To: '+971501234567',
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { received?: boolean; status?: string };
      expect(body.received === true || body.status === 'accepted').toBe(true);
    });

    it('Ingests Cequens SMS webhook (POST /v1/webhooks/cequens)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/webhooks/cequens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: 'ceq_msg_e2e_3344',
            status: 'DELIVRD',
            recipient: '+971501234567',
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { received?: boolean; status?: string };
      expect(body.received === true || body.status === 'accepted').toBe(true);
    });

    it('Serves 1x1 transparent GIF email open tracking pixel (GET /v1/t/:token)', async () => {
      const res = await app.fetch(new Request('http://localhost/v1/t/pixel_token_e2e_test_9988.gif'));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/gif');
      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('Ingests Client Delivery Receipt (POST /v1/receipts)', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: 'msg_01JYQ81NE7XK47PAV6MQR2P9NK',
            event: 'delivered',
            channel: 'push',
            receivedAt: new Date().toISOString(),
          }),
        }),
      );

      expect(res.status).toBe(202);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('accepted');
    });

    it('Rejects invalid client receipt with 400 Bad Request', async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Missing messageId and event
            channel: 'push',
          }),
        }),
      );

      expect(res.status).toBe(400);
    });
  });
});
