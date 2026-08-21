/**
 * Consistent Hashing Shard Router.
 *
 * Distributes outbox queue dispatches across N virtual shards using MD5/Murmur consistent hashing
 * on tenant and message keys to eliminate row-level database locks and single-queue bottlenecks.
 */
export class ConsistentHashShardRouter {
  private totalShards: number;

  /**
   * Initializes the shard router.
   * @param totalShards Total number of virtual shards (default: 16).
   */
  constructor(totalShards = 16) {
    this.totalShards = totalShards;
  }

  /**
   * Maps a tenant and message key to a deterministic shard index (0 to totalShards - 1).
   * @param tenantId Tenant identifier.
   * @param messageId Message public identifier.
   */
  getShardIndex(tenantId: string, messageId: string): number {
    const key = `${tenantId}:${messageId}`;
    return (Bun.hash.murmur32v3(key) >>> 0) % this.totalShards;
  }

  /**
   * Formats the virtual shard queue name for a tenant and message key.
   * @param tenantId Tenant identifier.
   * @param messageId Message public identifier.
   */
  getShardQueueName(tenantId: string, messageId: string): string {
    const index = this.getShardIndex(tenantId, messageId);
    return `outbox_shard_${index}`;
  }
}

/** Singleton instance of ConsistentHashShardRouter */
export const shardRouter = new ConsistentHashShardRouter();
