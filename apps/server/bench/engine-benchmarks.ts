import { IdempotencyService } from '../src/modules/messaging/idempotency.service';
import { Channel, MessagePriority } from '../src/modules/messaging/messaging.types';
import { costOptimizationEngine } from '../src/modules/policies/cost-optimizer';
import { QuietHoursEngine } from '../src/modules/policies/quiet-hours';
import { TokenBucketLimiter } from '../src/modules/policies/token-bucket';
import { gradualRampController } from '../src/modules/providers/core/gradual-ramp';
import { HedgedExecutor } from '../src/modules/providers/core/hedged-executor';
import { smartProviderRouter } from '../src/modules/providers/core/smart-router';
import { WhatsAppTemplateEngine } from '../src/modules/providers/whatsapp/template-engine';
import { StatisticalAnomalyDetector } from '../src/utils/anomaly-detector';
import { byteBufferPool } from '../src/utils/buffer-pool';
import { DlpScanner } from '../src/utils/dlp-scanner';
import { DeficitWeightedRoundRobinScheduler } from '../src/utils/drr-scheduler';
import { BoundedLruCache } from '../src/utils/lru-cache';
import { payloadEncryptionManager } from '../src/utils/payload-encryption';
import { formatRecipientDisplay } from '../src/utils/recipients';
import { TraceContext } from '../src/utils/trace-context';
import { BenchmarkSuite } from './bench-harness';

