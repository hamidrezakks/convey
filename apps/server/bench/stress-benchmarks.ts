import { MessagingService } from '../src/modules/messaging/messaging.service';
import { Channel, MessagePriority } from '../src/modules/messaging/messaging.types';
import { TokenBucketLimiter } from '../src/modules/policies/token-bucket';
import { ProviderCircuitBreaker } from '../src/modules/providers/core/circuit-breaker';
import { MicroBatchIngestionPipeline } from '../src/modules/webhooks/micro-batch-ingestion';
import { processOutboxBatchForShard } from '../src/queues/workers/outbox-relay.worker';
import { DeficitWeightedRoundRobinScheduler } from '../src/utils/drr-scheduler';
import { payloadEncryptionManager } from '../src/utils/payload-encryption';
import { seedDatabaseWithRealisticData } from '../tests/helpers/db-seeder';
import { enableProviderMock } from '../tests/mocks/provider-mock';
import { BenchmarkSuite } from './bench-harness';

/**
 * Calculates Jain's Fairness Index for a set of tenant allocation counts.
 * J(x) = (sum(x_i))^2 / (n * sum(x_i^2))
 */
export function calculateJainsFairnessIndex(allocations: number[]): number {
  if (allocations.length === 0) return 1.0;
  const n = allocations.length;
  const sum = allocations.reduce((acc, val) => acc + val, 0);
  const sumSq = allocations.reduce((acc, val) => acc + val * val, 0);
  if (sumSq === 0) return 1.0;
  return Number(((sum * sum) / (n * sumSq)).toFixed(4));
}

