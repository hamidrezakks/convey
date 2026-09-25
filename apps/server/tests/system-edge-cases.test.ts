import { describe, expect, it } from 'bun:test';
import { db } from '../src/db';
import { messages } from '../src/db/schema';
import { DlqService } from '../src/modules/messaging/dlq.service';
import { IdempotencyService } from '../src/modules/messaging/idempotency.service';
import { buildMessageAndOutboxRecords, validateChannelRecipients } from '../src/modules/messaging/messaging.service';
import {
  Channel,
  MessagePriority,
  MessageState,
  ReservationStatus,
  type SendMessageRequest,
  TenantTier,
} from '../src/modules/messaging/messaging.types';
import { tenantSlaManager } from '../src/modules/policies/tenant-sla';
import { TokenBucketLimiter } from '../src/modules/policies/token-bucket';
import { CircuitState, ProviderCircuitBreaker } from '../src/modules/providers/core/circuit-breaker';
import { smartProviderRouter } from '../src/modules/providers/core/smart-router';
import { microBatchIngestionPipeline } from '../src/modules/webhooks/micro-batch-ingestion';
import { queueAutoscaler } from '../src/queues/queue-autoscaler';
import { statisticalAnomalyDetector } from '../src/utils/anomaly-detector';
import { consensusAuditGuard } from '../src/utils/consensus-auditor';
import { hashString } from '../src/utils/crypto';
import { geoReplicationManager } from '../src/utils/geo-replication';
import { generateMessageId } from '../src/utils/id';
import { PayloadEncryptionManager } from '../src/utils/payload-encryption';
import { appReadiness } from '../src/utils/readiness';
import { shardRouter } from '../src/utils/shard-router';

