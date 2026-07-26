import { redisClient } from '../queues/connection';
import { logger } from './logger';
import { formatRedisKey } from './redis-keys';

/**
 * Represents the health status and last recorded heartbeat for a specific region.
 */
export interface RegionStatus {
  /** Unique region identifier (e.g., 'us-east1', 'eu-west1', 'ap-south1') */
  regionId: string;
  /** Whether the region is actively sending healthy heartbeats within the TTL window */
  isHealthy: boolean;
  /** Unix timestamp in milliseconds of the last successful heartbeat */
  lastHeartbeatMs: number;
}

/**
 * Active-Active Cross-Region Geo-Replication Manager.
 *
 * Coordinates heartbeat publishing and remote region health checks across
 * multi-region active-active clusters to facilitate automatic cross-region failover.
 */
export class GeoReplicationManager {
  private localRegionId: string;
  private heartbeatIntervalMs = 5000;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Initializes the GeoReplicationManager.
   * @param regionId Optional explicit region override; defaults to ENV configuration or 'us-east1'.
   */
  constructor(regionId?: string) {
    this.localRegionId = regionId || process.env.REGION || process.env.REGION_ID || 'us-east1';
  }

  /**
   * Returns the local region identifier.
   */
  getLocalRegionId(): string {
    return this.localRegionId;
  }

  /**
   * Publishes an active heartbeat payload for the local region into Redis with a 15-second TTL.
   */
  async sendHeartbeat(): Promise<void> {
    const key = formatRedisKey(`geo:heartbeat:${this.localRegionId}`);
    const payload = JSON.stringify({
      regionId: this.localRegionId,
      isHealthy: true,
      lastHeartbeatMs: Date.now(),
    });

    try {
      await redisClient.set(key, payload, 'EX', 15);
    } catch (err) {
      logger.error('GeoReplication', `Failed to send heartbeat for region '${this.localRegionId}'`, err as Error);
    }
  }

  /**
   * Starts the background heartbeat loop executing every 5 seconds.
   */
  startHeartbeatLoop(): void {
    if (this.heartbeatTimer) return;
    this.sendHeartbeat().catch(() => {});
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat().catch(() => {});
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stops the background heartbeat timer loop.
   */
  stopHeartbeatLoop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Fetches the heartbeat and health status for a target region ID.
   * @param regionId Target region identifier to inspect.
   */
  async getRegionStatus(regionId: string): Promise<RegionStatus> {
    const key = formatRedisKey(`geo:heartbeat:${regionId}`);
    try {
      const raw = await redisClient.get(key);
      if (!raw) {
        return { regionId, isHealthy: false, lastHeartbeatMs: 0 };
      }
      const parsed = JSON.parse(raw) as RegionStatus;
      const isFresh = Date.now() - parsed.lastHeartbeatMs < 15000;
      return {
        regionId,
        isHealthy: isFresh,
        lastHeartbeatMs: parsed.lastHeartbeatMs,
      };
    } catch {
      return { regionId, isHealthy: false, lastHeartbeatMs: 0 };
    }
  }
}

/** Singleton instance of GeoReplicationManager */
export const geoReplicationManager = new GeoReplicationManager();
