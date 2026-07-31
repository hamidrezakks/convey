import { describe, expect, it } from 'bun:test';
import { ConsistentHashShardRouter } from '../src/utils/shard-router';

describe('Consistent Hashing Shard Router', () => {
  it('maps keys deterministically to virtual shard indices and queue names', () => {
    const router = new ConsistentHashShardRouter(16);
    const tenantId = 'tenant_123';
    const messageId = 'msg_01JYQ8EY629Q04MCX7C2WHF5VD';

    const index1 = router.getShardIndex(tenantId, messageId);
    const index2 = router.getShardIndex(tenantId, messageId);

    expect(index1).toBe(index2);
    expect(index1).toBeGreaterThanOrEqual(0);
    expect(index1).toBeLessThan(16);

    const queueName = router.getShardQueueName(tenantId, messageId);
    expect(queueName).toBe(`outbox_shard_${index1}`);
  });
});
