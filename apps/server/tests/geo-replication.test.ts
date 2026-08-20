import { describe, expect, it } from 'bun:test';
import { GeoReplicationManager } from '../src/utils/geo-replication';

describe('Active-Active Cross-Region Geo-Replication Manager', () => {
  it('sends and parses heartbeats for local region', async () => {
    const geo = new GeoReplicationManager('us-east1');
    expect(geo.getLocalRegionId()).toBe('us-east1');

    await geo.sendHeartbeat();
    const status = await geo.getRegionStatus('us-east1');

    expect(status.regionId).toBe('us-east1');
    expect(status.isHealthy).toBe(true);
    expect(status.lastHeartbeatMs).toBeGreaterThan(0);
  });
});
