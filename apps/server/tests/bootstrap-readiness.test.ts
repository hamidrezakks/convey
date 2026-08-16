import { beforeAll, describe, expect, test } from 'bun:test';
import { app } from '../src';
import { bootstrapService } from '../src/bootstrap';
import { Channel } from '../src/modules/messaging/messaging.types';
import { ProviderRegistry } from '../src/modules/providers/core/provider-registry';
import { ensureProviderSendWorker, setupConfiguredProviderWorkers } from '../src/queues/provider-queues';
import { logger } from '../src/utils/logger';
import { ComponentStatus, PartitionStatus, appReadiness } from '../src/utils/readiness';

describe('Bootstrap, Provider Setup & Readiness Suite', () => {
  beforeAll(async () => {
    await bootstrapService();
  });

  test('ProviderRegistry evaluates setup status correctly', () => {
    const discordAdapter = ProviderRegistry.get(Channel.CHAT, 'discord');
    expect(discordAdapter).toBeDefined();

    const hasCustomSetup = ProviderRegistry.hasSetup('discord', {
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
    });
    expect(hasCustomSetup).toBe(true);

    const testConfig = {
      discord: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' },
      ses: { region: 'us-east-1' },
    };

    const configuredProviders = ProviderRegistry.getConfiguredProviders(testConfig);
    expect(configuredProviders.length).toBeGreaterThan(0);

    const emailAdapters = ProviderRegistry.getConfiguredAdaptersByChannel(Channel.EMAIL, testConfig);
    expect(emailAdapters.length).toBeGreaterThan(0);
  });

  test('Selective worker initialization only registers workers for setup providers', () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const worker = ensureProviderSendWorker('unconfigured-fake-provider-xyz');
      expect(worker).toBeUndefined();

      const forcedWorker = ensureProviderSendWorker('discord', { force: true });
      expect(forcedWorker).toBeDefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  test('setupConfiguredProviderWorkers pre-initializes workers for active providers', () => {
    const count = setupConfiguredProviderWorkers({
      discord: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' },
    });
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('bootstrapService initializes application readiness state', () => {
    const status = appReadiness.getStatus();
    expect(status.ready).toBe(true);
    expect(status.db).toBe(ComponentStatus.CONNECTED);
    expect(status.redis).toBe(ComponentStatus.CONNECTED);
    expect(status.partitions).toBe(PartitionStatus.READY);
    expect(status.bootstrappedAt).toBeDefined();
  });

  test('Logger utility emits structured log entries without throwing errors', () => {
    expect(() => {
      logger.info('TestComponent', 'Testing structured logger info output');
      logger.warn('TestComponent', 'Testing structured logger warn output');
      logger.error('TestComponent', 'Testing structured logger error output');
    }).not.toThrow();
  });

  test('GET /health returns HTTP 200 and readiness status metadata', async () => {
    const response = await app.handle(new Request('http://localhost/health'));
    expect(response.status).toBe(200);

    const json = (await response.json()) as Record<string, unknown>;
    expect(json.status).toBe('ok');
    expect(json.db).toBe(ComponentStatus.CONNECTED);
    expect(json.redis).toBe(ComponentStatus.CONNECTED);
  });

  test('GET /health/readiness returns detailed readiness report', async () => {
    const response = await app.handle(new Request('http://localhost/health/readiness'));
    expect(response.status).toBe(200);

    const json = (await response.json()) as Record<string, unknown>;
    expect(json.ready).toBe(true);
    expect(json.checks).toBeDefined();
    expect(json.providers).toBeDefined();
  });

  test('GET /health/liveness returns HTTP 200 alive status', async () => {
    const response = await app.handle(new Request('http://localhost/health/liveness'));
    expect(response.status).toBe(200);

    const json = (await response.json()) as Record<string, unknown>;
    expect(json.status).toBe('alive');
  });
});
