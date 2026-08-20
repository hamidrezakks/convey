import { describe, expect, it } from 'bun:test';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { Channel, MessagePriority, type SendMessageRequest } from '../src/modules/messaging/messaging.types';
import { microBatchIngestionPipeline } from '../src/modules/webhooks/micro-batch-ingestion';
import { byteBufferPool } from '../src/utils/buffer-pool';
import { chaosEngine } from '../src/utils/chaos-engine';
import { consensusAuditGuard } from '../src/utils/consensus-auditor';
import { appReadiness } from '../src/utils/readiness';

describe('Chaos, Concurrency & High-Throughput Stress Suite', () => {
  it('executes 500 parallel request burst across 10 teams with zero deadlocks', async () => {
    const totalRequests = 500;
    const requests: SendMessageRequest[] = [];

    for (let i = 0; i < totalRequests; i++) {
      const teamId = `qa_stress_team_${i % 10}`;
      requests.push({
        idempotencyKey: `qa_burst_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        userId: `usr_stress_${i}`,
        team: teamId,
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.NORMAL,
        recipients: { email: `user${i}@stress.test` },
        channels: [
          {
            channel: Channel.EMAIL,
            content: { subject: `Burst Message ${i}`, text: 'Stress testing Convey pipeline' },
          },
        ],
      });
    }

    const startTime = performance.now();
    const results = await Promise.all(
      requests.map((req) => MessagingService.acceptMessage(req).catch((err) => ({ status: 'error', error: err }))),
    );
    const durationMs = performance.now() - startTime;

    expect(results.length).toBe(totalRequests);
    const successful = results.filter((r) => 'statusCode' in r && r.statusCode === 202);
    expect(successful.length).toBe(totalRequests);
    expect(durationMs).toBeLessThan(10_000); // 500 messages accepted in <10s
  });

  it('absorbs 20% simulated network fault injection via ChaosEngine cleanly', async () => {
    chaosEngine.configure({
      enabled: true,
      latencyMinMs: 2,
      latencyMaxMs: 10,
      failureRate: 0.2, // 20% failure rate
    });

    expect(chaosEngine.isEnabled()).toBeTrue();

    let errorCount = 0;
    let successCount = 0;

    for (let i = 0; i < 50; i++) {
      try {
        await chaosEngine.executeFaultInjection(`qa_provider_target_${i % 5}`);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    expect(successCount + errorCount).toBe(50);
    expect(errorCount).toBeGreaterThan(0); // Fault injection triggered errors

    chaosEngine.disable();
    expect(chaosEngine.isEnabled()).toBeFalse();
  });

  it('saturation stress against ByteBufferPool maintains zero pool corruption', () => {
    const initialAvailable = byteBufferPool.getAvailableCount();
    const acquiredBuffers: Buffer[] = [];

    // Rapidly acquire 100 buffers
    for (let i = 0; i < 100; i++) {
      const buf = byteBufferPool.acquire();
      expect(buf).toBeDefined();
      expect(buf.length).toBe(64 * 1024);
      acquiredBuffers.push(buf);
    }

    // Release all acquired buffers back to pool
    for (const buf of acquiredBuffers) {
      byteBufferPool.release(buf);
    }

    const finalAvailable = byteBufferPool.getAvailableCount();
    expect(finalAvailable).toBeGreaterThanOrEqual(initialAvailable);
  });

  it('heals active-active cross-region split-brain state drift via vector clock ordering', () => {
    const stateKey = 'circuit_state_twilio';
    const localRegionPayload = {
      region: 'us-east1',
      providerId: 'twilio',
      state: 'closed',
      updatedAt: 1000,
    };
    const remoteRegionPayload = {
      region: 'eu-west1',
      providerId: 'twilio',
      state: 'open',
      updatedAt: 2500, // Newer timestamp
    };

    const auditReport = consensusAuditGuard.auditAndHealState(stateKey, localRegionPayload, remoteRegionPayload);

    expect(auditReport.isConsistent).toBeFalse();
    expect(auditReport.resolvedHash).toBe(consensusAuditGuard.computeChecksum(remoteRegionPayload));
  });

  it('MicroBatchIngestion Pipeline flushes 250 delivery receipt events at high velocity', async () => {
    for (let i = 0; i < 250; i++) {
      microBatchIngestionPipeline.enqueueEvent({
        eventId: `evt_qa_stress_${i}`,
        provider: i % 2 === 0 ? 'ses' : 'twilio',
        eventType: 'delivered',
        timestamp: Date.now(),
        payload: { messageId: `msg_stress_${i}` },
      });
    }

    const flushedCount = await microBatchIngestionPipeline.flush();
    expect(flushedCount).toBe(250);
  });

  it('validates readiness probe flipping during graceful worker drain', () => {
    appReadiness.setReady(true);
    expect(appReadiness.getStatus().ready).toBeTrue();

    appReadiness.setReady(false);
    expect(appReadiness.getStatus().ready).toBeFalse();

    appReadiness.setReady(true); // Reset to ready
  });
});
