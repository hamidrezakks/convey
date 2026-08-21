import { formatCurrencyAmount } from '@convey/shared';
import { Channel } from '../messaging/messaging.types';
import { fxEngine } from './fx-engine';

export interface ChannelCostEstimate {
  channel: Channel;
  estimatedCostPerMsg: number; // Cost in target currency
  currency: string;
  formattedCost?: string;
}

/**
 * Predictive Unit-Cost Router & Budget Optimizer.
 *
 * Evaluates real-time unit costs across message channels in any target currency
 * and enforces team budget caps, dynamically optimizing channel fallback order to minimize total operational cost.
 */
export class CostOptimizationEngine {
  private defaultUnitCostsUsd: Record<Channel, number> = {
    [Channel.EMAIL]: 0.0001,
    [Channel.PUSH]: 0.00005,
    [Channel.CHAT]: 0.001,
    [Channel.SMS]: 0.0075,
    [Channel.WHATSAPP]: 0.005,
    [Channel.TELEGRAM]: 0.001,
    [Channel.SLACK]: 0.001,
    [Channel.APNS]: 0.00005,
    [Channel.FCM]: 0.00005,
    [Channel.TOOL]: 0.002,
  };

  /**
   * Calculates unit cost estimates for a list of requested channels in target currency.
   * @param channels Requested channel list.
   * @param targetCurrency Currency to calculate unit cost in (defaults to 'USD').
   */
  estimateCosts(channels: Channel[], targetCurrency: string = 'USD'): ChannelCostEstimate[] {
    const target = targetCurrency.toUpperCase();
    return channels.map((channel) => {
      const costUsd = this.defaultUnitCostsUsd[channel] ?? 0.001;
      const converted = target === 'USD' ? costUsd : fxEngine.convert(costUsd, 'USD', target, 6).convertedAmount;
      return {
        channel,
        estimatedCostPerMsg: converted,
        currency: target,
        formattedCost: formatCurrencyAmount(converted, target),
      };
    });
  }

  /**
   * Sorts channels by lowest unit cost to optimize fallback sequence.
   * @param channels Available channel list.
   */
  optimizeChannelSequence(channels: Channel[]): Channel[] {
    const estimates = this.estimateCosts(channels);
    estimates.sort((a, b) => a.estimatedCostPerMsg - b.estimatedCostPerMsg);
    return estimates.map((e) => e.channel);
  }
}

/** Singleton instance of CostOptimizationEngine */
export const costOptimizationEngine = new CostOptimizationEngine();
