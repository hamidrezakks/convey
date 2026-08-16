import {
  whatsappSessionCostSavedUsdTotal,
  whatsappSessionInboundTotal,
  whatsappSessionOptimizationsTotal,
} from '../../../index';

/**
 * High-performance, fail-safe metrics helper for WhatsApp Session Optimization.
 * Encapsulates Prometheus counters with zero hot-path dynamic import overhead.
 */
export const WhatsAppMetrics = {
  recordInboundMessage(providerId: string): void {
    try {
      whatsappSessionInboundTotal?.inc({ providerId });
    } catch {
      // Safe fallback when running in isolated unit test harnesses
    }
  },

  recordOptimizationApplied(providerId: string, savedUsd = 0.005): void {
    try {
      whatsappSessionOptimizationsTotal?.inc({ providerId });
      whatsappSessionCostSavedUsdTotal?.inc({ providerId }, savedUsd);
    } catch {
      // Safe fallback when running in isolated unit test harnesses
    }
  },
};