export function createEngineBenchmarkSuite(): BenchmarkSuite {
  const suite = new BenchmarkSuite('Convey Subsystem Micro-Engine Benchmarks');

  // 1. W3C Distributed TraceContext (Zero-Allocation)
  const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
  suite.add(
    'TraceContext.extractOrCreate() & formatHeader() [W3C Distributed Tracing]',
    () => {
      const trace = TraceContext.extractOrCreate({ traceparent });
      TraceContext.formatHeader(trace);
    },
    { category: 'Core Micro-Engines', iterations: 5000, warmupIterations: 500 },
  );

  // 2. WhatsApp Template Engine AST Tokenization & Variable Interpolation
  const whatsappTemplateRaw =
    'Hello {{1}}, your order #{{order.id}} is confirmed! Amount: {{order.total|0.00}} {{order.currency|USD}}. Delivery date: {{2}}. Thank you for choosing {{company.name}}!';
  const templateVars = {
    '1': 'Alex',
    '2': 'Tomorrow at 3 PM',
    order: { id: 'ORD-998822', total: '149.99', currency: 'EUR' },
    company: { name: 'Acme Corp' },
  };
  suite.add(
    'WhatsAppTemplateEngine [AST Pre-Compilation & Token Interpolation]',
    () => {
      WhatsAppTemplateEngine.render(whatsappTemplateRaw, templateVars);
    },
    { category: 'Core Micro-Engines', iterations: 5000, warmupIterations: 500 },
  );

  // 3. Zero-Allocation ByteBufferPool Arena vs Heap Allocator
  suite.add(
    'ByteBufferPool.acquire() & release() [Pre-Allocated Slab Arena]',
    () => {
      const buf = byteBufferPool.acquire();
      buf.write('benchmark serialization payload content for convey stream');
      byteBufferPool.release(buf);
    },
    { category: 'Core Micro-Engines', iterations: 5000, warmupIterations: 500 },
  );

  // 4. In-Memory Bounded LRU Policy Cache
  const lruCache = new BoundedLruCache<string, { budgetUsd: number; allowed: boolean }>({
    maxCapacity: 10000,
    defaultTtlMs: 5000,
  });
  let lruKey = 0;
  suite.add(
    'BoundedLruCache.set() & get() [O(1) Policy Cache Invalidation]',
    () => {
      lruKey++;
      const k = `tenant_policy_${lruKey % 1000}`;
      lruCache.set(k, { budgetUsd: 500.0, allowed: true });
      lruCache.get(k);
    },
    { category: 'Core Micro-Engines', iterations: 5000, warmupIterations: 500 },
  );

  // 5. DLP Scanner PII Redaction (Single String)
  const samplePiiText =
    'Customer John Doe (SSN: 123-45-6789) paid with Visa card 4111 2222 3333 1111. Verification OTP is 889900. API key: sk_live_998877665544332211001122';
  suite.add(
    'DlpScanner.sanitize() [CreditCard, SSN, OTP, API Key Redaction]',
    () => {
      DlpScanner.sanitize(samplePiiText);
    },
    { category: 'Core Micro-Engines', iterations: 1000, warmupIterations: 100 },
  );

  // 6. Deep DLP Object Traversal & Sanitization (Complex Structured Payload)
  const nestedPiiObject = {
    user: {
      fullName: 'Alice Smith',
      ssn: '987-65-4321',
      secretToken: 'ey1234567890abcdef.jwt.token',
    },
    payment: {
      card: '5500 0000 0000 0004',
      cvv: '123',
      otp: '776655',
    },
    meta: {
      headers: { authorization: 'Bearer sk_live_11223344556677889900aabb' },
      logs: ['User login from IP 192.168.1.1', 'Card charged: 4111111111111111'],
    },
  };
  suite.add(
    'DlpScanner.sanitizeObject() [Deep JSON Tree Sanitization]',
    () => {
      DlpScanner.sanitizeObject(nestedPiiObject);
    },
    { category: 'Core Micro-Engines', iterations: 1000, warmupIterations: 100 },
  );

  // 7. Deficit Weighted Round Robin (DRR) Multi-Tenant Scheduler
  const drrScheduler = new DeficitWeightedRoundRobinScheduler<string>();
  suite.add(
    'DRR Scheduler [Multi-Tenant Fair Quantum Arbitration]',
    () => {
      for (let i = 0; i < 10; i++) {
        drrScheduler.enqueue({ id: `ent_${i}`, tenantId: 'tenant_enterprise', tier: 'enterprise', payload: 'data' });
        drrScheduler.enqueue({ id: `pro_${i}`, tenantId: 'tenant_pro', tier: 'pro', payload: 'data' });
        drrScheduler.enqueue({ id: `free_${i}`, tenantId: 'tenant_free', tier: 'free', payload: 'data' });
      }
      drrScheduler.dequeueBatch(30);
    },
    { category: 'Core Micro-Engines', iterations: 1000, warmupIterations: 100 },
  );

  // 8. Statistical Anomaly Detector (Z-Score & MAD Outliers)
  const anomalyDetector = new StatisticalAnomalyDetector();
  for (let i = 0; i < 30; i++) {
    anomalyDetector.recordLatency('ses_provider', 45 + Math.random() * 10);
  }
  let anomalySeq = 0;
  suite.add(
    'StatisticalAnomalyDetector.analyze() [Z-Score Outlier Computation]',
    () => {
      anomalySeq++;
      const lat = anomalySeq % 20 === 0 ? 350 : 50; // Periodic spike
      anomalyDetector.recordLatency('ses_provider', lat);
      anomalyDetector.analyze('ses_provider', lat);
    },
    { category: 'Core Micro-Engines', iterations: 1000, warmupIterations: 100 },
  );

  // 9. Smart Provider Router Scorecard Ranking & Decision Trace
  for (let i = 0; i < 20; i++) {
    smartProviderRouter.recordProviderFeedback('ses', 45, true);
    smartProviderRouter.recordProviderFeedback('sendgrid', 75, true);
    smartProviderRouter.recordProviderFeedback('postmark', 35, true);
  }
  suite.add(
    'SmartProviderRouter.getDecisionTrace() [MAB Scorecard Ranking]',
    () => {
      smartProviderRouter.getDecisionTrace(Channel.EMAIL);
    },
    { category: 'Core Micro-Engines', iterations: 1000, warmupIterations: 100 },
  );

  // 10. Quiet Hours & Send-Time Optimizer (Timezone Resolution)
  const sampleDate = new Date('2026-08-20T23:30:00Z');
  suite.add(
    'QuietHoursEngine.evaluate() [Timezone Resolution & STO Windowing]',
    () => {
      QuietHoursEngine.evaluate({
        country: 'AE',
        phone: '+971501234567',
        priority: MessagePriority.NORMAL,
        now: sampleDate,
      });
    },
    { category: 'Core Micro-Engines', iterations: 1000, warmupIterations: 100 },
  );

  // 11. Cost Optimization Engine Channel Sequence Optimization
  const channelList = [Channel.SMS, Channel.EMAIL, Channel.WHATSAPP, Channel.PUSH];
  suite.add(
    'CostOptimizationEngine.optimizeChannelSequence() [Unit Cost Matrix]',
    () => {
      costOptimizationEngine.optimizeChannelSequence(channelList);
    },
    { category: 'Core Micro-Engines', iterations: 2000, warmupIterations: 200 },
  );

  // 12. Recipient Normalization & Display Resolution
  const recipientRecord = {
    email: 'john.doe@company.com',
    phone: '+971501234567',
    whatsapp: '+971501234567',
    fcmTokens: ['fcm_token_alpha_123', 'fcm_token_beta_456'],
  };
  suite.add(
    'formatRecipientDisplay() [Multi-Channel Normalization]',
    () => {
      formatRecipientDisplay(recipientRecord, Channel.EMAIL, 'usr_1001');
      formatRecipientDisplay(recipientRecord, Channel.SMS, 'usr_1001');
      formatRecipientDisplay(recipientRecord, Channel.FCM, 'usr_1001');
    },
    { category: 'Core Micro-Engines', iterations: 2000, warmupIterations: 200 },
  );

  // 13. Gradual Ramp Controller Probe Admission Logic
  suite.add(
    'GradualRampController.shouldAdmitTraffic() [Stepped Probe Admission]',
    () => {
      gradualRampController.shouldAdmitTraffic('twilio');
    },
    { category: 'Core Micro-Engines', iterations: 2000, warmupIterations: 200 },
  );

  // 14. Hedged Request Executor (Speculative Secondary Race)
  suite.add(
    'HedgedExecutor.execute() [Speculative Parallel Hedging Race]',
    async () => {
      await HedgedExecutor.execute(
        async () => 'primary_result',
        async () => 'secondary_result',
        { hedgeDelayMs: 50, timeoutMs: 200 },
      );
    },
    { category: 'Core Micro-Engines', iterations: 500, warmupIterations: 50 },
  );

  // 15. AES-256-GCM Envelope Payload Encryption & Decryption
  const secretPayload = {
    patientName: 'Jane Smith',
    medicalRecordNumber: 'MRN-887799',
    diagnosis: 'Routine checkup completed successfully',
    prescriptions: ['Amoxicillin 500mg', 'Vitamin D3'],
  };
  const recipientId = 'usr_patient_9988';
  suite.add(
    'PayloadEncryptionManager [AES-256-GCM Envelope Encrypt + Decrypt]',
    () => {
      const encrypted = payloadEncryptionManager.encryptPayload(secretPayload, recipientId);
      payloadEncryptionManager.decryptPayload(encrypted);
    },
    { category: 'Core Micro-Engines', iterations: 500, warmupIterations: 50 },
  );

  // 16. Token Bucket Limiter (Atomic Redis Lua)
  let tbSeq = 0;
  suite.add(
    'TokenBucketLimiter.consume() [Redis Lua Atomic Rate Smoothing]',
    async () => {
      tbSeq++;
      await TokenBucketLimiter.consume(`bench_tb_${tbSeq % 10}`, 1000, 100, 1);
    },
    { category: 'Core Micro-Engines', iterations: 200, warmupIterations: 20 },
  );

  // 17. Idempotency Service 1-RTT Reservation
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
    { category: 'Core Micro-Engines', iterations: 200, warmupIterations: 20 },
  );

  return suite;
}
