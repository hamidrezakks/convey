import { describe, expect, it } from 'bun:test';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { Channel, MessagePriority, type SendMessageRequest } from '../src/modules/messaging/messaging.types';
import { generateMessageId } from '../src/utils/id';
import { PayloadEncryptionManager } from '../src/utils/payload-encryption';

describe('Acceptance, IDs and encryption latency benchmarks', () => {
  it('benchmark synchronous send acceptance latency SLA (p95 < 25ms)', async () => {
    const iterations = 50;
    const latenciesMs: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const request: SendMessageRequest = {
        idempotencyKey: `qa_perf_${Date.now()}_${i}`,
        userId: `usr_perf_${i}`,
        team: 'perf_team',
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.NORMAL,
        recipients: { email: `perf_${i}@example.com` },
        channels: [
          {
            channel: Channel.EMAIL,
            content: { subject: 'Perf SLA Test', text: 'Benchmarking synchronous acceptance' },
          },
        ],
      };

      const start = performance.now();
      const response = await MessagingService.acceptMessage(request);
      const latency = performance.now() - start;

      expect(response.statusCode).toBe(202);
      latenciesMs.push(latency);
    }

    latenciesMs.sort((a, b) => a - b);
    const p50 = latenciesMs[Math.floor(iterations * 0.5)];
    const p95 = latenciesMs[Math.floor(iterations * 0.95)];

    expect(p50).toBeGreaterThan(0);
    expect(p95).toBeLessThan(25.0); // p95 acceptance latency <25ms
  });

  it('generates 1,000 rapid ULID message IDs with 0 collisions and monotonic sorting', () => {
    const count = 1_000;
    const ids: string[] = new Array(count);

    const start = performance.now();
    for (let i = 0; i < count; i++) {
      ids[i] = generateMessageId();
    }
    const durationMs = performance.now() - start;

    expect(durationMs).toBeLessThan(50); // 1,000 ULIDs generated in <50ms

    // Collision check
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(count);

    // Monotonic prefix check
    for (let i = 1; i < count; i++) {
      expect(ids[i] >= ids[i - 1]).toBeTrue();
    }
  });

  it('envelope encryption overhead SLA is < 1.0ms per message over 500 iterations', () => {
    const encManager = new PayloadEncryptionManager('qa_perf_secret_key_32_bytes_ok!');
    const payload = {
      subject: 'Large Performance Payload',
      body: 'Testing AES-256-GCM envelope encryption overhead SLA under continuous throughput',
      metadata: { tenant: 'enterprise_qa', version: 2 },
    };

    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const encrypted = encManager.encryptPayload(payload);
      const decrypted = encManager.decryptPayload(encrypted);
      expect(decrypted).toBeDefined();
    }

    const totalMs = performance.now() - start;
    const avgMs = totalMs / iterations;

    expect(avgMs).toBeLessThan(1.0); // <1.0ms per encrypt+decrypt cycle
  });
});
