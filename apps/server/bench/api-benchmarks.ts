import { app } from '../src/index';
import { SEEDED_API_KEY_RAW, seedDatabaseWithRealisticData } from '../tests/helpers/db-seeder';
import { enableProviderMock } from '../tests/mocks/provider-mock';
import { BenchmarkSuite } from './bench-harness';

export async function createApiBenchmarkSuite(): Promise<BenchmarkSuite> {
  enableProviderMock(0.0);
  await seedDatabaseWithRealisticData();

  const suite = new BenchmarkSuite('Convey HTTP API Ingestion Benchmarks');

  // 1. Health Endpoint Throughput
  suite.add(
    'GET /health (Health & Subsystems Status)',
    async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      if (res.status !== 200 && res.status !== 503) {
        throw new Error(`Health status ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 200, warmupIterations: 20 },
  );

  // 2. Single Message Send (POST /v1/messages - SMS)
  let msgSeq = 0;
  suite.add(
    'POST /v1/messages (Single SMS Send)',
    async () => {
      msgSeq++;
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `bench_sms_${msgSeq}_${Date.now()}`,
            userId: `usr_bench_${msgSeq}`,
            team: 'payments',
            category: 'otp',
            country: 'AE',
            recipients: { phone: '+971501234567' },
            channels: [{ channel: 'sms', content: { text: `Bench OTP code ${msgSeq}` } }],
          }),
        }),
      );

      if (res.status !== 202) {
        throw new Error(`Expected 202, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 150, warmupIterations: 15 },
  );

  // 3. Single Message Send (POST /v1/messages - Email)
  let emailSeq = 0;
  suite.add(
    'POST /v1/messages (Single Email Direct HTML)',
    async () => {
      emailSeq++;
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `bench_email_${emailSeq}_${Date.now()}`,
            userId: `usr_email_${emailSeq}`,
            team: 'payments',
            category: 'transactional',
            country: 'US',
            recipients: { email: `customer_${emailSeq}@example.com` },
            channels: [
              {
                channel: 'email',
                content: {
                  subject: 'Receipt for Order',
                  html: '<h1>Thank you for your business</h1>',
                  text: 'Thank you for your business',
                },
              },
            ],
          }),
        }),
      );

      if (res.status !== 202) {
        throw new Error(`Expected 202, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 150, warmupIterations: 15 },
  );

  // 4. Omnichannel Send with Cascade Fallbacks (POST /v1/messages)
  let cascadeSeq = 0;
  suite.add(
    'POST /v1/messages (Omnichannel with Cascade Fallback)',
    async () => {
      cascadeSeq++;
      const res = await app.fetch(
        new Request('http://localhost/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            idempotencyKey: `bench_cascade_${cascadeSeq}_${Date.now()}`,
            userId: `usr_cascade_${cascadeSeq}`,
            team: 'payments',
            category: 'transactional',
            country: 'AE',
            recipients: {
              email: `user_${cascadeSeq}@example.com`,
              phone: '+971501234567',
              whatsapp: '+971501234567',
            },
            channels: [
              { channel: 'whatsapp', content: { text: `Order update ${cascadeSeq}` } },
              { channel: 'sms', content: { text: `Order update ${cascadeSeq}` } },
              { channel: 'email', content: { subject: 'Order Update', text: `Order update ${cascadeSeq}` } },
            ],
            cascade: {
              enabled: true,
              steps: [
                { channel: 'whatsapp', content: { text: `Order update ${cascadeSeq}` }, waitForReceiptMs: 5000 },
                { channel: 'sms', content: { text: `Order update ${cascadeSeq}` }, waitForReceiptMs: 5000 },
                { channel: 'email', content: { subject: 'Order Update', text: `Order update ${cascadeSeq}` } },
              ],
            },
          }),
        }),
      );

      if (res.status !== 202) {
        throw new Error(`Expected 202, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 100, warmupIterations: 10 },
  );

  // 5. Bulk Message Send (POST /v1/messages/bulk - 10 items)
  let bulkSeq10 = 0;
  suite.add(
    'POST /v1/messages/bulk (10 Messages per Batch)',
    async () => {
      bulkSeq10++;
      const items = Array.from({ length: 10 }).map((_, idx) => ({
        idempotencyKey: `bench_b10_${bulkSeq10}_${idx}_${Date.now()}`,
        userId: `usr_b10_${bulkSeq10}_${idx}`,
        team: 'payments',
        category: 'otp',
        country: 'AE',
        recipients: { phone: `+97150000${idx}${bulkSeq10 % 100}` },
        channels: [{ channel: 'sms', content: { text: `Bulk OTP #${idx}` } }],
      }));

      const res = await app.fetch(
        new Request('http://localhost/v1/messages/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({ messages: items }),
        }),
      );

      if (res.status !== 202) {
        throw new Error(`Expected 202, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 50, warmupIterations: 5 },
  );

  // 6. High-Density Bulk Message Send (POST /v1/messages/bulk - 50 items)
  let bulkSeq50 = 0;
  suite.add(
    'POST /v1/messages/bulk (50 Messages per Batch)',
    async () => {
      bulkSeq50++;
      const items = Array.from({ length: 50 }).map((_, idx) => ({
        idempotencyKey: `bench_b50_${bulkSeq50}_${idx}_${Date.now()}`,
        userId: `usr_b50_${bulkSeq50}_${idx}`,
        team: 'payments',
        category: 'otp',
        country: 'AE',
        recipients: { phone: `+97150111${idx.toString().padStart(3, '0')}` },
        channels: [{ channel: 'sms', content: { text: `Bulk OTP #${idx}` } }],
      }));

      const res = await app.fetch(
        new Request('http://localhost/v1/messages/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({ messages: items }),
        }),
      );

      if (res.status !== 202) {
        throw new Error(`Expected 202, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 20, warmupIterations: 2 },
  );

  // 7. Maximum Density Bulk Message Send (POST /v1/messages/bulk - 100 items)
  let bulkSeq100 = 0;
  suite.add(
    'POST /v1/messages/bulk (100 Messages per Batch)',
    async () => {
      bulkSeq100++;
      const items = Array.from({ length: 100 }).map((_, idx) => ({
        idempotencyKey: `bench_b100_${bulkSeq100}_${idx}_${Date.now()}`,
        userId: `usr_b100_${bulkSeq100}_${idx}`,
        team: 'payments',
        category: 'otp',
        country: 'AE',
        recipients: { phone: `+97150222${idx.toString().padStart(3, '0')}` },
        channels: [{ channel: 'sms', content: { text: `Bulk OTP #${idx}` } }],
      }));

      const res = await app.fetch(
        new Request('http://localhost/v1/messages/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({ messages: items }),
        }),
      );

      if (res.status !== 202) {
        throw new Error(`Expected 202, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 10, warmupIterations: 2 },
  );

  // 8. Message Status Query (GET /v1/messages/:messageId)
  const seedMsgRes = await app.fetch(
    new Request('http://localhost/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
      body: JSON.stringify({
        idempotencyKey: `bench_seed_${Date.now()}`,
        userId: 'usr_bench_query',
        team: 'payments',
        category: 'otp',
        country: 'AE',
        recipients: { phone: '+971501234567' },
        channels: [{ channel: 'sms', content: { text: 'Seed msg for benchmark queries' } }],
      }),
    }),
  );
  const seedMsgBody = (await seedMsgRes.json()) as { messageId: string };
  const queryMessageId = seedMsgBody.messageId;

  suite.add(
    'GET /v1/messages/:messageId (Status Lookup)',
    async () => {
      const res = await app.fetch(
        new Request(`http://localhost/v1/messages/${queryMessageId}`, {
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 200, warmupIterations: 20 },
  );

  // 9. Batches Creation (POST /v1/batches)
  let batchSeq = 0;
  suite.add(
    'POST /v1/batches (Batch Dispatch Context Init)',
    async () => {
      batchSeq++;
      const res = await app.fetch(
        new Request('http://localhost/v1/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            totalCount: 1000,
            metadata: { batchSeq, label: 'bench' },
          }),
        }),
      );

      if (res.status !== 201) {
        throw new Error(`Expected 201, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 100, warmupIterations: 10 },
  );

  // 10. Suppressions Add (POST /v1/suppressions)
  let suppSeq = 0;
  suite.add(
    'POST /v1/suppressions (Add Suppression Record)',
    async () => {
      suppSeq++;
      const res = await app.fetch(
        new Request('http://localhost/v1/suppressions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            identifier: `bench_supp_${suppSeq}_${Date.now()}@example.com`,
            identifierType: 'email',
            reason: 'bounce',
            channel: 'email',
          }),
        }),
      );

      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 100, warmupIterations: 10 },
  );

  // 11. DLQ Replay Endpoint (POST /v1/dlq/replay)
  suite.add(
    'POST /v1/dlq/replay (Replay Failed Messages)',
    async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/dlq/replay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
          body: JSON.stringify({
            messageIds: [queryMessageId],
          }),
        }),
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 50, warmupIterations: 5 },
  );

  // 12. Provider Inbound Webhook (POST /v1/webhooks/sendgrid)
  let whSeq = 0;
  suite.add(
    'POST /v1/webhooks/sendgrid (Inbound Webhook Ingestion)',
    async () => {
      whSeq++;
      const res = await app.fetch(
        new Request('http://localhost/v1/webhooks/sendgrid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-event-id': `evt_bench_${whSeq}_${Date.now()}` },
          body: JSON.stringify([
            {
              email: `user_${whSeq}@example.com`,
              event: 'delivered',
              sg_message_id: `sg_bench_${whSeq}`,
              timestamp: Math.floor(Date.now() / 1000),
            },
          ]),
        }),
      );

      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 150, warmupIterations: 15 },
  );

  // 13. Twilio Webhook (POST /v1/webhooks/twilio)
  let twilioSeq = 0;
  suite.add(
    'POST /v1/webhooks/twilio (SMS Status Callback)',
    async () => {
      twilioSeq++;
      const res = await app.fetch(
        new Request('http://localhost/v1/webhooks/twilio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            MessageSid: `SM_bench_${twilioSeq}`,
            MessageStatus: 'delivered',
            To: '+971501234567',
            From: '+15550001111',
          }),
        }),
      );

      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 150, warmupIterations: 15 },
  );

  // 14. Sandbox Mode Message List (GET /v1/sandbox/messages)
  suite.add(
    'GET /v1/sandbox/messages (Sandbox Dispatches Inspection)',
    async () => {
      const res = await app.fetch(
        new Request('http://localhost/v1/sandbox/messages', {
          headers: { 'x-api-key': SEEDED_API_KEY_RAW },
        }),
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}`);
      }
    },
    { category: 'HTTP APIs', iterations: 100, warmupIterations: 10 },
  );

  return suite;
}
