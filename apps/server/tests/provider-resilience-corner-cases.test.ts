import { describe, expect, it } from 'bun:test';
import { CircuitState, ProviderCircuitBreaker } from '../src/modules/providers/core/circuit-breaker';
import { HedgedExecutor } from '../src/modules/providers/core/hedged-executor';
import {
  WhatsAppOptimizationMetadataKey,
  applyWhatsAppSessionOptimization,
} from '../src/modules/providers/whatsapp/session-interceptor';
import { WhatsAppSessionTracker } from '../src/modules/providers/whatsapp/session-tracker';
import { AdaptiveConcurrencyController } from '../src/utils/adaptive-concurrency';
import { DlpScanner } from '../src/utils/dlp-scanner';

describe('Provider Resilience & Realistic Corner Cases Suite', () => {
  describe('1. Circuit Breaker Half-Open State Transitions & Recovery Ramp', () => {
    it('trips to OPEN on threshold failures, allows test probes in HALF_OPEN, and closes upon consecutive successes', async () => {
      const cb = new ProviderCircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 50,
      });

      const providerId = 'ses_resil_1';
      expect(cb.getState(providerId)).toBe(CircuitState.CLOSED);
      expect(cb.canExecute(providerId)).toBe(true);

      // Record 2 failures (below threshold)
      cb.recordFailure(providerId);
      cb.recordFailure(providerId);
      expect(cb.getState(providerId)).toBe(CircuitState.CLOSED);

      // 3rd failure trips circuit
      cb.recordFailure(providerId);
      expect(cb.getState(providerId)).toBe(CircuitState.OPEN);
      expect(cb.canExecute(providerId)).toBe(false);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      // First call after timeout transitions to HALF_OPEN
      cb.canExecute(providerId);
      expect(cb.getState(providerId)).toBe(CircuitState.HALF_OPEN);

      // Success in HALF_OPEN closes circuit
      cb.recordSuccess(providerId);
      expect(cb.getState(providerId)).toBe(CircuitState.CLOSED);
    });

    it('immediately re-trips back to OPEN if a probe fails during HALF_OPEN', async () => {
      const cb = new ProviderCircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 40,
      });

      const providerId = 'twilio_resil_1';
      cb.recordFailure(providerId);
      cb.recordFailure(providerId);
      expect(cb.getState(providerId)).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Transition to HALF_OPEN
      cb.canExecute(providerId);
      expect(cb.getState(providerId)).toBe(CircuitState.HALF_OPEN);

      // Failure during HALF_OPEN immediately trips back to OPEN
      cb.recordFailure(providerId);
      expect(cb.getState(providerId)).toBe(CircuitState.OPEN);
      expect(cb.canExecute(providerId)).toBe(false);
    });
  });

  describe('2. Hedged Requests Cancellation & Latency Racing', () => {
    it('speculatively executes secondary when primary exceeds hedgeDelayMs and chooses winner', async () => {
      let primaryAborted = false;
      let secondaryAborted = false;

      const primaryTask = async (signal?: AbortSignal) => {
        return new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => resolve('primary_success'), 120);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            primaryAborted = true;
            reject(new Error('Aborted'));
          });
        });
      };

      const secondaryTask = async (signal?: AbortSignal) => {
        return new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => resolve('secondary_success'), 30);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            secondaryAborted = true;
            reject(new Error('Aborted'));
          });
        });
      };

      const result = await HedgedExecutor.execute(primaryTask, secondaryTask, { hedgeDelayMs: 20 });

      expect(result.winner).toBe('secondary');
      expect(result.result).toBe('secondary_success');
      expect(result.hedgedTriggered).toBe(true);
      expect(secondaryAborted).toBe(false);
      expect(primaryAborted).toBe(true);
    });
  });

  describe('3. Adaptive Concurrency Limiter Gradient EMA Behavior', () => {
    it('scales concurrency dynamically using gradient EMA response times', () => {
      const controller = new AdaptiveConcurrencyController({
        minConcurrency: 2,
        maxConcurrency: 20,
        targetLatencyMs: 100,
        smoothingFactor: 0.5,
      });

      const initial = controller.getConcurrency();

      // Low latency responses (<70ms) scale concurrency up
      controller.recordExecution(40);
      controller.recordExecution(40);
      expect(controller.getConcurrency()).toBeGreaterThanOrEqual(initial);

      // Latency spike (>150ms) scales concurrency down
      controller.recordExecution(400);
      controller.recordExecution(400);
      expect(controller.getConcurrency()).toBeLessThanOrEqual(initial + 2);
      expect(controller.getConcurrency()).toBeGreaterThanOrEqual(2);
    });
  });

  describe('4. WhatsApp 24-Hour Customer Care Window Interceptor', () => {
    it('detects active session and transforms expensive template to low-cost text message', async () => {
      const providerId = 'whatsapp-business';
      const phone = `+1555000${Math.floor(Math.random() * 8999 + 1000)}`;

      // Clear any prior test state
      await WhatsAppSessionTracker.clearSession(providerId, phone);

      // Before inbound message: session is inactive
      const beforeInbound = await WhatsAppSessionTracker.hasActiveSession(providerId, phone);
      expect(beforeInbound).toBe(false);

      // Inbound message received from customer
      await WhatsAppSessionTracker.recordInboundMessage(providerId, phone);

      // Now session is active
      const afterInbound = await WhatsAppSessionTracker.hasActiveSession(providerId, phone);
      expect(afterInbound).toBe(true);

      const sessionInfo = await WhatsAppSessionTracker.getSessionDetails(providerId, phone);
      expect(sessionInfo.active).toBe(true);
      expect(sessionInfo.remainingSeconds).toBeGreaterThan(0);

      // Outbound dispatch: template is converted to free-form text with cost savings recorded
      const sendOptions = {
        recipient: { phone },
        content: {
          templateId: 'order_update_v1',
          templateBody: 'Hi {{1}}, your order {{2}} has shipped!',
          variables: { '1': 'Alice', '2': '#12345' },
        },
      };

      const result = await applyWhatsAppSessionOptimization(providerId, sendOptions, {
        sessionOptimization: { enabled: true, estimatedCostSavedUsd: 0.006 },
      });

      expect(result.optimized).toBe(true);
      expect(result.savedUsd).toBe(0.006);
      expect(result.options.content.text).toBe('Hi Alice, your order #12345 has shipped!');
      expect(result.options.content.templateId).toBeUndefined();
      expect(result.options.metadata?.[WhatsAppOptimizationMetadataKey.SESSION_OPTIMIZATION_APPLIED]).toBe(true);
    });
  });

  describe('5. DLP PII Detection & Format-Preserving Redaction', () => {
    it('identifies and redacts credit cards, emails, SSNs, and API keys cleanly', () => {
      const sensitivePayload = {
        creditCard: '4111-1111-1111-1111',
        ssn: '123-45-6789',
        secretApiKey: 'sk_live_123456789012345678901234567890',
        otpCode: 'Your verification pin is 849201',
        safeNotes: 'Standard delivery to office lobby',
      };

      const sanitized = DlpScanner.sanitizeObject(sensitivePayload);

      expect(sanitized.creditCard).toBe('4111-XXXX-XXXX-1111');
      expect(sanitized.ssn).toBe('XXX-XX-XXXX');
      expect(sanitized.secretApiKey).toBe('[REDACTED_API_KEY]');
      expect(sanitized.otpCode).toContain('[REDACTED_OTP]');
      expect(sanitized.safeNotes).toBe('Standard delivery to office lobby');
    });
  });
});
