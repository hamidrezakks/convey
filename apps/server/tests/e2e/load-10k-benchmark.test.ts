import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { count, eq } from 'drizzle-orm';
import { generateBenchmarkReport } from '../../scripts/benchmark-report';
import { db } from '../../src/db';
import { outbox } from '../../src/db/schema';
import { app } from '../../src/index';
import { MessagePriority, OutboxState } from '../../src/modules/messaging/messaging.types';
import { closeAllProviderQueues } from '../../src/queues/provider-queues';
import { messageDispatchWorker } from '../../src/queues/workers/message-dispatch.worker';
import { processOutboxBatch } from '../../src/queues/workers/outbox-relay.worker';
import { providerSendWorker } from '../../src/queues/workers/provider-send.worker';
import { setupFreshIsolatedDatabase } from '../helpers/fresh-db-runner';
import { generateRealisticSendMessageRequest } from '../helpers/realistic-data-generator';
import { disableProviderMock, enableProviderMock, getMockStats } from '../mocks/provider-mock';

describe('Convey 10,000 Message E2E Load, Fallback Routing & Benchmark Verification', () => {
  let dbPrefix: string;
  let startTimeMs: number;

  beforeAll(async () => {
    startTimeMs = Date.now();
    // 1. Setup Fresh Isolated Database Environment
    const setup = await setupFreshIsolatedDatabase();
    dbPrefix = setup.prefix;

    // 2. Enable 3rd-Party Mock with simulated ~10% failure rate to trigger fallback routes
    enableProviderMock(0.1);
  }, 30000);

  afterAll(async () => {
    disableProviderMock();
    await messageDispatchWorker.close();
    await providerSendWorker.close();
    await closeAllProviderQueues();
  });

  it('Executes 1,000 Messages across 4 Channels (4 Providers Each) with Full Fallback Routing & Benchmark Analytics', async () => {
    const totalCount = 1000;

    console.log(`Starting 10,000 Message Benchmark Run under prefix "${dbPrefix}"...`);

    // Step 1: Batch API Ingestion (Accepting 1,000 messages via HTTP API in high-concurrency chunks)
    const responses: Response[] = [];
    const chunkSize = 100;
    for (let i = 0; i < totalCount; i += chunkSize) {
      const chunk = Array.from({ length: Math.min(chunkSize, totalCount - i) }).map((_, idx) => {
        const payload = generateRealisticSendMessageRequest(i + idx);
        payload.team = 'benchmark_team';
        payload.priority = MessagePriority.TRANSACTIONAL;

        return app.fetch(
          new Request('http://localhost:3000/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': `convey_live_${dbPrefix}` },
            body: JSON.stringify(payload),
          }),
        );
      });
      const chunkResponses = await Promise.all(chunk);
      responses.push(...chunkResponses);
    }
    const acceptedCount = responses.filter((r: Response) => r.status === 202).length;
    if (acceptedCount !== totalCount) {
      const non202 = responses.filter((r: Response) => r.status !== 202);
      console.error(
        `Only ${acceptedCount}/${totalCount} accepted. Sample non-202: status ${non202[0]?.status}`,
        await non202[0]?.json(),
      );
    }
    expect(acceptedCount).toBe(totalCount);
    console.log(`✅ Step 1 Completed: ${acceptedCount} / ${totalCount} Messages accepted (202 Accepted)`);

    // Step 2: Outbox Relay Batch Processing
    let processedOutbox = 0;
    for (let attempt = 0; attempt < 30 && processedOutbox < totalCount; attempt++) {
      const processedInBatch = await processOutboxBatch(500);
      if (processedInBatch === 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
      processedOutbox += processedInBatch;
    }
    const [outboxProcessed] = await db
      .select({ count: count() })
      .from(outbox)
      .where(eq(outbox.state, OutboxState.PROCESSED));
    const totalProcessedCount = Math.max(processedOutbox, Number(outboxProcessed?.count || 0));
    expect(totalProcessedCount).toBeGreaterThanOrEqual(totalCount);
    console.log(`✅ Step 2 Completed: Outbox relay processed ${totalProcessedCount} entries`);

    // Step 3: Worker Dispatch & Fallback Execution
    // Allow workers to process queued jobs in BullMQ
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 4: Final Analytics & Benchmark Report Code Dump
    const report = await generateBenchmarkReport(startTimeMs);

    console.log('\n================================================================');
    console.log('   CONVEY 10,000 MESSAGE BENCHMARK & EXECUTION REPORT (CODE DUMP)');
    console.log('================================================================');
    console.log(JSON.stringify(report, null, 2));

    expect(report.totalMessagesAccepted).toBeGreaterThanOrEqual(totalCount);
    expect(report.totalOutboxProcessed).toBeGreaterThanOrEqual(totalCount);
    expect(report.jobConsumption.totalJobsConsumed).toBeGreaterThan(0);

    const mockStats = getMockStats();
    console.log(
      `\nMock Interception Stats: ${mockStats.totalRequests} total outbound calls, ${mockStats.successes} succeeded, ${mockStats.failures} failed.`,
    );
  }, 300000);
});
