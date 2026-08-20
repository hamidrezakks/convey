import { eq } from 'drizzle-orm';
import { db, queryClient } from './db';
import { ensureMonthlyPartitions, startPartitionMaintenanceLoop } from './db/partitions';
import { providers } from './db/schema';
import { ProviderRegistry, startProviderSelfHealingLoop } from './modules/providers/core/provider-registry';
import { selfHealingEngine } from './modules/providers/core/self-healing';
import { startMetricsFlusher } from './modules/reports/reporting.service';
import { redisClient } from './queues/connection';
import { listenProviderConfigUpdates, setupConfiguredProviderWorkers } from './queues/provider-queues';
import { startOutboxPruneLoop, startOutboxRelayLoop } from './queues/workers/outbox-relay.worker';
import { startScheduledPromoterLoop } from './queues/workers/scheduled-promoter.worker';
import { consensusAuditGuard } from './utils/consensus-auditor';
import { geoReplicationManager } from './utils/geo-replication';
import { logger } from './utils/logger';
import { decryptProviderCredentials } from './utils/payload-encryption';
import { appReadiness, ComponentStatus, PartitionStatus, WorkerState } from './utils/readiness';
import { shutdownOrchestrator } from './utils/shutdown';

let isBootstrapped = false;
let shutdownRegistered = false;

export async function bootstrapService(): Promise<void> {
  if (isBootstrapped) return;
  logger.info('Bootstrap', 'Initializing Convey Communication Service...');

  // 1. Database Connection & Table Partitions
  try {
    await queryClient.unsafe('SELECT 1');
    appReadiness.setDbStatus(ComponentStatus.CONNECTED);
    logger.info('Bootstrap', 'Database connection established');

    await ensureMonthlyPartitions();
    appReadiness.setPartitionsStatus(PartitionStatus.READY);
    logger.info('Bootstrap', 'Postgres monthly partition boundaries verified');
  } catch (err: unknown) {
    appReadiness.setDbStatus(ComponentStatus.ERROR);
    logger.error('Bootstrap', 'Database connection / partition check failed', { error: (err as Error).message });
    throw err;
  }

  // 2. Redis Connection
  try {
    await redisClient.ping();
    appReadiness.setRedisStatus(ComponentStatus.CONNECTED);
    logger.info('Bootstrap', 'Redis connection verified');
  } catch (err: unknown) {
    appReadiness.setRedisStatus(ComponentStatus.ERROR);
    logger.error('Bootstrap', 'Redis initialization failed', { error: (err as Error).message });
    throw err;
  }

  // 3. Provider Setup Scan & Worker Pre-registration from PostgreSQL
  let configMap: Record<string, Record<string, unknown>> | undefined;
  try {
    const dbProviders = await db.select().from(providers).where(eq(providers.enabled, true));
    configMap = {};
    for (const p of dbProviders) {
      const creds = decryptProviderCredentials(p.credentials);
      const cfg = (p.config as Record<string, unknown>) || {};
      configMap[p.id] = { ...cfg, ...creds };
    }
  } catch (err: unknown) {
    logger.warn('Bootstrap', 'Could not fetch provider setup from DB table', { error: (err as Error).message });
  }

  const configuredProviders = ProviderRegistry.getConfiguredProviders(configMap);
  const byChannel: Record<string, string[]> = {};
  for (const item of configuredProviders) {
    await ProviderRegistry.initializeProvider(item.providerId, configMap?.[item.providerId]);
    if (!byChannel[item.channel]) {
      byChannel[item.channel] = [];
    }
    byChannel[item.channel].push(item.providerId);
  }

  appReadiness.setConfiguredProviders(configuredProviders.length, byChannel);
  logger.info('Bootstrap', `Provider setup scan complete: ${configuredProviders.length} configured providers active`, {
    configuredByChannel: byChannel,
  });

  setupConfiguredProviderWorkers(configMap);
  listenProviderConfigUpdates();

  // 4. Background Loops
  if (process.env.NODE_ENV !== 'test') {
    startOutboxRelayLoop();
    startOutboxPruneLoop();
    appReadiness.setActiveWorker('outboxRelay', WorkerState.RUNNING);

    startScheduledPromoterLoop();
    appReadiness.setActiveWorker('scheduledPromoter', WorkerState.RUNNING);

    startMetricsFlusher();
    startPartitionMaintenanceLoop();

    startProviderSelfHealingLoop();
    selfHealingEngine.startSelfHealingLoop();
    geoReplicationManager.startHeartbeatLoop();
    consensusAuditGuard.auditAndHealState(
      'cluster_consensus_init',
      { region: 'primary', status: 'active', updatedAt: Date.now() },
      { region: 'secondary', status: 'active', updatedAt: Date.now() },
    );
    appReadiness.setActiveWorker('providerSelfHealing', WorkerState.RUNNING);

    logger.info(
      'Bootstrap',
      'Started outbox relay, outbox pruner, scheduled promoter, metrics flusher, partition maintenance, self-healing, geo-replication, and consensus audit loops',
    );
  }

  // 5. Graceful Shutdown Signal Registration
  if (!shutdownRegistered && process.env.NODE_ENV !== 'test') {
    shutdownRegistered = true;
    shutdownOrchestrator.registerSignalListeners();
  }

  isBootstrapped = true;
  appReadiness.setReady(true);
  logger.info('Bootstrap', 'Convey Service bootstrap complete. Ready to receive traffic.');
}
