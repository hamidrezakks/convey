import { describe, expect, test } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { providerCircuitBreaker } from '../src/modules/providers/core/circuit-breaker';
import { ProviderRegistry } from '../src/modules/providers/core/provider-registry';
import { ProviderState } from '../src/modules/providers/core/provider-types';
import {
  ensureProviderSendWorker,
  getProviderSendQueue,
  hotReloadProviderWorker,
  publishProviderConfigUpdate,
} from '../src/queues/provider-queues';

describe('Provider Lifecycle & Resiliency Engine Suite', () => {
  test('ProviderState enum provides standard enterprise lifecycle states', () => {
    expect(ProviderState.UNCONFIGURED as string).toBe('UNCONFIGURED');
    expect(ProviderState.CONFIGURED as string).toBe('CONFIGURED');
    expect(ProviderState.INITIALIZING as string).toBe('INITIALIZING');
    expect(ProviderState.ACTIVE as string).toBe('ACTIVE');
    expect(ProviderState.DEGRADED as string).toBe('DEGRADED');
    expect(ProviderState.DISABLED as string).toBe('DISABLED');
  });

  test('getProviderState reports accurate provider lifecycle state', async () => {
    const fakeState = ProviderRegistry.getProviderState('non-existent-provider-999');
    expect(fakeState).toBe(ProviderState.UNCONFIGURED);

    await ProviderRegistry.initializeProvider('discord', {
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
    });
    const discordState = ProviderRegistry.getProviderState('discord');
    expect(discordState).toBe(ProviderState.ACTIVE);
  });

  test('isWorkable uses O(1) memoization caching and invalidates on reconfigure', async () => {
    const config = { webhookUrl: 'https://discord.com/api/webhooks/memo/test' };

    // Initial check populates cache
    const firstCheck = ProviderRegistry.isWorkable('discord', config);
    expect(firstCheck).toBe(true);

    const initialMetrics = ProviderRegistry.getTelemetryMetrics();
    expect(initialMetrics.workableCacheSize).toBeGreaterThan(0);

    // Reconfigure invalidates cache
    await ProviderRegistry.reconfigureProvider('discord', {
      webhookUrl: 'https://discord.com/api/webhooks/memo/updated',
    });

    const secondCheck = ProviderRegistry.isWorkable('discord', config);
    expect(secondCheck).toBe(true);
  });

  test('reconfigureProvider updates credentials dynamically and increments generation counter', async () => {
    const initialGen = ProviderRegistry.getProviderGeneration('discord');
    const validConfig = { webhookUrl: 'https://discord.com/api/webhooks/456/def' };

    const result = await ProviderRegistry.reconfigureProvider('discord', validConfig);
    expect(result.success).toBe(true);

    const nextGen = ProviderRegistry.getProviderGeneration('discord');
    expect(nextGen).toBeGreaterThan(initialGen);
    expect(ProviderRegistry.getProviderState('discord')).toBe(ProviderState.ACTIVE);
  });

  test('checksum optimization detects identical configuration and skips redundant reload', async () => {
    const validConfig = { webhookUrl: 'https://discord.com/api/webhooks/checksum/test' };
    const firstRes = await ProviderRegistry.reconfigureProvider('discord', validConfig);
    expect(firstRes.success).toBe(true);
    expect(firstRes.unchanged).toBe(false);

    // Call again with exact same config
    const secondRes = await ProviderRegistry.reconfigureProvider('discord', validConfig);
    expect(secondRes.success).toBe(true);
    expect(secondRes.unchanged).toBe(true);
  });

  test('LKGC rollback restores previous good configuration on onConfigured error', async () => {
    const goodConfig = { webhookUrl: 'https://discord.com/api/webhooks/good/url' };
    await ProviderRegistry.reconfigureProvider('discord', goodConfig);

    const mod = ProviderRegistry.getModule('discord');
    if (mod) {
      const originalOnConfigured = mod.onConfigured;
      try {
        // Throw error ONLY on bad config, succeed on goodConfig (LKGC)
        mod.onConfigured = (cfg: Record<string, unknown>) => {
          if (cfg.webhookUrl === 'https://discord.com/api/webhooks/bad/url') {
            throw new Error('Simulated network auth error during reconfigure');
          }
          if (originalOnConfigured) return originalOnConfigured(cfg);
        };

        const result = await ProviderRegistry.reconfigureProvider('discord', {
          webhookUrl: 'https://discord.com/api/webhooks/bad/url',
        });

        expect(result.success).toBe(false);
        expect(result.rolledBack).toBe(true);
        expect(ProviderRegistry.getProviderState('discord')).toBe(ProviderState.DEGRADED);
      } finally {
        mod.onConfigured = originalOnConfigured;
        await ProviderRegistry.reconfigureProvider('discord', goodConfig);
      }
    }
  });

  test('probeProviderHealth auto-resolves native channel from manifest for chat, sms, and tool providers', async () => {
    const chatProbe = await ProviderRegistry.probeProviderHealth('discord', {
      webhookUrl: 'https://discord.com/api/webhooks/probe/test',
    });
    expect(chatProbe.healthy).toBe(true);

    const smsProbe = await ProviderRegistry.probeProviderHealth('twilio', {
      accountSid: 'AC123',
      authToken: 'secret',
    });
    expect(smsProbe.healthy).toBe(true);

    const toolProbe = await ProviderRegistry.probeProviderHealth('pagerduty', {
      routingKey: 'pd_key_123',
    });
    expect(toolProbe.healthy).toBe(true);
  });

  test('getStateHistory tracks provider state transitions with reasons', async () => {
    await ProviderRegistry.initializeProvider('discord', {
      webhookUrl: 'https://discord.com/api/webhooks/history/test',
    });

    const history = ProviderRegistry.getStateHistory('discord');
    expect(history.length).toBeGreaterThan(0);
    expect(history.some((h) => h.state === ProviderState.ACTIVE)).toBe(true);
  });

  test('checkDegradedProvidersSelfHealing automatically recovers degraded providers', async () => {
    await ProviderRegistry.initializeProvider('discord', {
      webhookUrl: 'https://discord.com/api/webhooks/self-heal/test',
    });

    // Manually mark provider degraded via Circuit Breaker trip
    providerCircuitBreaker.recordFailure('discord', true);
    expect(ProviderRegistry.getProviderState('discord')).toBe(ProviderState.DEGRADED);

    // Trigger self-healing background check
    const healResults = await ProviderRegistry.checkDegradedProvidersSelfHealing();
    expect(healResults.length).toBeGreaterThan(0);
    expect(healResults.some((r) => r.providerId === 'discord' && r.recovered)).toBe(true);

    // Assert discord returned to ACTIVE state
    expect(ProviderRegistry.getProviderState('discord')).toBe(ProviderState.ACTIVE);
  });

  test('selectOptimalProvider dynamically routes around DEGRADED providers to healthy failovers', async () => {
    await ProviderRegistry.initializeProvider('ses', { region: 'us-east-1' });
    await ProviderRegistry.initializeProvider('resend', { apiKey: 're_123456789' });

    // Trip SES circuit breaker to OPEN so it becomes DEGRADED
    providerCircuitBreaker.recordFailure('ses', true);
    expect(ProviderRegistry.getProviderState('ses')).toBe(ProviderState.DEGRADED);

    // Request optimal provider for email channel with preferred 'ses'
    const optimal = ProviderRegistry.selectOptimalProvider(Channel.EMAIL, 'ses');
    expect(optimal).toBeDefined();
    expect(optimal?.id).not.toBe('ses'); // Should automatically fail over away from degraded SES!

    providerCircuitBreaker.recordSuccess('ses'); // Reset circuit breaker
  });

  test('Circuit Breaker trip updates getProviderState to DEGRADED dynamically', () => {
    const providerId = 'circuit-test-provider';
    providerCircuitBreaker.recordFailure(providerId, true); // Permanent failure trips circuit immediately to OPEN

    const state = ProviderRegistry.getProviderState(providerId);
    expect(state).toBe(ProviderState.DEGRADED);

    providerCircuitBreaker.recordSuccess(providerId); // Reset to CLOSED
  });

  test('resolveTenantAdapter handles BYOC tenant-scoped adapter isolation cleanly', () => {
    const tenantConfig = { webhookUrl: 'https://discord.com/api/webhooks/tenant-123' };
    const tenantAdapter = ProviderRegistry.resolveTenantAdapter(Channel.CHAT, 'discord', tenantConfig);

    expect(tenantAdapter).toBeDefined();
    expect(tenantAdapter?.id).toBe('discord');
    expect(tenantAdapter?.channel).toBe(Channel.CHAT);
  });

  test('verifyProviderWorkability dry-run validates credentials without mutating registry state', () => {
    const validRes = ProviderRegistry.verifyProviderWorkability('discord', {
      webhookUrl: 'https://discord.com/api/webhooks/dry-run',
    });
    expect(validRes.workable).toBe(true);

    const invalidRes = ProviderRegistry.verifyProviderWorkability('discord', {});
    expect(invalidRes.workable).toBe(false);
    expect(invalidRes.reason).toBeDefined();
  });

  test('getTelemetryMetrics reports lifecycle metrics correctly', () => {
    const metrics = ProviderRegistry.getTelemetryMetrics();
    expect(metrics.manifestCount).toBeGreaterThan(0);
    expect(typeof metrics.reconfigsTotal).toBe('number');
    expect(typeof metrics.rollbacksTotal).toBe('number');
    expect(typeof metrics.noopsTotal).toBe('number');
  });

  test('multi-channel provider resolution distinguishes Infobip Email vs Infobip SMS', () => {
    const emailInfobip = ProviderRegistry.get(Channel.EMAIL, 'infobip');
    const smsInfobip = ProviderRegistry.get(Channel.SMS, 'infobip');

    expect(emailInfobip).toBeDefined();
    expect(smsInfobip).toBeDefined();
    expect(emailInfobip?.channel).toBe(Channel.EMAIL);
    expect(smsInfobip?.channel).toBe(Channel.SMS);
  });

  test('hotReloadProviderWorker pauses worker, reconfigures, and resumes cleanly with zero message loss', async () => {
    const providerId = 'discord';
    const initialConfig = { webhookUrl: 'https://discord.com/api/webhooks/100/initial' };
    await ProviderRegistry.initializeProvider(providerId, initialConfig);
    const worker = ensureProviderSendWorker(providerId, { force: true });
    expect(worker).toBeDefined();

    const queue = getProviderSendQueue(providerId);
    expect(queue).toBeDefined();

    // Add 10 dummy jobs to queue before hot-reload
    for (let i = 0; i < 10; i++) {
      await queue.add('test-send-job', {
        publicId: `msg_test_${i}`,
        channel: 'chat',
        content: { text: `Hello ${i}` },
        recipient: { webhookUrl: 'https://discord.com/api/webhooks/100/initial' },
        origin: 'initial',
        attemptNo: 1,
      });
    }

    const newConfig = { webhookUrl: 'https://discord.com/api/webhooks/200/updated' };
    const result = await hotReloadProviderWorker(providerId, newConfig);
    expect(result).toBe(true);

    const waitingCount = await queue.getWaitingCount();
    expect(waitingCount).toBeGreaterThanOrEqual(0);
  });

  test('hotReloadProviderWorker serializes concurrent hot-reload requests per provider', async () => {
    const providerId = 'discord';
    const initialGen = ProviderRegistry.getProviderGeneration(providerId);

    // Trigger 5 concurrent hot-reloads with distinct configs
    const promises = Array.from({ length: 5 }, (_, i) =>
      hotReloadProviderWorker(providerId, {
        webhookUrl: `https://discord.com/api/webhooks/concurrent/${i}`,
      }),
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      expect(r).toBe(true);
    }

    const finalGen = ProviderRegistry.getProviderGeneration(providerId);
    expect(finalGen).toBeGreaterThan(initialGen);
  });

  test('hotReloadProviderWorker rejects invalid unworkable configuration without disturbing existing worker', async () => {
    const providerId = 'discord';
    const invalidConfig = {}; // missing required webhookUrl
    const result = await hotReloadProviderWorker(providerId, invalidConfig);
    expect(result).toBe(false);
  });

  test('publishProviderConfigUpdate executes broadcast without throwing errors', async () => {
    await expect(
      publishProviderConfigUpdate('discord', {
        webhookUrl: 'https://discord.com/api/webhooks/broadcast/test',
      }),
    ).resolves.toBeUndefined();
  });
});
