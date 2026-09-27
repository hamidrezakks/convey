import { describe, expect, it } from 'bun:test';
import { formatCurrencyAmount, getCurrencyMetadata, isSupportedCurrency } from '@convey/shared';
import { FxEngine, fxEngine } from '../src/modules/policies/fx-engine';

describe('FxEngine & Multi-Currency Standards', () => {
  it('correctly resolves metadata for all supported ISO-4217 currencies', () => {
    expect(isSupportedCurrency('USD')).toBe(true);
    expect(isSupportedCurrency('eur')).toBe(true);
    expect(isSupportedCurrency('AED')).toBe(true);
    expect(isSupportedCurrency('XYZ123')).toBe(false);

    const usdMeta = getCurrencyMetadata('USD');
    expect(usdMeta.symbol).toBe('$');
    expect(usdMeta.decimals).toBe(2);

    const aedMeta = getCurrencyMetadata('AED');
    expect(aedMeta.symbol).toBe('AED');

    const jpyMeta = getCurrencyMetadata('JPY');
    expect(jpyMeta.symbol).toBe('¥');
    expect(jpyMeta.decimals).toBe(0);
  });

  it('formats currency amounts with localized symbols and precision', () => {
    expect(formatCurrencyAmount(1234.56, 'USD')).toBe('$1,234.56');
    expect(formatCurrencyAmount(5000, 'EUR')).toBe('€5,000.00');
    expect(formatCurrencyAmount(100.5, 'AED', { showCode: true })).toBe('AED100.50 AED');
    expect(formatCurrencyAmount(500, 'SEK')).toBe('500.00 kr');
  });

  it('performs identity conversions (USD -> USD, EUR -> EUR) with rate 1.0', () => {
    const resUsd = fxEngine.convert(100, 'USD', 'USD');
    expect(resUsd.exchangeRate).toBe(1.0);
    expect(resUsd.convertedAmount).toBe(100.0);
    expect(resUsd.amountUsd).toBe(100.0);

    const resEur = fxEngine.convert(50, 'EUR', 'EUR');
    expect(resEur.exchangeRate).toBe(1.0);
    expect(resEur.convertedAmount).toBe(50.0);
  });

  it('accurately converts base USD to foreign currencies', () => {
    // 100 USD -> EUR (0.924) => 92.4000
    const resEur = fxEngine.convert(100, 'USD', 'EUR');
    expect(resEur.exchangeRate).toBe(0.924);
    expect(resEur.convertedAmount).toBe(92.4);

    // 100 USD -> AED (3.6725) => 367.2500
    const resAed = fxEngine.convert(100, 'USD', 'AED');
    expect(resAed.exchangeRate).toBe(3.6725);
    expect(resAed.convertedAmount).toBe(367.25);
  });

  it('accurately converts cross currencies using triangular arbitrage-free math', () => {
    // 100 EUR to AED:
    // EUR rate = 0.924, AED rate = 3.6725
    // Cross rate = 3.6725 / 0.924 = 3.97456710
    const res = fxEngine.convert(100, 'EUR', 'AED');
    expect(res.exchangeRate).toBeCloseTo(3.9745671, 5);
    expect(res.convertedAmount).toBe(397.4567);
  });

  it('converts amounts to USD baseline', () => {
    const usdEquivalent = fxEngine.toUsd(92.4, 'EUR');
    expect(usdEquivalent).toBe(100.0);
  });

  it('supports custom dynamic rate updates', () => {
    const engine = new FxEngine();
    engine.setRate('TEST_CURR', 2.5);
    expect(engine.getRateToUsd('TEST_CURR')).toBe(2.5);

    const conv = engine.convert(10, 'USD', 'TEST_CURR');
    expect(conv.convertedAmount).toBe(25.0);
  });

  it('rejects unknown currencies and invalid amounts/rates', () => {
    expect(() => fxEngine.convert(50, 'UNKNOWN_CURR', 'USD')).toThrow();
    for (const value of [NaN, Infinity, -1]) {
      expect(() => new FxEngine().setRate('EUR', value)).toThrow();
      expect(() => fxEngine.convert(value, 'USD', 'EUR')).toThrow();
    }
  });
});
