import { describe, expect, it } from 'bun:test';
import {
  BounceCategory,
  BounceClassifier,
  DeliverabilityAction,
  IpWarmupScheduler,
  SenderIdCompliance,
} from '../src/modules/policies/deliverability-autopilot';

describe('Deliverability Autopilot & Reputation Defense', () => {
  describe('BounceClassifier', () => {
    it('should classify permanent hard bounces (550, user unknown) for auto-suppression', () => {
      const result = BounceClassifier.classify({
        smtpCode: 550,
        enhancedCode: '5.1.1',
        errorMessage: 'Mailbox not found',
      });
      expect(result.category).toBe(BounceCategory.HARD_BOUNCE);
      expect(result.action).toBe(DeliverabilityAction.AUTO_SUPPRESS);
      expect(result.isPermanent).toBe(true);
    });

    it('should classify spam complaints and feedback loops for auto-suppression', () => {
      const result = BounceClassifier.classify({
        errorMessage: 'Complaint received via Feedback Loop (FBL)',
      });
      expect(result.category).toBe(BounceCategory.SPAM_COMPLAINT);
      expect(result.action).toBe(DeliverabilityAction.AUTO_SUPPRESS);
      expect(result.isPermanent).toBe(true);
    });

    it('should classify greylisting (451, 4.5.3) for jittered delayed retry', () => {
      const result = BounceClassifier.classify({
        smtpCode: 451,
        enhancedCode: '4.5.3',
        errorMessage: 'Greylisted, please try again later',
      });
      expect(result.category).toBe(BounceCategory.GREYLISTED);
      expect(result.action).toBe(DeliverabilityAction.RETRY_WITH_BACKOFF);
      expect(result.isPermanent).toBe(false);
      expect(result.recommendedBackoffMs).toBe(900_000);
    });

    it('should classify SMS carrier filtering (30007) for carrier failover', () => {
      const result = BounceClassifier.classify({
        errorMessage: 'Twilio 30007: Carrier Violation - Message filtered by mobile network operator',
      });
      expect(result.category).toBe(BounceCategory.CARRIER_BLOCKED);
      expect(result.action).toBe(DeliverabilityAction.FAILOVER_CARRIER);
    });
  });

  describe('IpWarmupScheduler', () => {
    it('should compute progressive daily capacity ramp', () => {
      const day1 = IpWarmupScheduler.computeWarmupCap(1);
      expect(day1.dailyCap).toBe(100);

      const day5 = IpWarmupScheduler.computeWarmupCap(5);
      // 100 * (1.4)^4 = 384
      expect(day5.dailyCap).toBeGreaterThan(day1.dailyCap);
      expect(day5.isHealthDegraded).toBe(false);
    });

    it('should throttle daily cap if recent bounce rate exceeds 2.0%', () => {
      const healthy = IpWarmupScheduler.computeWarmupCap(5, 0.005);
      const degraded = IpWarmupScheduler.computeWarmupCap(5, 0.035); // 3.5% bounce rate

      expect(degraded.isHealthDegraded).toBe(true);
      expect(degraded.dailyCap).toBeLessThan(healthy.dailyCap);
    });
  });

  describe('SenderIdCompliance', () => {
    it('should sanitize alphanumeric sender IDs to max 11 alphanumeric characters', () => {
      expect(SenderIdCompliance.sanitizeAlphanumericSenderId('MyBrand! 2026-X')).toBe('MyBrand2026');
    });

    it('should validate alphanumeric sender IDs for supported countries (UK, SA, UAE)', () => {
      const ukEval = SenderIdCompliance.evaluateSenderId('AcmeAlerts', 'GB');
      expect(ukEval.mode).toBe('ALPHANUMERIC');
      expect(ukEval.isValid).toBe(true);
      expect(ukEval.formattedSenderId).toBe('AcmeAlerts');
    });

    it('should require 10DLC / Shortcode for US and Canada', () => {
      const usEval = SenderIdCompliance.evaluateSenderId('AcmeAlerts', 'US');
      expect(usEval.mode).toBe('SHORTCODE_OR_10DLC');
      expect(usEval.reason).toContain('prohibited');
    });
  });
});
