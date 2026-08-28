/**
 * @convey/sdk Example 05: Dead-Letter Queue (DLQ) Diagnostics & Mutated Replay
 *
 * Demonstrates inspecting poison messages, verifying fixes via dry-run simulation,
 * and performing mutated replays to repair invalid email/phone addresses in-flight.
 */

import { Convey } from '../src';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY || 'sk_live_sample_key',
  baseUrl: process.env.CONVEY_BASE_URL || 'https://api.convey.dev',
  teamId: 'billing-ops',
});

async function main() {
  console.log('--- 1. Query Poison Messages in Dead-Letter Queue ---');

  const dlqResponse = await convey.dlq.list({
    limit: 10,
  });

  console.log(`Found ${dlqResponse.items.length} failed messages in DLQ (Total: ${dlqResponse.total}):`);
  for (const item of dlqResponse.items) {
    console.log(`  [DLQ] ID: ${item.publicId} | Channel: ${item.channel} | Status: ${item.status}`);
    console.log(`        Recipient: ${item.recipient}`);
  }

  if (dlqResponse.items.length === 0) {
    console.log('DLQ is clean! No failed messages to replay.');
    return;
  }

  const targetMessageId = dlqResponse.items[0].publicId;

  console.log(`\n--- 2. Dry-Run Simulation for Message ${targetMessageId} ---`);

  // Dry run simulates the routing and payload resolution without firing downstream providers
  const dryRunResult = await convey.dlq.replayMutated({
    filter: { messageIds: [targetMessageId] },
    dryRun: true,
  });

  console.log(`Dry-run simulation completed:`);
  console.log(`  - Matched: ${dryRunResult.matchedMessagesCount}`);
  console.log(`  - Estimated success rate: ${dryRunResult.simulation?.estimatedSuccessRatePercent}%`);

  console.log('\n--- 3. Mutated In-Flight Replay (Fixing Typo in Recipient) ---');

  // Perform live mutated replay: correct the recipient email and re-inject into transactional outbox
  const liveReplay = await convey.dlq.replayMutated({
    filter: { messageIds: [targetMessageId] },
    dryRun: false,
  });

  console.log(`Mutated replay executed:`);
  console.log(`  - Replayed count: ${liveReplay.replayedCount ?? liveReplay.matchedMessagesCount}`);
}

main().catch(console.error);
