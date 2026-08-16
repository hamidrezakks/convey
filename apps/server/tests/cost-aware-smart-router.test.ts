import { describe, expect, it } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { getProviderUnitCost, SmartProviderRouter } from '../src/modules/providers/core/smart-router';

describe('Cost-Aware Multi-Objective Thompson Sampling Smart Router', () => {
  it('should maintain accurate provider rate cards', () => {
    expect(getProviderUnitCost('ses')).toBe(0.0001);
    expect(getProviderUnitCost('telnyx')).toBe(0.0035);
    expect(getProviderUnitCost('twilio')).toBe(0.0079);
    expect(getProviderUnitCost('postmark')).toBe(0.00085);
  });

  it('should factor in unit cost and latency when computing multi-objective utility score', () => {
    const router = new SmartProviderRouter();

    // Provider A (Telnyx): low cost ($0.0035), fast (60ms), 100% success
    for (let i = 0; i < 20; i++) {
      router.recordProviderFeedback('telnyx', 60, true);
    }

    // Provider B (Twilio): high cost ($0.0079), slower (140ms), 100% success
    for (let i = 0; i < 20; i++) {
      router.recordProviderFeedback('twilio', 140, true);
    }

    const telnyxScore = router.getScorecard('telnyx');
    const twilioScore = router.getScorecard('twilio');

    expect(telnyxScore.unitCostUsd).toBe(0.0035);
    expect(twilioScore.unitCostUsd).toBe(0.0079);

    // Telnyx should achieve a higher multi-objective score due to lower latency and lower unit cost
    expect(telnyxScore.score).toBeGreaterThan(twilioScore.score);
  });

  it('should generate structured decision trace with competitor scores', () => {
    const router = new SmartProviderRouter();
    const trace = router.getDecisionTrace(Channel.EMAIL, 'ses');

    expect(trace.selected).toBeDefined();
    expect(typeof trace.score).toBe('number');
    expect(typeof trace.costUsd).toBe('number');
    expect(Array.isArray(trace.competitors)).toBe(true);
  });
});