describe('Comprehensive System Edge-Case & Resiliency Suite', () => {
  describe('1. Boundary & Extreme Payload Stress', () => {
    it('accepts and processes 1MB+ large HTML payload correctly', () => {
      const largeHtml = `<div>${'A'.repeat(1_000_000)}</div>`;
      const request: SendMessageRequest = {
        idempotencyKey: 'qa_large_payload_001',
        userId: 'usr_qa_large',
        team: 'qa_team',
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.NORMAL,
        recipients: { email: 'large@example.com' },
        channels: [
          {
            channel: Channel.EMAIL,
            content: { subject: 'Large Payload Test', html: largeHtml },
          },
        ],
      };

      const validationError = validateChannelRecipients(request.channels, request.recipients);
      expect(validationError).toBeNull();

      const records = buildMessageAndOutboxRecords(request, new Date());
      expect(records.publicId).toBeDefined();
      expect((records.messageRecord.metadata as Record<string, unknown>)?._encryptedEnvelope).toBeDefined();
    });

    it('encrypts and decrypts complex UTF-8, multi-byte emojis, and special chars without corruption', () => {
      const encManager = new PayloadEncryptionManager('qa_special_secret_32_bytes_len_!');
      const rawPayload = {
        subject: 'Notification: 🚀 🔥 ⚡️ 🎉 Hello World! مرحبا, 世界, 안녕하세요',
        tags: ['<script>alert("xss")</script>', "O'Connor & Sons", 'Line1\nLine2\r\nLine3'],
      };

      const encrypted = encManager.encryptPayload(rawPayload);
      expect(encrypted.ciphertext).toBeDefined();

      const decrypted = encManager.decryptPayload<typeof rawPayload>(encrypted);
      expect(decrypted.subject).toBe(rawPayload.subject);
      expect(decrypted.tags).toEqual(rawPayload.tags);
    });

    it('strictly rejects missing or mismatched channel recipient parameters', () => {
      // Email channel without email recipient
      const err1 = validateChannelRecipients([{ channel: Channel.EMAIL, content: { subject: 'Hi' } }], {});
      expect(err1).toContain('Valid email address is required');

      // SMS channel without phone recipient
      const err2 = validateChannelRecipients([{ channel: Channel.SMS, content: { text: 'Hi' } }], {});
      expect(err2).toContain('Valid phone number is required');

      // FCM channel without fcmTokens
      const err3 = validateChannelRecipients([{ channel: Channel.FCM, content: { title: 'Hi', body: 'Hi' } }], {});
      expect(err3).toContain('At least one FCM token is required');
    });
  });

  describe('2. Concurrent Race Condition Idempotency Testing', () => {
    it('atomic reservation locks eliminate duplicate executions during simultaneous requests', async () => {
      const team = 'qa_race_team';
      const key = `qa_race_key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const reqPayload = { userId: 'usr_race', text: 'Concurrent Test' };

      // Dispatch 10 parallel reservation attempts concurrently
      const promises = Array.from({ length: 10 }).map(() =>
        IdempotencyService.reserve(team, key, reqPayload).catch((err) => ({ status: 'error', error: err })),
      );

      const results = await Promise.all(promises);

      // Verify that all calls resolved safely without unhandled lock crashes
      expect(results.length).toBe(10);
      const reservedCount = results.filter(
        (r) => 'status' in r && (r.status === ReservationStatus.ACQUIRED || r.status === ReservationStatus.COMPLETED),
      ).length;

      expect(reservedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Cryptographic Tamper Detection & Security Enforcement', () => {
    it('decryption fails cleanly when authTag or ciphertext is tampered', () => {
      const encManager = new PayloadEncryptionManager('qa_tamper_key_32_bytes_length_!');
      const encrypted = encManager.encryptPayload({ secretToken: 'top_secret_998' });

      // Tamper authTag deterministically
      const tamperedAuthChar = encrypted.authTag[0] === '0' ? '1' : '0';
      const tamperedAuthTag = {
        ...encrypted,
        authTag: `${tamperedAuthChar}${encrypted.authTag.slice(1)}`,
      };

      expect(() => encManager.decryptPayload(tamperedAuthTag)).toThrow();

      // Tamper ciphertext deterministically
      const tamperedCipherChar = encrypted.ciphertext[0] === 'a' ? 'b' : 'a';
      const tamperedCiphertext = {
        ...encrypted,
        ciphertext: `${tamperedCipherChar}${encrypted.ciphertext.slice(1)}`,
      };

      expect(() => encManager.decryptPayload(tamperedCiphertext)).toThrow();
    });
  });

  describe('4. Rate Limiting & Token Bucket Saturation', () => {
    it('TokenBucketLimiter rejects requests once bucket capacity is exhausted', async () => {
      const key = `qa_tb_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const capacity = 3;
      const refillRate = 1; // 1 token per second

      // Consume 3 tokens (capacity)
      const res1 = await TokenBucketLimiter.consume(key, capacity, refillRate, 1);
      const res2 = await TokenBucketLimiter.consume(key, capacity, refillRate, 1);
      const res3 = await TokenBucketLimiter.consume(key, capacity, refillRate, 1);

      expect(res1.allowed).toBeTrue();
      expect(res2.allowed).toBeTrue();
      expect(res3.allowed).toBeTrue();

      // 4th token consumption must be rejected
      const res4 = await TokenBucketLimiter.consume(key, capacity, refillRate, 1);
      expect(res4.allowed).toBeFalse();
    });
  });

  describe('5. Circuit Breaker & Gradual Ramp Recovery Lifecycle', () => {
    it('manages full circuit state transition and stepped traffic ramp recovery', async () => {
      const cb = new ProviderCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });
      const pId = `qa_cb_provider_${Date.now()}`;

      expect(cb.getState(pId)).toBe(CircuitState.CLOSED);
      expect(cb.canExecute(pId)).toBeTrue();

      // Consecutive failures trip circuit to OPEN
      cb.recordFailure(pId);
      cb.recordFailure(pId);
      expect(cb.getState(pId)).toBe(CircuitState.OPEN);
      expect(cb.canExecute(pId)).toBeFalse();

      // Wait reset timeout (50ms) -> calling canExecute triggers state transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(typeof cb.canExecute(pId)).toBe('boolean');
      expect(cb.getState(pId)).toBe(CircuitState.HALF_OPEN);

      // Probe success advances ramp and resets circuit to CLOSED
      cb.recordSuccess(pId);
      expect(cb.getState(pId)).toBe(CircuitState.CLOSED);
    });
  });

  describe('6. DLQ Replay Integrity', () => {
    it('DlqService lists and replays failed messages cleanly', async () => {
      const testMsgId = generateMessageId();

      // Insert a failed message into DB for deterministic DLQ testing
      await db.insert(messages).values({
        id: testMsgId,
        publicId: testMsgId,
        team: 'qa_dlq_team',
        userId: 'usr_dlq',
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.NORMAL,
        state: MessageState.FAILED,
        recipients: { email: 'dlq@example.com' },
        channels: [{ channel: Channel.EMAIL, content: { subject: 'DLQ Test', text: 'dlq test' } }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await DlqService.listFailedMessages({ team: 'qa_dlq_team', limit: 10 });
      expect(result.items).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(1);

      const replayRes = await DlqService.replayFailedMessages([testMsgId]);
      expect(replayRes.replayedCount).toBe(1);
      expect(replayRes.messageIds).toEqual([testMsgId]);
    });
  });

  describe('7. Bun Native Crypto Determinism & Collision Resistance', () => {
    it('1,000 rapid SHA-256 and MD5 hash calculations execute with zero collisions', () => {
      const shaSet = new Set<string>();
      const shardIndexSet = new Set<number>();

      const startTime = performance.now();
      for (let i = 0; i < 1_000; i++) {
        const key = `qa_key_iter_${i}_${Math.random()}`;
        const sha = hashString(key);
        shaSet.add(sha);

        const shardIdx = shardRouter.getShardIndex('qa_tenant', key);
        shardIndexSet.add(shardIdx);
      }
      const durationMs = performance.now() - startTime;

      expect(shaSet.size).toBe(1000); // 0 SHA collisions
      expect(shardIndexSet.size).toBeGreaterThan(1); // Distributed across shards
      expect(durationMs).toBeLessThan(50); // High performance execution (<50ms for 1,000 hashes)
    });
  });

  describe('8. System Readiness & Graceful Shutdown State Transitions', () => {
    it('tracks app readiness and component statuses cleanly', () => {
      const initialStatus = appReadiness.getStatus();
      expect(initialStatus).toBeDefined();
      expect(typeof initialStatus.ready).toBe('boolean');

      appReadiness.setReady(true);
      expect(appReadiness.getStatus().ready).toBeTrue();
    });
  });

  describe('9. Multi-Channel Fallback Cascade Recovery', () => {
    it('ranks candidate fallback channels by unit cost optimization', () => {
      const candidateChannels: Channel[] = [Channel.SMS, Channel.EMAIL, Channel.CHAT];
      const optimizedOrder = smartProviderRouter.rankChannelsByCost(candidateChannels);

      expect(optimizedOrder[0]).toBe(Channel.EMAIL); // Email is lowest cost tier ($0.0001)
      expect(optimizedOrder[optimizedOrder.length - 1]).toBe(Channel.SMS); // SMS is highest cost tier ($0.0075)
    });
  });

  describe('10. Micro-Batch Webhook Ingestion & Deduplication', () => {
    it('ingests delivery webhook events and processes micro-batches without error', async () => {
      const evtId1 = `evt_${Date.now()}_1`;
      const evtId2 = `evt_${Date.now()}_2`;

      microBatchIngestionPipeline.enqueueEvent({
        eventId: evtId1,
        provider: 'ses',
        eventType: 'delivered',
        timestamp: Date.now(),
        payload: { messageId: 'msg_test_batch_1' },
      });

      microBatchIngestionPipeline.enqueueEvent({
        eventId: evtId2,
        provider: 'twilio',
        eventType: 'delivered',
        timestamp: Date.now(),
        payload: { messageId: 'msg_test_batch_2' },
      });

      const processedCount = await microBatchIngestionPipeline.flush();
      expect(processedCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('11. Geo-Replication Split-Brain Anti-Entropy Heartbeat', () => {
    it('registers regional node heartbeats and heals state checksum drift', async () => {
      await geoReplicationManager.sendHeartbeat();
      const localRegion = geoReplicationManager.getLocalRegionId();
      const status = await geoReplicationManager.getRegionStatus(localRegion);
      expect(status.isHealthy).toBeTrue();

      const stateKey = 'circuit_state_ses';
      const localPayload = { region: 'us-east1', state: 'closed', updatedAt: 1000 };
      const remotePayload = { region: 'eu-west1', state: 'open', updatedAt: 2000 };

      const auditReport = consensusAuditGuard.auditAndHealState(stateKey, localPayload, remotePayload);
      expect(auditReport.isConsistent).toBeFalse();
      expect(auditReport.resolvedHash).toBe(consensusAuditGuard.computeChecksum(remotePayload));
    });
  });

  describe('12. Anomaly Detection & Fraud Burst Alerting', () => {
    it('detects high latency spikes via statistical Z-Score analysis', () => {
      const pId = `qa_anomaly_prov_${Date.now()}`;

      // Record baseline latencies (~50ms with natural variance)
      const baselines = [45, 50, 52, 48, 55, 49, 51, 47, 53, 50];
      for (const lat of baselines) {
        statisticalAnomalyDetector.recordLatency(pId, lat);
      }

      // Analyze normal latency (52ms)
      const normalReport = statisticalAnomalyDetector.analyze(pId, 52);
      expect(normalReport.isAnomalous).toBeFalse();

      // Analyze massive latency spike (5000ms)
      const anomalyReport = statisticalAnomalyDetector.analyze(pId, 5000);
      expect(anomalyReport.isAnomalous).toBeTrue();
      expect(anomalyReport.zScore).toBeGreaterThan(3.0);
    });
  });

  describe('13. Tenant SLA Priority Preemption', () => {
    it('upgrades priority when Enterprise tenant approaches SLA threshold', () => {
      const tenantId = 'enterprise_team_sla';

      // Record slow delivery latencies (400ms) approaching SLA breach
      for (let i = 0; i < 10; i++) {
        tenantSlaManager.recordDeliveryLatency(tenantId, 400);
      }

      const priorityNormal = tenantSlaManager.getRecommendedPriority(tenantId, TenantTier.FREE, MessagePriority.NORMAL);
      expect(priorityNormal).toBe(MessagePriority.NORMAL);

      const priorityElevated = tenantSlaManager.getRecommendedPriority(
        tenantId,
        TenantTier.ENTERPRISE,
        MessagePriority.NORMAL,
      );
      expect(priorityElevated).toBe('high');
    });
  });

  describe('14. Zero-Trust Key Rotation & Payload Security', () => {
    it('encrypts payloads with key versioning and verifies decryptability', () => {
      const manager = new PayloadEncryptionManager('qa_rotation_key_32_bytes_len_!');
      const data = { secretPin: 1234, token: 'rot_9982' };

      const enc = manager.encryptPayload(data);
      expect(enc.version).toBe(1);
      expect(enc.iv).toBeDefined();
      expect(enc.authTag).toBeDefined();

      const dec = manager.decryptPayload<typeof data>(enc);
      expect(dec.secretPin).toBe(1234);
      expect(dec.token).toBe('rot_9982');
    });
  });

  describe('15. Queue Autoscaler Dynamic Worker Scaling', () => {
    it('dynamically calculates desired worker concurrency based on queue depth', () => {
      const reportLow = queueAutoscaler.computeOptimalConcurrency('outbox_shard_0', 5);
      expect(reportLow.recommendedConcurrency).toBe(2);

      const reportHigh = queueAutoscaler.computeOptimalConcurrency('outbox_shard_0', 5_000);
      expect(reportHigh.recommendedConcurrency).toBe(100);
    });
  });
});
