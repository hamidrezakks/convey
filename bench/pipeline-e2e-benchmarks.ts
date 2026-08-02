import { app } from '../src/index';
import { processOutboxBatch } from '../src/queues/workers/outbox-relay.worker';
import { SEEDED_API_KEY_RAW, seedDatabaseWithRealisticData } from '../tests/helpers/db-seeder';
import { enableProviderMock } from '../tests/mocks/provider-mock';
import { BenchmarkSuite } from './bench-harness';

export async function createPipelineBenchmarkSuite(): Promise<BenchmarkSuite> {
  enableProviderMock(0.0);
  await seedDatabaseWithRealisticData();

  const suite = new BenchmarkSuite('Convey End-to-End Pipeline & Outbox Concurrency Benchmarks');

  // 1. Concurrent Ingestion (50 concurrent requests per batch)
  let concurrencySeq = 0;
  suite.add(
    'Concurrent API Ingestion [50 Concurrent In-Flight Requests]',
    async () => {
      concurrencySeq++;
      const promises = Array.from({ length: 50 }).map((_, idx) => {
        const id = concurrencySeq * 50 + idx;
        return app.fetch(
          new Request('http://localhost/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
            body: JSON.stringify({
              idempotencyKey: `bench_conc_${id}_${Date.now()}`,
              userId: `usr_conc_${id}`,
              team: 'payments',
              category: 'otp',
              country: 'AE',
              recipients: { phone: `+97150000${idx.toString().padStart(4, '0')}` },
              channels: [{ channel: 'sms', content: { text: `Concurrent OTP #${id}` } }],
            }),
          }),
        );
      });

      const responses = await Promise.all(promises);
      for (const res of responses) {
        if (res.status !== 202) {
          throw new Error(`Concurrent send returned status ${res.status}`);
        }
      }
    },
    { category: 'End-to-End Pipeline', iterations: 20, warmupIterations: 2 },
  );

  // 2. Outbox Relay Batch Processing (Batch size: 100)
  suite.add(
    'Outbox Relay Batch Processor [FOR UPDATE SKIP LOCKED Polling]',
    async () => {
      await processOutboxBatch(100);
    },
    { category: 'End-to-End Pipeline', iterations: 30, warmupIterations: 3 },
  );

  return suite;
}
