import { describe, expect, it } from 'bun:test';
import { DynamicConfigReloader } from '../src/config/config-reloader';

describe('Zero-Downtime Dynamic Configuration Hot-Reloader', () => {
  it('updates local config state and applies remote PubSub updates', async () => {
    const reloader = new DynamicConfigReloader();
    expect(reloader.getConfig().maxWorkerConcurrency).toBe(50);

    await reloader.updateConfig({ maxWorkerConcurrency: 100 });
    expect(reloader.getConfig().maxWorkerConcurrency).toBe(100);

    reloader.applyRemoteUpdate(JSON.stringify({ circuitResetTimeoutMs: 60000 }));
    expect(reloader.getConfig().circuitResetTimeoutMs).toBe(60000);
  });
});
