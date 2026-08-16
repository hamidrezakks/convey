import { describe, expect, it } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { costOptimizationEngine } from '../src/modules/policies/cost-optimizer';
import { LeakyBucketGovernor } from '../src/modules/policies/leaky-bucket';
import { PolicyEngine } from '../src/modules/policies/policy-engine';
import { CircuitState, ProviderCircuitBreaker } from '../src/modules/providers/core/circuit-breaker';
import { gradualRampController } from '../src/modules/providers/core/gradual-ramp';
import { smartProviderRouter } from '../src/modules/providers/core/smart-router';
import { AdaptiveConcurrencyController } from '../src/utils/adaptive-concurrency';
import { byteBufferPool } from '../src/utils/buffer-pool';
import { chaosEngine } from '../src/utils/chaos-engine';
import { consensusAuditGuard } from '../src/utils/consensus-auditor';
import { FullJitterRetry } from '../src/utils/full-jitter-retry';
import { heapMemoryGuard } from '../src/utils/heap-guard';
import { payloadEncryptionManager } from '../src/utils/payload-encryption';
import { shardRouter } from '../src/utils/shard-router';

describe('Advanced Utilities & System Integration Suite', () => {
  it('1. AdaptiveConcurrencyController dynamically scales concurrency based on EMA latency', () => {
    const controller = new AdaptiveConcurrencyController({
      minConcurrency: 2,
      maxConcurrency: 20,
      targetLatencyMs: 100,
    });

    expect(controller.getConcurrency()).toBe(10);

    // Record low latency -> concurrency should gradually scale up
    for (let i = 0; i < 15; i++) {
      controller.recordExecution(30);
    }
    expect(controller.getConcurrency()).toBeGreaterThan(10);

    // Record high latency spike -> concurrency should scale down
    for (let i = 0; i < 15; i++) {
      controller.recordExecution(400);
    }
    expect(controller.getConcurrency()).toBeLessThan(20);
  });

  it('2. byteBufferPool acquires and releases pre-allocated buffers cleanly', () => {
    const initialCount = byteBufferPool.getAvailableCount();
    const buf1 = byteBufferPool.acquire();

    expect(buf1).toBeDefined();
    expect(buf1.length).toBe(64 * 1024);

    byteBufferPool.release(buf1);
    expect(byteBufferPool.getAvailableCount()).toBeGreaterThanOrEqual(initialCount);
  });

  it('3. PayloadEncryptionManager uses pooled buffers and encrypts/decrypts correctly', () => {
    const rawData = { userId: 'usr_test', secretPin: '9912' };
    const encrypted = payloadEncryptionManager.encryptPayload(rawData);

    expect(encrypted.version).toBe(1);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();

    const decrypted = payloadEncryptionManager.decryptPayload<typeof rawData>(encrypted);
    expect(decrypted.userId).toBe('usr_test');
    expect(decrypted.secretPin).toBe('9912');
  });

  it('4. ChaosEngine injects simulated fault injection when enabled', async () => {
    chaosEngine.disable();
    expect(chaosEngine.isEnabled()).toBeFalse();
    await expect(chaosEngine.executeFaultInjection('test-target')).resolves.toBeUndefined();

    chaosEngine.configure({ enabled: true, latencyMinMs: 1, latencyMaxMs: 5, failureRate: 1.0 });
    expect(chaosEngine.isEnabled()).toBeTrue();
    await expect(chaosEngine.executeFaultInjection('test-target')).rejects.toThrow('[ChaosEngine]');

    chaosEngine.disable();
  });

  it('5. ConsensusAuditGuard computes checksums and resolves anti-entropy state drift', () => {
    const payloadA = { state: 'closed', provider: 'ses', updatedAt: 1000 };
    const payloadB = { state: 'closed', provider: 'ses', updatedAt: 1000 };
    const checksumA = consensusAuditGuard.computeChecksum(payloadA);
    const checksumB = consensusAuditGuard.computeChecksum(payloadB);

    expect(checksumA).toBe(checksumB);

    const reportMatch = consensusAuditGuard.auditAndHealState('ses_state', payloadA, payloadB);
    expect(reportMatch.isConsistent).toBeTrue();

    const payloadDrift = { state: 'open', provider: 'ses', updatedAt: 2000 };
    const reportDrift = consensusAuditGuard.auditAndHealState('ses_state', payloadA, payloadDrift);

    expect(reportDrift.isConsistent).toBeFalse();
    expect(reportDrift.resolvedHash).toBe(consensusAuditGuard.computeChecksum(payloadDrift));
  });

  it('6. FullJitterRetry calculates randomized backoff within bounds', () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const backoff = FullJitterRetry.calculateBackoffMs(attempt, 1000, 30000);
      expect(backoff).toBeGreaterThanOrEqual(500);
      expect(backoff).toBeLessThanOrEqual(30000);
    }
  });

  it('7. HeapMemoryGuard inspects process memory utilization', () => {
    const status = heapMemoryGuard.getStatus();
    expect(status.heapUsedBytes).toBeGreaterThan(0);
    expect(status.heapTotalBytes).toBeGreaterThan(0);
    expect(status.heapUtilization).toBeGreaterThanOrEqual(0.0);
    expect(status.heapUtilization).toBeLessThanOrEqual(1.0);
    expect(typeof heapMemoryGuard.shouldThrottle()).toBe('boolean');
  });

  it('8. ConsistentHashShardRouter maps keys to deterministic shard indices and queue names', () => {
    const shardIndex1 = shardRouter.getShardIndex('payments', 'msg_01HQ1');
    const shardIndex2 = shardRouter.getShardIndex('payments', 'msg_01HQ1');
    expect(shardIndex1).toBe(shardIndex2);
    expect(shardIndex1).toBeGreaterThanOrEqual(0);
    expect(shardIndex1).toBeLessThan(16);

    const queueName = shardRouter.getShardQueueName('payments', 'msg_01HQ1');
    expect(queueName).toBe(`outbox_shard_${shardIndex1}`);
  });

  it('9. CostOptimizationEngine estimates unit costs and ranks channels', () => {
    const estimates = costOptimizationEngine.estimateCosts([Channel.SMS, Channel.EMAIL, Channel.CHAT]);
    expect(estimates.length).toBe(3);

    const ranked = costOptimizationEngine.optimizeChannelSequence([Channel.SMS, Channel.EMAIL, Channel.CHAT]);
    expect(ranked[0]).toBe(Channel.EMAIL); // Lowest cost first
    expect(ranked[ranked.length - 1]).toBe(Channel.SMS); // Highest cost last

    const routerRanked = smartProviderRouter.rankChannelsByCost([Channel.SMS, Channel.EMAIL, Channel.CHAT]);
    expect(routerRanked).toEqual(ranked);
  });

  it('10. GradualRampController & ProviderCircuitBreaker manage stepped traffic recovery', () => {
    const cb = new ProviderCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });
    const pId = 'test_ramp_provider';

    cb.recordFailure(pId);
    cb.recordFailure(pId);
    expect(cb.getState(pId)).toBe(CircuitState.OPEN);

    // Reset ramp for provider
    gradualRampController.resetRamp(pId);
    const status1 = gradualRampController.advanceRamp(pId);
    expect(status1.step).toBe(1);
    expect(status1.admitPercentage).toBe(20);

    cb.recordSuccess(pId);
    expect(cb.getState(pId)).toBe(CircuitState.CLOSED);
  });

  it('11. LeakyBucketGovernor and TokenBucketLimiter handle rate micro-pacing', async () => {
    const leakyRes = await LeakyBucketGovernor.acquireSlot('test_leaky_p1', 100);
    expect(leakyRes.allowed).toBeTrue();
    expect(leakyRes.currentCount).toBeGreaterThanOrEqual(1);

    const tokenRes = await PolicyEngine.checkTokenBucket('test_team_bucket', 100, 10, 1);
    expect(tokenRes.allowed).toBeTrue();
    expect(tokenRes.remainingTokens).toBeGreaterThanOrEqual(0);
  });
});
