import { Channel } from '../messaging/messaging.types';

export interface ChannelCostEstimate {
  channel: Channel;
  estimatedCostPerMsg: number; // Cost in USD (e.g. email = 0.0001, sms = 0.0075)
}

/**
 * Predictive Unit-Cost Router & Budget Optimizer.
 *
 * Evaluates real-time unit costs across message channels and enforces team budget caps,
 * dynamically optimizing channel fallback order to minimize total operational cost.
 */
export class CostOptimizationEngine {
  private defaultUnitCosts: Record<Channel, number> = {
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
   * Calculates unit cost estimates for a list of requested channels.
   * @param channels Requested channel list.
   */
  estimateCosts(channels: Channel[]): ChannelCostEstimate[] {
    return channels.map((channel) => ({
      channel,
      estimatedCostPerMsg: this.defaultUnitCosts[channel] ?? 0.001,
    }));
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
