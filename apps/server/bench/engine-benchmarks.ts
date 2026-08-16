import { IdempotencyService } from '../src/modules/messaging/idempotency.service';
import { TokenBucketLimiter } from '../src/modules/policies/token-bucket';
import { byteBufferPool } from '../src/utils/buffer-pool';
import { DlpScanner } from '../src/utils/dlp-scanner';
import { DeficitWeightedRoundRobinScheduler } from '../src/utils/drr-scheduler';
import { payloadEncryptionManager } from '../src/utils/payload-encryption';
import { TraceContext } from '../src/utils/trace-context';
import { BenchmarkSuite } from './bench-harness';

export function createEngineBenchmarkSuite(): BenchmarkSuite {
  const suite = new BenchmarkSuite('Convey Subsystem Micro-Engine Benchmarks');

  // 1. Idempotency Service 1-RTT Reservation
  let idemSeq = 0;
  suite.add(
    'IdempotencyService.reserve() [Redis SET NX Fast-Path]',
    async () => {
      idemSeq++;
      await IdempotencyService.reserve('payments', `bench_idem_${idemSeq}_${Date.now()}`, {
        userId: `usr_${idemSeq}`,
        amount: 100,
      });
    },
    { category: 'Core Engines', iterations: 200, warmupIterations: 20 },
  );

  // 2. DLP Scanner PII Sanitization
  const samplePiiText =
    'Customer John Doe (SSN: 123-45-6789) paid with Visa card 4111 2222 3333 1111. Verification OTP is 889900. API key: sk_live_998877665544332211001122';
  suite.add(
    'DlpScanner.sanitize() [CreditCard, SSN, OTP, API Key Redaction]',
    () => {
      DlpScanner.sanitize(samplePiiText);
    },
    { category: 'Core Engines', iterations: 1000, warmupIterations: 100 },
  );

  // 3. Token Bucket Limiter (Atomic Redis Lua)
  let tbSeq = 0;
  suite.add(
    'TokenBucketLimiter.consume() [Redis Lua Atomic Rate Smoothing]',
    async () => {
      tbSeq++;
      await TokenBucketLimiter.consume(`bench_tb_${tbSeq % 10}`, 1000, 100, 1);
    },
    { category: 'Core Engines', iterations: 200, warmupIterations: 20 },
  );

  // 4. Deficit Weighted Round Robin (DRR) Scheduler
  const scheduler = new DeficitWeightedRoundRobinScheduler<string>();
  suite.add(
    'DRR Scheduler [Multi-Tenant Fair Quantum Distribution]',
    () => {
      // Enqueue 30 tasks across tiers
      for (let i = 0; i < 10; i++) {
        scheduler.enqueue({ id: `ent_${i}`, tenantId: 'tenant_enterprise', tier: 'enterprise', payload: 'data' });
        scheduler.enqueue({ id: `pro_${i}`, tenantId: 'tenant_pro', tier: 'pro', payload: 'data' });
        scheduler.enqueue({ id: `free_${i}`, tenantId: 'tenant_free', tier: 'free', payload: 'data' });
      }
      // Dequeue batch
      scheduler.dequeueBatch(30);
    },
    { category: 'Core Engines', iterations: 1000, warmupIterations: 100 },
  );

  // 5. Zero-Allocation ByteBufferPool vs Raw Buffer
  suite.add(
    'ByteBufferPool.acquire() & release() [Pre-Allocated Arena]',
    () => {
      const buf = byteBufferPool.acquire();
      buf.write('benchmark serialization payload content');
      byteBufferPool.release(buf);
    },
    { category: 'Core Engines', iterations: 5000, warmupIterations: 500 },
  );

  // 6. W3C Distributed TraceContext
  const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
  suite.add(
    'TraceContext.extractOrCreate() & formatHeader() [W3C Distributed Tracing]',
    () => {
      const trace = TraceContext.extractOrCreate({ traceparent });
      TraceContext.formatHeader(trace);
    },
    { category: 'Core Engines', iterations: 5000, warmupIterations: 500 },
  );

  // 7. AES-256-GCM Envelope Payload Encryption & Decryption
  const secretPayload = {
    patientName: 'Jane Smith',
    medicalRecordNumber: 'MRN-887799',
    diagnosis: 'Routine checkup completed successfully',
    prescriptions: ['Amoxicillin 500mg', 'Vitamin D3'],
  };
  const recipientId = 'usr_patient_9988';
  suite.add(
    'PayloadEncryptionManager [AES-256-GCM Envelope Encryption + Decryption]',
    () => {
      const encrypted = payloadEncryptionManager.encryptPayload(secretPayload, recipientId);
      payloadEncryptionManager.decryptPayload(encrypted);
    },
    { category: 'Core Engines', iterations: 500, warmupIterations: 50 },
  );

  return suite;
}
