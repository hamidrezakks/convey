import { formatCurrencyAmount } from '@convey/shared';
import { redisClient } from '../../../queues/connection';
import { logger } from '../../../utils/logger';
import { BoundedLruCache } from '../../../utils/lru-cache';
import { formatRedisKey } from '../../../utils/redis-keys';
import { Channel } from '../../messaging/messaging.types';
import { costOptimizationEngine } from '../../policies/cost-optimizer';
import { fxEngine } from '../../policies/fx-engine';
import { providerCircuitBreaker } from './circuit-breaker';
import { ProviderRegistry } from './provider-registry';

export interface ProviderScorecard {
  providerId: string;
  emaLatencyMs: number;
  successRate: number;
  totalCalls: number;
  score: number;
  betaSample?: number;
  unitCostUsd?: number;
  baseCurrency?: string;
  unitCostNative?: number;
  formattedUnitCost?: string;
}

export interface ProviderRateCard {
  cost: number;
  currency: string;
}

export const RateCardRegistry: Record<string, ProviderRateCard> = {
  ses: { cost: 0.0001, currency: 'USD' },
  postmark: { cost: 0.00085, currency: 'USD' },
  resend: { cost: 0.0008, currency: 'USD' },
  sendgrid: { cost: 0.001, currency: 'USD' },
  mailgun: { cost: 0.0009, currency: 'USD' },
  telnyx: { cost: 0.0035, currency: 'USD' },
  twilio: { cost: 0.0079, currency: 'USD' },
  bandwidth: { cost: 0.004, currency: 'USD' },
  sinch: { cost: 0.0065, currency: 'EUR' },
  plivo: { cost: 0.0045, currency: 'USD' },
  infobip: { cost: 0.007, currency: 'EUR' },
  brevo: { cost: 0.00075, currency: 'EUR' },
  messagebird: { cost: 0.007, currency: 'EUR' },
  cequens: { cost: 0.025, currency: 'AED' },
  termii: { cost: 0.005, currency: 'USD' },
  whatsapp: { cost: 0.005, currency: 'USD' },
  'whatsapp-business': { cost: 0.005, currency: 'USD' },
  fcm: { cost: 0.0, currency: 'USD' },
  apns: { cost: 0.0, currency: 'USD' },
  slack: { cost: 0.0, currency: 'USD' },
  telegram: { cost: 0.0, currency: 'USD' },
  discord: { cost: 0.0, currency: 'USD' },
  'one-signal': { cost: 0.0, currency: 'USD' },
  expo: { cost: 0.0, currency: 'USD' },
  generic: { cost: 0.001, currency: 'USD' },
};

export function getProviderRate(providerId: string): ProviderRateCard {
  return RateCardRegistry[providerId.toLowerCase()] ?? { cost: 0.001, currency: 'USD' };
}

export function getProviderUnitCost(providerId: string, targetCurrency: string = 'USD'): number {
  const rate = getProviderRate(providerId);
  const target = targetCurrency.toUpperCase();
  if (rate.currency.toUpperCase() === target) {
    return rate.cost;
  }
  return fxEngine.convert(rate.cost, rate.currency, target).convertedAmount;
}

export function getProviderBaseCurrency(providerId: string): string {
  return getProviderRate(providerId).currency;
}

export function getDefaultProviderForChannel(channel: Channel): string {
  switch (channel) {
    case Channel.EMAIL:
      return 'ses';
    case Channel.SMS:
      return 'twilio';
    case Channel.WHATSAPP:
      return 'whatsapp-business';
    case Channel.TELEGRAM:
      return 'telegram';
    case Channel.SLACK:
      return 'slack';
    case Channel.PUSH:
      return 'apns';
    case Channel.TOOL:
      return 'pagerduty';
    default:
      return 'generic';
  }
}

/**
 * Generates a random sample from a Gamma(shape, 1) distribution via Marsaglia and Tsang method.
 */
