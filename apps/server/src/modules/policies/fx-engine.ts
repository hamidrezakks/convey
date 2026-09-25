import { formatCurrencyAmount, getCurrencyMetadata, SupportedCurrency } from '@convey/shared';
import { redisClient } from '../../queues/connection';
import { logger } from '../../utils/logger';
import { formatRedisKey } from '../../utils/redis-keys';

export interface FxConversionResult {
  sourceAmount: number;
  sourceCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  convertedAmount: number;
  amountUsd: number;
  formattedConverted: string;
}

export interface FxRateEntry {
  currency: string;
  rateToUsd: number; // How many units of currency per 1 USD (e.g. EUR = 0.924)
  symbol: string;
  name: string;
  updatedAt: Date;
}

/**
 * Planetary-Scale High-Precision Foreign Exchange (FX) Engine.
 *
 * Implements ISO-4217 currency conversions, fixed-point precision scaling,
 * triangular arbitrage-free currency exchange arithmetic, and Redis-synchronized dynamic rates.
 */
export class FxEngine {
  // Base rates pegged against 1.0 USD
  private rates: Map<string, number> = new Map([
    [SupportedCurrency.USD, 1.0],
    [SupportedCurrency.EUR, 0.924],
    [SupportedCurrency.GBP, 0.789],
    [SupportedCurrency.AED, 3.6725],
    [SupportedCurrency.SAR, 3.751],
    [SupportedCurrency.JPY, 155.45],
    [SupportedCurrency.CAD, 1.362],
    [SupportedCurrency.AUD, 1.518],
    [SupportedCurrency.CHF, 0.902],
    [SupportedCurrency.CNY, 7.235],
    [SupportedCurrency.INR, 83.52],
    [SupportedCurrency.BRL, 5.412],
    [SupportedCurrency.SGD, 1.348],
    [SupportedCurrency.MXN, 18.24],
    [SupportedCurrency.KRW, 1378.0],
    [SupportedCurrency.SEK, 10.58],
    [SupportedCurrency.NOK, 10.64],
    [SupportedCurrency.ZAR, 18.42],
  ]);

  private lastSyncMs = 0;
  private syncIntervalMs = 60_000;

  /**
   * Retrieves the rate to 1 USD for a given currency code.
   * Unknown currencies fail closed instead of silently being valued as USD.
   */
  public getRateToUsd(currency: string): number {
    const code = (currency || 'USD').toUpperCase();
    const rate = this.rates.get(code);
    if (rate === undefined || !Number.isFinite(rate) || rate <= 0) throw new Error(`No valid FX rate for ${code}`);
    return rate;
  }

  /**
   * Calculates the exact cross-currency exchange rate between fromCurrency and toCurrency.
   * Formula: Rate(From -> To) = RateToUsd(To) / RateToUsd(From)
   * Formatted to 8 decimal places for fixed-point financial precision.
   */
  public getExchangeRate(fromCurrency: string, toCurrency: string): number {
    const from = (fromCurrency || 'USD').toUpperCase();
    const to = (toCurrency || 'USD').toUpperCase();

    this.getRateToUsd(from);
    this.getRateToUsd(to);
    if (from === to) {
      return 1.0;
    }

    const fromRate = this.getRateToUsd(from);
    const toRate = this.getRateToUsd(to);

    if (fromRate <= 0) return 1.0;

    const crossRate = toRate / fromRate;
    return Number(crossRate.toFixed(8));
  }

  public convert(
    amount: number,
    fromCurrency: string = 'USD',
    toCurrency: string = 'USD',
    precision: number = 4,
  ): FxConversionResult {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid currency amount');
    const from = (fromCurrency || 'USD').toUpperCase();
    const to = (toCurrency || 'USD').toUpperCase();
    const rate = this.getExchangeRate(from, to);

    // Fixed-point currency rounding
    const convertedAmount = Number((amount * rate).toFixed(precision));

    // USD base amount for reporting and indexing
    const fromRate = this.getRateToUsd(from);
    const amountUsd = from === 'USD' ? amount : Number((amount / fromRate).toFixed(precision));

    return {
      sourceAmount: amount,
      sourceCurrency: from,
      targetCurrency: to,
      exchangeRate: rate,
      convertedAmount,
      amountUsd,
      formattedConverted: formatCurrencyAmount(convertedAmount, to, { maximumFractionDigits: precision }),
    };
  }

  /**
   * Normalizes an amount from any currency into USD.
   */
  public toUsd(amount: number, fromCurrency: string): number {
    const from = (fromCurrency || 'USD').toUpperCase();
    if (from === 'USD') return amount;
    const fromRate = this.getRateToUsd(from);
    return Number((amount / fromRate).toFixed(4));
  }

  /**
   * Overrides or registers a dynamic FX rate for a currency against USD base.
   */
  public setRate(currency: string, rateToUsd: number): void {
    if (!Number.isFinite(rateToUsd) || rateToUsd <= 0) {
      throw new Error(`Invalid exchange rate: ${rateToUsd} for currency ${currency}`);
    }
    const code = currency.toUpperCase();
    this.rates.set(code, rateToUsd);
    logger.info('FxEngine', `Updated FX rate for ${code} to ${rateToUsd} USD`);
  }

  /**
   * Returns a snapshot of all active currency exchange rates.
   */
  public getAllRates(): FxRateEntry[] {
    const entries: FxRateEntry[] = [];
    const now = new Date();

    for (const [code, rate] of this.rates.entries()) {
      const meta = getCurrencyMetadata(code);
      entries.push({
        currency: code,
        rateToUsd: rate,
        symbol: meta.symbol,
        name: meta.name,
        updatedAt: now,
      });
    }

    return entries;
  }

  /**
   * Synchronizes dynamic rates from Redis key `fx:rates` if available.
   */
  public async syncRatesFromRedis(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSyncMs < this.syncIntervalMs) {
      return;
    }
    this.lastSyncMs = now;

    try {
      const redisKey = formatRedisKey('fx:rates');
      const customRates = await redisClient.hgetall(redisKey);
      if (customRates && Object.keys(customRates).length > 0) {
        for (const [curr, rateStr] of Object.entries(customRates)) {
          const parsed = Number.parseFloat(rateStr);
          if (Number.isFinite(parsed) && parsed > 0) {
            this.rates.set(curr.toUpperCase(), parsed);
          }
        }
      }
    } catch {
      // Redis unavailable; continue with in-memory rates
    }
  }
}

export const fxEngine = new FxEngine();
