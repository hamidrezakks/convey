/**
 * @convey/sdk Example 02: High-Throughput Bulk Dispatches & Campaign Batches
 *
 * Demonstrates high-throughput batch ingestions, bulk transactional sends,
 * and live campaign batch pause/resume/cancel lifecycles.
 */

import { Channel, Convey, MessagePriority, type SendMessageRequest } from '../src';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY || 'sk_live_sample_key',
  baseUrl: process.env.CONVEY_BASE_URL || 'https://api.convey.dev',
  teamId: 'campaign-ops',
});

async function main() {
  console.log('--- 1. Bulk Ingestion (Transactional Outbox Pipeline) ---');

  const recipients = [
    { email: 'user1@acme.com', name: 'Alice' },
    { email: 'user2@acme.com', name: 'Bob' },
    { email: 'user3@acme.com', name: 'Charlie' },
  ];

  const bulkPayload: SendMessageRequest[] = recipients.map((r, idx) => ({
    channel: Channel.EMAIL,
    recipient: r.email,
    priority: MessagePriority.DEFAULT,
    content: {
      subject: `Product Update for ${r.name}`,
      body: `<p>Hello ${r.name}, we just shipped new features in version 2.4!</p>`,
    },
    category: 'PRODUCT_UPDATE',
    idempotencyKey: `bulk_product_update_2_4_user_${idx + 1}`,
  }));

  const bulkResult = await convey.messages.sendBulk(bulkPayload);
  console.log(`Accepted ${bulkResult.total} messages in single network RTT:`);
  for (const item of bulkResult.items) {
    console.log(`  - ${item.publicId} (State: ${item.state})`);
  }

  console.log('\n--- 2. Create and Manage Long-Running Campaign Batch ---');

  // Create batch envelope
  const batchRes = await convey.batches.create({
    totalCount: 50000,
    metadata: {
      campaignName: 'Summer Promo 2026',
      targetSegment: 'Tier 1 Global',
    },
  });
  const batchId = batchRes.batch.id;
  console.log(`Created Campaign Batch: ${batchId} (State: ${batchRes.batch.state})`);

  // Query Batch Status
  const { batch: currentBatch } = await convey.batches.get(batchId);
  console.log(`Batch ${batchId} Progress: ${currentBatch.processedCount} / ${currentBatch.totalCount}`);

  // Pause Batch Processing (e.g. during unexpected downstream throttle)
  const paused = await convey.batches.pause(batchId);
  console.log(`Paused Batch: ${paused.batch.id} (State: ${paused.batch.state})`);

  // Resume Batch Processing
  const resumed = await convey.batches.resume(batchId);
  console.log(`Resumed Batch: ${resumed.batch.id} (State: ${resumed.batch.state})`);

  // List Active Batches for Team
  const activeBatches = await convey.batches.list();
  console.log(`Retrieved ${activeBatches.batches.length} active batches for team.`);
}

main().catch(console.error);