function sampleGamma(shape: number): number {
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.random() ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let u1 = Math.random();
    let u2 = Math.random();
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const v = (1 + c * z) ** 3;
    if (v <= 0) continue;
    const u = Math.random();
    if (u < 1 - 0.0331 * z ** 4) return d * v;
    if (Math.log(u) < 0.5 * z ** 2 + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Samples a random value from Beta(alpha, beta) distribution via Gamma ratio.
 */
export function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(Math.max(0.1, alpha));
  const y = sampleGamma(Math.max(0.1, beta));
  if (x + y === 0) return 0.5;
  return x / (x + y);
}

export class SmartProviderRouter {
  private scorecards = new BoundedLruCache<string, { emaLatency: number; successes: number; total: number }>({
    maxCapacity: 5000,
  });
  private alpha = 0.2; // Exponential moving average smoothing factor
  private explorationRate = 0.05; // 5% canary exploration rate

  recordProviderFeedback(providerId: string, latencyMs: number, success: boolean): void {
    let stats = this.scorecards.get(providerId);
    if (!stats) {
      stats = { emaLatency: latencyMs, successes: success ? 1 : 0, total: 1 };
      this.scorecards.set(providerId, stats);
    } else {
      stats.total += 1;
      if (success) stats.successes += 1;
      stats.emaLatency = this.alpha * latencyMs + (1 - this.alpha) * stats.emaLatency;
    }

    // Synchronize counter updates with Redis for multi-node worker consensus
    this.syncRedisFeedback(providerId, latencyMs, success).catch(() => {});
  }

  private async syncRedisFeedback(providerId: string, latencyMs: number, success: boolean): Promise<void> {
    try {
      const key = formatRedisKey(`mab:${providerId}`);
      const pipeline = redisClient.pipeline();
      pipeline.hincrby(key, 'total', 1);
      if (success) {
        pipeline.hincrby(key, 'successes', 1);
      } else {
        pipeline.hincrby(key, 'failures', 1);
      }
      pipeline.hset(key, 'lastLatency', latencyMs.toString());
      pipeline.expire(key, 86400 * 7); // 7-day TTL
      await pipeline.exec();
    } catch {
      // Ignore Redis sync errors in non-blocking mode
    }
  }

  getScorecard(providerId: string): ProviderScorecard {
    const stats = this.scorecards.get(providerId);
    const rate = getProviderRate(providerId);
    const unitCostUsd = getProviderUnitCost(providerId, 'USD');

    if (!stats || stats.total === 0) {
      return {
        providerId,
        emaLatencyMs: 100,
        successRate: 1.0,
        totalCalls: 0,
        score: Math.round(100 - unitCostUsd * 1000),
        betaSample: 1.0,
        unitCostUsd,
        baseCurrency: rate.currency,
        unitCostNative: rate.cost,
        formattedUnitCost: formatCurrencyAmount(rate.cost, rate.currency),
      };
    }

    const successes = stats.successes;
    const failures = stats.total - successes;
    const betaSample = sampleBeta(1 + successes, 1 + failures);
    const successRate = stats.successes / stats.total;

    // Multi-Objective Thompson Sampling MAB Score: Beta sample - Latency penalty - Normalized Unit cost penalty
    const mabComponent = 100 * betaSample;
    const latencyPenalty = stats.emaLatency / 10;
    const costPenalty = unitCostUsd * 5000;
    const score = Math.max(0, Math.round(mabComponent - latencyPenalty - costPenalty));

    return {
      providerId,
      emaLatencyMs: Math.round(stats.emaLatency),
      successRate,
      totalCalls: stats.total,
      score,
      betaSample,
      unitCostUsd,
      baseCurrency: rate.currency,
      unitCostNative: rate.cost,
      formattedUnitCost: formatCurrencyAmount(rate.cost, rate.currency),
    };
  }

  rankChannelsByCost(channels: Channel[]): Channel[] {
    return costOptimizationEngine.optimizeChannelSequence(channels);
  }

  getDecisionTrace(
    channel: Channel,
    preferredProviderId?: string,
    targetCurrency: string = 'USD',
  ): {
    selected: string;
    score: number;
    costUsd: number;
    costInTargetCurrency: number;
    currency: string;
    competitors: Array<{ provider: string; score: number; costUsd: number; costInTargetCurrency: number }>;
  } {
    const configured = ProviderRegistry.getConfiguredAdaptersByChannel(channel);
    const healthyAdapters = configured.filter((a) => providerCircuitBreaker.canExecute(a.id));
    const targetAdapters = healthyAdapters.length > 0 ? healthyAdapters : ProviderRegistry.getByChannel(channel);

    const ranked = targetAdapters
      .map((adapter) => {
        const sc = this.getScorecard(adapter.id);
        const costUsd = sc.unitCostUsd ?? getProviderUnitCost(adapter.id, 'USD');
        const costInTarget = getProviderUnitCost(adapter.id, targetCurrency);
        return {
          provider: adapter.id,
          score: sc.score,
          costUsd,
          costInTargetCurrency: costInTarget,
        };
      })
      .sort((a, b) => b.score - a.score);

    const selected = ranked[0]?.provider || preferredProviderId || getDefaultProviderForChannel(channel);
    const selectedItem = ranked.find((r) => r.provider === selected) || ranked[0];

    return {
      selected,
      score: selectedItem?.score ?? 100,
      costUsd: selectedItem?.costUsd ?? 0.001,
      costInTargetCurrency: selectedItem?.costInTargetCurrency ?? 0.001,
      currency: targetCurrency.toUpperCase(),
      competitors: ranked.filter((r) => r.provider !== selected),
    };
  }

  selectOptimalProvider(channel: Channel, preferredProviderId?: string): string {
    // 1. If preferred provider exists and circuit is healthy, check its scorecard
    if (preferredProviderId && providerCircuitBreaker.canExecute(preferredProviderId)) {
      const preferredScore = this.getScorecard(preferredProviderId);
      if (preferredScore.score > 30) {
        return preferredProviderId;
      }
    }

    // 2. Resolve all healthy configured adapters for channel
    const configured = ProviderRegistry.getConfiguredAdaptersByChannel(channel);
    const healthyAdapters = configured.filter((a) => providerCircuitBreaker.canExecute(a.id));

    if (!healthyAdapters.length) {
      return preferredProviderId || getDefaultProviderForChannel(channel);
    }

    // 3. Canary Exploration: 5% random selection across healthy secondary adapters
    if (healthyAdapters.length > 1 && Math.random() < this.explorationRate) {
      const randomIndex = Math.floor(Math.random() * healthyAdapters.length);
      const canaryProvider = healthyAdapters[randomIndex].id;
      logger.info(
        'SmartRouter',
        `Canary MAB exploration selected provider '${canaryProvider}' for channel '${channel}'`,
      );
      return canaryProvider;
    }

    // 4. Rank healthy adapters by Thompson Sampling MAB Scorecard
    const ranked = healthyAdapters
      .map((adapter) => ({
        adapter,
        scorecard: this.getScorecard(adapter.id),
      }))
      .sort((a, b) => b.scorecard.score - a.scorecard.score);

    const optimal = ranked[0].adapter.id;
    if (preferredProviderId && optimal !== preferredProviderId) {
      logger.info(
        'SmartRouter',
        `Dynamic MAB re-routing for channel '${channel}': Selected '${optimal}' (score: ${ranked[0].scorecard.score}) over '${preferredProviderId}'`,
      );
    }

    return optimal;
  }

  getHedgedProviderPair(channel: Channel, preferredProviderId?: string): { primary: string; secondary?: string } {
    let configured = ProviderRegistry.getConfiguredAdaptersByChannel(channel);
    if (configured.length < 2) {
      configured = ProviderRegistry.getByChannel(channel);
    }
    const healthyAdapters = configured.filter((a) => providerCircuitBreaker.canExecute(a.id));

    if (!healthyAdapters.length) {
      return { primary: preferredProviderId || 'ses' };
    }

    const ranked = healthyAdapters
      .map((adapter) => ({
        adapter,
        scorecard: this.getScorecard(adapter.id),
      }))
      .sort((a, b) => b.scorecard.score - a.scorecard.score);

    const primary =
      preferredProviderId && providerCircuitBreaker.canExecute(preferredProviderId)
        ? preferredProviderId
        : ranked[0].adapter.id;

    const secondaryCandidate = ranked.find((item) => item.adapter.id !== primary);

    return {
      primary,
      secondary: secondaryCandidate?.adapter.id,
    };
  }
}

export const smartProviderRouter = new SmartProviderRouter();
