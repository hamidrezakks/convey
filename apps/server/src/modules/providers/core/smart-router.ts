import { redisClient } from '../../../queues/connection';
import { logger } from '../../../utils/logger';
import { BoundedLruCache } from '../../../utils/lru-cache';
import { formatRedisKey } from '../../../utils/redis-keys';
import { Channel } from '../../messaging/messaging.types';
import { costOptimizationEngine } from '../../policies/cost-optimizer';
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
}

export const RateCardRegistry: Record<string, number> = {
  ses: 0.0001,
  postmark: 0.00085,
  resend: 0.0008,
  sendgrid: 0.001,
  mailgun: 0.0009,
  telnyx: 0.0035,
  twilio: 0.0079,
  bandwidth: 0.004,
  sinch: 0.0065,
  plivo: 0.0045,
  infobip: 0.007,
  whatsapp: 0.005,
  fcm: 0.0,
  apns: 0.0,
  slack: 0.0,
  telegram: 0.0,
};

export function getProviderUnitCost(providerId: string): number {
  return RateCardRegistry[providerId.toLowerCase()] ?? 0.001;
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
  private weightMab = 0.5;
  private weightLatency = 0.25;
  private weightCost = 0.25;

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
    const unitCost = getProviderUnitCost(providerId);

    if (!stats || stats.total === 0) {
      return {
        providerId,
        emaLatencyMs: 100,
        successRate: 1.0,
        totalCalls: 0,
        score: Math.round(100 - unitCost * 1000),
        betaSample: 1.0,
        unitCostUsd: unitCost,
      };
    }

    const successes = stats.successes;
    const failures = stats.total - successes;
    const betaSample = sampleBeta(1 + successes, 1 + failures);
    const successRate = stats.successes / stats.total;

    // Multi-Objective Thompson Sampling MAB Score: Beta sample - Latency penalty - Unit cost penalty
    const mabComponent = 100 * betaSample;
    const latencyPenalty = stats.emaLatency / 10;
    const costPenalty = unitCost * 5000;
    const score = Math.max(0, Math.round(mabComponent - latencyPenalty - costPenalty));

    return {
      providerId,
      emaLatencyMs: Math.round(stats.emaLatency),
      successRate,
      totalCalls: stats.total,
      score,
      betaSample,
      unitCostUsd: unitCost,
    };
  }

  rankChannelsByCost(channels: Channel[]): Channel[] {
    return costOptimizationEngine.optimizeChannelSequence(channels);
  }

  getDecisionTrace(
    channel: Channel,
    preferredProviderId?: string,
  ): {
    selected: string;
    score: number;
    costUsd: number;
    competitors: Array<{ provider: string; score: number; costUsd: number }>;
  } {
    const configured = ProviderRegistry.getConfiguredAdaptersByChannel(channel);
    const healthyAdapters = configured.filter((a) => providerCircuitBreaker.canExecute(a.id));
    const targetAdapters = healthyAdapters.length > 0 ? healthyAdapters : ProviderRegistry.getByChannel(channel);

    const ranked = targetAdapters
      .map((adapter) => {
        const sc = this.getScorecard(adapter.id);
        return {
          provider: adapter.id,
          score: sc.score,
          costUsd: sc.unitCostUsd ?? getProviderUnitCost(adapter.id),
        };
      })
      .sort((a, b) => b.score - a.score);

    const selected = ranked[0]?.provider || preferredProviderId || 'ses';
    const selectedItem = ranked.find((r) => r.provider === selected) || ranked[0];

    return {
      selected,
      score: selectedItem?.score ?? 100,
      costUsd: selectedItem?.costUsd ?? 0.001,
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
      return preferredProviderId || 'ses';
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