export async function createStressBenchmarkSuite(): Promise<BenchmarkSuite> {
  enableProviderMock(0.0);
  await seedDatabaseWithRealisticData();

  const suite = new BenchmarkSuite('Convey Planetary-Scale Concurrency & Stress Benchmarks');

  // 1. Thundering Herd Hot-Key Race Condition (100 Concurrent Promises per iteration)
  let thSeq = 0;
  suite.add(
    'Thundering Herd Hot-Key Contention [100 Concurrent Contenders / Iteration]',
    async () => {
      thSeq++;
      const sharedKey = `bench_th_herd_${thSeq}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const requestPayload = {
        idempotencyKey: sharedKey,
        userId: 'usr_th_shared',
        team: 'payments',
        category: 'otp',
        country: 'AE',
        priority: MessagePriority.CRITICAL,
        recipients: { phone: '+971501234567' },
        channels: [{ channel: Channel.SMS, content: { text: 'Your OTP is 998877' } }],
      };
      const promises = Array.from({ length: 50 }).map(() => MessagingService.acceptMessage(requestPayload));

      const responses = await Promise.all(promises);
      for (const res of responses) {
        if (res.statusCode !== 202) {
          throw new Error(`Expected 202, got status ${res.statusCode}`);
        }
      }
    },
    { category: 'Planetary Stress & Chaos', iterations: 10, warmupIterations: 2 },
  );

  // 2. Multi-Tenant DRR Fair-Share Saturation (3,000 Tasks across 300 Tenants)
  const drrScheduler = new DeficitWeightedRoundRobinScheduler<string>();
  suite.add(
    'DRR Multi-Tenant Quantum Saturation [3,000 Tasks across 300 Tenants]',
    () => {
      for (let t = 0; t < 100; t++) {
        drrScheduler.enqueue({
          id: `ent_task_${t}`,
          tenantId: `tenant_ent_${t}`,
          tier: 'enterprise',
          payload: 'ent_data',
        });
        drrScheduler.enqueue({
          id: `pro_task_${t}`,
          tenantId: `tenant_pro_${t}`,
          tier: 'pro',
          payload: 'pro_data',
        });
        drrScheduler.enqueue({
          id: `free_task_${t}`,
          tenantId: `tenant_free_${t}`,
          tier: 'free',
          payload: 'free_data',
        });
      }
      drrScheduler.dequeueBatch(300);
    },
    { category: 'Planetary Stress & Chaos', iterations: 200, warmupIterations: 20 },
  );

  // 3. Downstream Provider Avalanche & Circuit Breaker Trip
  const breaker = new ProviderCircuitBreaker({
    failureThreshold: 5,
    resetTimeoutMs: 1000,
  });
  let breakerSeq = 0;
  suite.add(
    'Circuit Breaker Avalanche Trip & Failover [100% Downstream Outage]',
    () => {
      breakerSeq++;
      const pId = `stress_provider_${breakerSeq}`;
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure(pId);
      }
      if (breaker.canExecute(pId)) {
        throw new Error('Breaker failed to trip to OPEN state');
      }
      breaker.recordSuccess(pId);
    },
    { category: 'Planetary Stress & Chaos', iterations: 1000, warmupIterations: 100 },
  );

  // 4. Redis Lua Atomic Token Bucket Distributed Contention (100 Concurrent Threads)
  let tbContentionSeq = 0;
  suite.add(
    'Redis Lua Token Bucket Contention [100 Concurrent Worker Threads]',
    async () => {
      tbContentionSeq++;
      const bucketKey = `bench_stress_tb_${tbContentionSeq % 5}`;
      const promises = Array.from({ length: 100 }).map(() => TokenBucketLimiter.consume(bucketKey, 500, 100, 1));
      await Promise.all(promises);
    },
    { category: 'Planetary Stress & Chaos', iterations: 20, warmupIterations: 2 },
  );

  // 5. High-Throughput Webhook Micro-Batch Ingestion (1,000 Events Burst)
  const webhookPipeline = new MicroBatchIngestionPipeline({ batchSize: 500, flushIntervalMs: 50 });
  let microBatchSeq = 0;
  suite.add(
    'Webhook Micro-Batch Ingestion Burst [1,000 Delivery Events / Burst]',
    async () => {
      microBatchSeq++;
      for (let i = 0; i < 1000; i++) {
        webhookPipeline.enqueueEvent({
          eventId: `evt_stress_${microBatchSeq}_${i}`,
          provider: i % 2 === 0 ? 'sendgrid' : 'twilio',
          eventType: 'delivered',
          timestamp: Date.now(),
          payload: { messageId: `msg_${microBatchSeq}_${i}`, channel: 'email' },
        });
      }
      await webhookPipeline.flush();
    },
    { category: 'Planetary Stress & Chaos', iterations: 20, warmupIterations: 2 },
  );

  // 6. Zero-Trust AES-256-GCM Envelope Encryption Under High Concurrency
  const piiData = {
    patientName: 'Jane Smith',
    medicalRecordNumber: 'MRN-887799',
    diagnosis: 'Cardiovascular checkup completed',
    prescriptions: ['Amoxicillin 500mg', 'Vitamin D3', 'Metformin 850mg'],
    insurance: { policy: 'POL-998822', group: 'GRP-1122' },
  };
  suite.add(
    'AES-256-GCM Envelope Encryption [100 Concurrent Key Derivations]',
    () => {
      for (let i = 0; i < 100; i++) {
        const enc = payloadEncryptionManager.encryptPayload(piiData, `usr_stress_${i}`);
        payloadEncryptionManager.decryptPayload(enc);
      }
    },
    { category: 'Planetary Stress & Chaos', iterations: 50, warmupIterations: 5 },
  );

  // 7. Outbox Virtual Shard Concurrent Processing (16 Virtual Shards)
  suite.add(
    'Outbox Virtual Shards Processing [16 Shards Concurrent FOR UPDATE SKIP LOCKED]',
    async () => {
      const shardPromises = Array.from({ length: 16 }).map((_, shardId) => processOutboxBatchForShard(shardId, 25));
      await Promise.all(shardPromises);
    },
    { category: 'Planetary Stress & Chaos', iterations: 20, warmupIterations: 2 },
  );

  return suite;
}
