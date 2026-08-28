/**
 * @convey/sdk Example 04: Memory-Efficient Auto-Pagination Streaming
 *
 * Demonstrates asynchronous iterators (`for await...of`) for processing
 * unbounded datasets without memory exhaustion or high GC pause times.
 */

import { Convey, SuppressionReason } from '../src';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY || 'sk_live_sample_key',
  baseUrl: process.env.CONVEY_BASE_URL || 'https://api.convey.dev',
  teamId: 'compliance',
});

async function main() {
  console.log('--- 1. Stream 100,000 Suppressions with Zero Memory Bloat ---');

  let processedCount = 0;
  const hardBounces: string[] = [];

  // auto-paginator fetches pages in chunks of 100 behind the scenes
  const suppressionStream = convey.suppressions.listAutoPaging({
    limit: 100,
  });

  for await (const entry of suppressionStream) {
    processedCount++;

    if (entry.reason === SuppressionReason.HARD_BOUNCE) {
      hardBounces.push(entry.identifier);
    }

    if (processedCount % 500 === 0) {
      console.log(`Streamed ${processedCount} suppression records...`);
    }

    // Early termination condition if needed
    if (processedCount >= 2000) {
      console.log('Reached processing quota limit for this worker cycle. Breaking gracefully.');
      break;
    }
  }

  console.log(`Total streamed: ${processedCount}, Hard bounces identified: ${hardBounces.length}`);

  console.log('\n--- 2. Eager Array Conversion with Safe Cap (.autoPagingToArray) ---');

  // Safely collect up to 50 items into a standard JavaScript array
  const topAuditLogs = await convey.admin.listAuditLogsAutoPaging({ limit: 25 }).autoPagingToArray(50);

  console.log(`Collected ${topAuditLogs.length} audit log items into array:`);
  for (const log of topAuditLogs.slice(0, 5)) {
    console.log(`  - [${log.timestamp}] ${log.action} by ${log.actor}`);
  }

  console.log('\n--- 3. DLQ Message Inspection Stream ---');

  const dlqStream = convey.dlq.listAutoPaging({ limit: 50 });
  let poisonPills = 0;

  for await (const failedMsg of dlqStream) {
    if (failedMsg.status === 'FAILED') {
      poisonPills++;
      console.log(`Failed message in DLQ: ${failedMsg.publicId} (Recipient: ${failedMsg.recipient})`);
    }
  }
  console.log(`Total poison pills found in DLQ: ${poisonPills}`);
}

main().catch(console.error);
