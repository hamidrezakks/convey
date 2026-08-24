/**
 * @convey/sdk Example 05: Dead-Letter Queue (DLQ) Diagnostics & Mutated Replay
 *
 * Demonstrates inspecting poison messages, verifying fixes via dry-run simulation,
 * and performing mutated replays to repair invalid email/phone addresses in-flight.
 */

import { Convey } from '../src';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY || 'sk_live_sample_key',
  teamId: 'billing-ops',
});

async function main() {
  console.log('--- 1. Query Poison Messages in Dead-Letter Queue ---');

  const dlqResponse = await convey.dlq.list({
    limit: 10,
  });

  console.log(`Found ${dlqResponse.items.length} failed messages in DLQ (Total: ${dlqResponse.total}):`);
  for (const item of dlqResponse.items) {
    console.log(
      `  [DLQ] ID: ${item.messageId} | Channel: ${item.channel} | Category: ${item.failureCategory} | Attempts: ${item.retryCount}`,
    );
    console.log(`        Reason: ${item.errorReason}`);
  }

  if (dlqResponse.items.length === 0) {
    console.log('DLQ is clean! No failed messages to replay.');
    return;
  }

  const targetMessageId = dlqResponse.items[0].messageId;

  console.log(`\n--- 2. Dry-Run Simulation for Message ${targetMessageId} ---`);

  // Dry run simulates the routing and payload resolution without firing downstream providers
  const dryRunResult = await convey.dlq.replayMutated({
    messageIds: [targetMessageId],
    dryRun: true,
    mutations: {
      metadata: { debugReplayInitiatedBy: 'ops-engineer' },
    },
  });

  console.log(`Dry-run simulation completed:`);
  console.log(`  - Replayed: ${dryRunResult.replayedCount}`);
  console.log(`  - Failed: ${dryRunResult.failedCount}`);
  console.log(`  - Message status:`, dryRunResult.messages);

  console.log('\n--- 3. Mutated In-Flight Replay (Fixing Typo in Recipient) ---');

  // Perform live mutated replay: correct the recipient email and re-inject into transactional outbox
  const liveReplay = await convey.dlq.replayMutated({
    messageIds: [targetMessageId],
    dryRun: false,
    mutations: {
      recipients: {
        email: 'corrected.recipient@company.com',
      },
      metadata: {
        remediationReason: 'Customer updated incorrect email address in portal',
      },
    },
  });

  console.log(`Mutated replay executed:`);
  console.log(`  - Success count: ${liveReplay.replayedCount}`);
  console.log(`  - Details:`, liveReplay.messages);
}

main().catch(console.error);
