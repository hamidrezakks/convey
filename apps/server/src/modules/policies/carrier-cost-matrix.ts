import type { CarrierCostEvaluationResult, CarrierRateCardDto, Channel } from '@convey/shared';
import { providerCircuitBreaker } from '../providers/core/circuit-breaker';

/**
 * Standard default global carrier rate cards (USD per outbound dispatch).
 * In production, these can be augmented with real-time vendor API rate card sync.
 */
const DEFAULT_CARRIER_RATES: CarrierRateCardDto[] = [
  // US (+1)
  {
    countryCode: '+1',
    countryName: 'United States',
    channel: 'sms',
    providerId: 'telnyx',
    unitCostUsd: 0.004,
    qualityScore: 0.99,
  },
  {
    countryCode: '+1',
    countryName: 'United States',
    channel: 'sms',
    providerId: 'plivo',
    unitCostUsd: 0.005,
    qualityScore: 0.98,
  },
  {
    countryCode: '+1',
    countryName: 'United States',
    channel: 'sms',
    providerId: 'twilio',
    unitCostUsd: 0.0079,
    qualityScore: 0.99,
  },
  {
    countryCode: '+1',
    countryName: 'United States',
    channel: 'sms',
    providerId: 'sinch',
    unitCostUsd: 0.0065,
    qualityScore: 0.97,
  },

  // UK (+44)
  {
    countryCode: '+44',
    countryName: 'United Kingdom',
    channel: 'sms',
    providerId: 'telnyx',
    unitCostUsd: 0.032,
    qualityScore: 0.98,
  },
  {
    countryCode: '+44',
    countryName: 'United Kingdom',
    channel: 'sms',
    providerId: 'sinch',
    unitCostUsd: 0.038,
    qualityScore: 0.98,
  },
  {
    countryCode: '+44',
    countryName: 'United Kingdom',
    channel: 'sms',
    providerId: 'twilio',
    unitCostUsd: 0.045,
    qualityScore: 0.99,
  },
  {
    countryCode: '+44',
    countryName: 'United Kingdom',
    channel: 'sms',
    providerId: 'infobip',
    unitCostUsd: 0.035,
    qualityScore: 0.97,
  },

  // Germany (+49)
  {
    countryCode: '+49',
    countryName: 'Germany',
    channel: 'sms',
    providerId: 'infobip',
    unitCostUsd: 0.062,
    qualityScore: 0.99,
  },
  {
    countryCode: '+49',
    countryName: 'Germany',
    channel: 'sms',
    providerId: 'sinch',
    unitCostUsd: 0.068,
    qualityScore: 0.98,
  },
  {
    countryCode: '+49',
    countryName: 'Germany',
    channel: 'sms',
    providerId: 'twilio',
    unitCostUsd: 0.078,
    qualityScore: 0.99,
  },

  // UAE (+971)
  {
    countryCode: '+971',
    countryName: 'United Arab Emirates',
    channel: 'sms',
    providerId: 'infobip',
    unitCostUsd: 0.042,
    qualityScore: 0.99,
  },
  {
    countryCode: '+971',
    countryName: 'United Arab Emirates',
    channel: 'sms',
    providerId: 'unifonic',
    unitCostUsd: 0.045,
    qualityScore: 0.98,
  },
  {
    countryCode: '+971',
    countryName: 'United Arab Emirates',
    channel: 'sms',
    providerId: 'twilio',
    unitCostUsd: 0.061,
    qualityScore: 0.99,
  },

  // Brazil (+55)
  {
    countryCode: '+55',
    countryName: 'Brazil',
    channel: 'sms',
    providerId: 'zenvia',
    unitCostUsd: 0.018,
    qualityScore: 0.99,
  },
  {
    countryCode: '+55',
    countryName: 'Brazil',
    channel: 'sms',
    providerId: 'sinch',
    unitCostUsd: 0.022,
    qualityScore: 0.98,
  },
  {
    countryCode: '+55',
    countryName: 'Brazil',
    channel: 'sms',
    providerId: 'twilio',
    unitCostUsd: 0.031,
    qualityScore: 0.98,
  },

  // India (+91)
  {
    countryCode: '+91',
    countryName: 'India',
    channel: 'sms',
    providerId: 'gupshup',
    unitCostUsd: 0.0022,
    qualityScore: 0.98,
  },
  {
    countryCode: '+91',
    countryName: 'India',
    channel: 'sms',
    providerId: 'msg91',
    unitCostUsd: 0.0024,
    qualityScore: 0.98,
  },
  {
    countryCode: '+91',
    countryName: 'India',
    channel: 'sms',
    providerId: 'twilio',
    unitCostUsd: 0.0068,
    qualityScore: 0.99,
  },
];

export const CarrierCostMatrix = {
  /**
   * Extracts dialing country code from an E.164 phone string.
   */
  extractCountryCode(recipient: string): string {
    if (!recipient || typeof recipient !== 'string') return '+1';

    const clean = recipient.trim().replace(/^00/, '+');
    if (!clean.startsWith('+')) return '+1';

    // Check 4-digit, 3-digit, 2-digit, and 1-digit prefixes
    const prefixes = [clean.slice(0, 5), clean.slice(0, 4), clean.slice(0, 3), clean.slice(0, 2)];

    for (const prefix of prefixes) {
      if (DEFAULT_CARRIER_RATES.some((r) => r.countryCode === prefix)) {
        return prefix;
      }
    }

    return clean.slice(0, 2) || '+1';
  },

  /**
   * Evaluates least-cost carrier routing for a given channel and recipient.
   * Considers provider circuit health, unit cost, and fallback redundancy.
   */
  evaluateLeastCostRouting(
    channel: Channel,
    recipient: string,
    configuredProviderIds: string[] = [],
  ): CarrierCostEvaluationResult | null {
    if (channel !== 'sms') {
      return null;
    }

    const countryCode = this.extractCountryCode(recipient);
    const candidateRates = DEFAULT_CARRIER_RATES.filter((r) => r.channel === channel && r.countryCode === countryCode);

    if (candidateRates.length === 0) {
      return null;
    }

    // Filter by configured providers (or use all catalog rates if none specified)
    const availableRates =
      configuredProviderIds.length > 0
        ? candidateRates.filter((r) => configuredProviderIds.includes(r.providerId))
        : candidateRates;

    if (availableRates.length === 0) {
      return null;
    }

    // Sort by circuit health (canExecute) then by lowest unitCostUsd
    const sorted = [...availableRates].sort((a, b) => {
      const aHealthy = providerCircuitBreaker.canExecute(a.providerId);
      const bHealthy = providerCircuitBreaker.canExecute(b.providerId);

      if (aHealthy && !bHealthy) return -1;
      if (!aHealthy && bHealthy) return 1;

      return a.unitCostUsd - b.unitCostUsd;
    });

    const selected = sorted[0];
    const mostExpensive = [...availableRates].sort((a, b) => b.unitCostUsd - a.unitCostUsd)[0];
    const projectedSavings = Math.max(0, mostExpensive.unitCostUsd - selected.unitCostUsd);

    const fallbackCascade = sorted.slice(1).map((r) => r.providerId);

    return {
      countryCode,
      selectedProviderId: selected.providerId,
      estimatedCostUsd: selected.unitCostUsd,
      projectedSavingsUsd: projectedSavings,
      cheapestAlternativeProviderId: fallbackCascade[0],
      fallbackCascade,
    };
  },

  /**
   * Retrieves full carrier rate cards.
   */
  getRateCards(): CarrierRateCardDto[] {
    return DEFAULT_CARRIER_RATES;
  },
};
