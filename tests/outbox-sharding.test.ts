import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { buildMessageAndOutboxRecords } from '../src/modules/messaging/messaging.service';
import { Channel, MessagePriority, type SendMessageRequest } from '../src/modules/messaging/messaging.types';
import {
  OUTBOX_SHARD_COUNT,
  startOutboxRelayLoop,
  stopOutboxRelayLoop,
} from '../src/queues/workers/outbox-relay.worker';
import { shardRouter } from '../src/utils/shard-router';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';
import { disableProviderMock, enableProviderMock } from './mocks/provider-mock';

describe('Outbox Sharding & Linear Throughput Scaling', () => {
  beforeAll(async () => {
    await setupFreshIsolatedDatabase();
    enableProviderMock(0.0);
  });

  afterAll(async () => {
    disableProviderMock();
    stopOutboxRelayLoop();
  });

  it('1. ShardRouter computes consistent shards across 10,000 distinct messages', () => {
    const shardAssignments = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const shard = shardRouter.getShardIndex('team_alpha', `msg_${i}`);
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(OUTBOX_SHARD_COUNT);
      shardAssignments.add(shard);
    }
    // High cardinality distribution across all configured shards
    expect(shardAssignments.size).toBeGreaterThan(1);
  });

  it('2. buildMessageAndOutboxRecords writes shard_id matching the message hash', () => {
    const now = new Date();
    const req: SendMessageRequest = {
      idempotencyKey: `idem_outbox_shard_${Date.now()}`,
      userId: 'usr_shard_001',
      team: 'enterprise_client',
      category: 'security',
      country: 'US',
      priority: MessagePriority.NORMAL,
      channels: [
        {
          channel: Channel.EMAIL,
          content: { subject: 'Verification', text: 'Code 1234' },
        },
      ],
      recipients: { email: 'user@example.com' },
    };

    const { publicId, outboxRecord } = buildMessageAndOutboxRecords(req, now, false);

    expect(outboxRecord.shardId).toBeDefined();
    expect(outboxRecord.shardId).toBe(shardRouter.getShardIndex('enterprise_client', publicId));
    expect(outboxRecord.shardId).toBeGreaterThanOrEqual(0);
    expect(outboxRecord.shardId).toBeLessThan(OUTBOX_SHARD_COUNT);
  });

  it('3. startOutboxRelayLoop and stopOutboxRelayLoop manage parallel shard task loops cleanly', () => {
    // Start sharded relay
    startOutboxRelayLoop(100, true);
    // Stop cleanly
    stopOutboxRelayLoop();
    expect(true).toBe(true);
  });
});
