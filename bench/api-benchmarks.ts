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

  // 4. Bulk Message Send (POST /v1/messages/bulk - 10 items)
  let bulkSeq = 0;
  suite.add(
    'POST /v1/messages/bulk (10 Messages per Batch)',
    async () => {
      bulkSeq++;
      const items = Array.from({ length: 10 }).map((_, idx) => ({
        idempotencyKey: `bench_bulk_${bulkSeq}_${idx}_${Date.now()}`,
        userId: `usr_bulk_${bulkSeq}_${idx}`,
        team: 'payments',
        category: 'otp',
        country: 'AE',
        recipients: { phone: `+97150000${idx}${bulkSeq % 100}` },
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

  // 5. Message Status Query (GET /v1/messages/:messageId)
  // Seed a message to query
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

  // 6. Batches Creation (POST /v1/batches)
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

  // 7. Suppressions Add (POST /v1/suppressions)
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

  // 8. Provider Inbound Webhook (POST /v1/webhooks/sendgrid)
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

  return suite;
}
