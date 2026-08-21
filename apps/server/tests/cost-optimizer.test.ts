import { describe, expect, it } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { CostOptimizationEngine, costOptimizationEngine } from '../src/modules/policies/cost-optimizer';
import {
  getProviderBaseCurrency,
  getProviderRate,
  getProviderUnitCost,
  smartProviderRouter,
} from '../src/modules/providers/core/smart-router';

describe('Predictive Unit-Cost Router & Budget Optimizer', () => {
  it('estimates unit costs and optimizes channel fallback sequence in USD', () => {
    const optimizer = new CostOptimizationEngine();
    const channels: Channel[] = [Channel.SMS, Channel.EMAIL, Channel.PUSH];

    const sorted = optimizer.optimizeChannelSequence(channels);
    expect(sorted).toEqual([Channel.PUSH, Channel.EMAIL, Channel.SMS]);
  });

  it('estimates unit costs in multiple target currencies (EUR, AED)', () => {
    const estimatesEur = costOptimizationEngine.estimateCosts([Channel.EMAIL, Channel.SMS], 'EUR');
    expect(estimatesEur[0].currency).toBe('EUR');
    expect(estimatesEur[0].estimatedCostPerMsg).toBeCloseTo(0.0001 * 0.924, 6);
    expect(estimatesEur[0].formattedCost).toContain('€');

    const estimatesAed = costOptimizationEngine.estimateCosts([Channel.SMS], 'AED');
    expect(estimatesAed[0].currency).toBe('AED');
    expect(estimatesAed[0].estimatedCostPerMsg).toBeCloseTo(0.0075 * 3.6725, 4);
    expect(estimatesAed[0].formattedCost).toContain('AED');
  });

  it('resolves provider native base currency and rate cards', () => {
    const infobipRate = getProviderRate('infobip');
    expect(infobipRate.currency).toBe('EUR');
    expect(infobipRate.cost).toBe(0.007);
    expect(getProviderBaseCurrency('infobip')).toBe('EUR');

    const cequensRate = getProviderRate('cequens');
    expect(cequensRate.currency).toBe('AED');
    expect(cequensRate.cost).toBe(0.025);
    expect(getProviderBaseCurrency('cequens')).toBe('AED');

    const twilioRate = getProviderRate('twilio');
    expect(twilioRate.currency).toBe('USD');
    expect(twilioRate.cost).toBe(0.0079);
  });

  it('normalizes provider unit costs to target comparison currencies', () => {
    // Twilio ($0.0079 USD) converted to EUR: 0.0079 * 0.924 = 0.0073
    const twilioInEur = getProviderUnitCost('twilio', 'EUR');
    expect(twilioInEur).toBeCloseTo(0.0073, 4);

    // Infobip (€0.0070 EUR) converted to USD: 0.007 / 0.924 = 0.00757
    const infobipInUsd = getProviderUnitCost('infobip', 'USD');
    expect(infobipInUsd).toBeCloseTo(0.007575, 4);

    // Infobip (€0.0070 EUR) in EUR should be exact native 0.007
    const infobipInEur = getProviderUnitCost('infobip', 'EUR');
    expect(infobipInEur).toBe(0.007);
  });

  it('populates scorecard with base currency, native cost, and formatted cost', () => {
    const scorecard = smartProviderRouter.getScorecard('infobip');
    expect(scorecard.providerId).toBe('infobip');
    expect(scorecard.baseCurrency).toBe('EUR');
    expect(scorecard.unitCostNative).toBe(0.007);
    expect(scorecard.formattedUnitCost).toBe('€0.007');
    expect(scorecard.unitCostUsd).toBeCloseTo(0.007575, 4);
  });

  it('provides decision trace with multi-currency normalized competitor comparisons', () => {
    const trace = smartProviderRouter.getDecisionTrace(Channel.EMAIL, 'ses', 'EUR');
    expect(trace.selected).toBeDefined();
    expect(trace.currency).toBe('EUR');
    expect(trace.costInTargetCurrency).toBeGreaterThan(0);
  });
});
