/**
 * @convey/shared - Currencies
 * ISO-4217 Currency Standards, Metadata & Formatting Utilities
 */

export enum SupportedCurrency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  AED = 'AED',
  SAR = 'SAR',
  JPY = 'JPY',
  CAD = 'CAD',
  AUD = 'AUD',
  CHF = 'CHF',
  CNY = 'CNY',
  INR = 'INR',
  BRL = 'BRL',
  SGD = 'SGD',
  MXN = 'MXN',
  KRW = 'KRW',
  SEK = 'SEK',
  NOK = 'NOK',
  ZAR = 'ZAR',
}

export interface CurrencyMetadata {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  decimals: number;
  flagEmoji: string;
  symbolPosition: 'prefix' | 'suffix';
}

export const CURRENCY_REGISTRY: Record<SupportedCurrency, CurrencyMetadata> = {
  [SupportedCurrency.USD]: {
    code: SupportedCurrency.USD,
    symbol: '$',
    name: 'US Dollar',
    decimals: 2,
    flagEmoji: '🇺🇸',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.EUR]: {
    code: SupportedCurrency.EUR,
    symbol: '€',
    name: 'Euro',
    decimals: 2,
    flagEmoji: '🇪🇺',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.GBP]: {
    code: SupportedCurrency.GBP,
    symbol: '£',
    name: 'British Pound',
    decimals: 2,
    flagEmoji: '🇬🇧',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.AED]: {
    code: SupportedCurrency.AED,
    symbol: 'AED',
    name: 'UAE Dirham',
    decimals: 2,
    flagEmoji: '🇦🇪',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.SAR]: {
    code: SupportedCurrency.SAR,
    symbol: 'SAR',
    name: 'Saudi Riyal',
    decimals: 2,
    flagEmoji: '🇸🇦',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.JPY]: {
    code: SupportedCurrency.JPY,
    symbol: '¥',
    name: 'Japanese Yen',
    decimals: 0,
    flagEmoji: '🇯🇵',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.CAD]: {
    code: SupportedCurrency.CAD,
    symbol: 'CA$',
    name: 'Canadian Dollar',
    decimals: 2,
    flagEmoji: '🇨🇦',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.AUD]: {
    code: SupportedCurrency.AUD,
    symbol: 'AU$',
    name: 'Australian Dollar',
    decimals: 2,
    flagEmoji: '🇦🇺',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.CHF]: {
    code: SupportedCurrency.CHF,
    symbol: 'CHF',
    name: 'Swiss Franc',
    decimals: 2,
    flagEmoji: '🇨🇭',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.CNY]: {
    code: SupportedCurrency.CNY,
    symbol: '¥',
    name: 'Chinese Yuan',
    decimals: 2,
    flagEmoji: '🇨🇳',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.INR]: {
    code: SupportedCurrency.INR,
    symbol: '₹',
    name: 'Indian Rupee',
    decimals: 2,
    flagEmoji: '🇮🇳',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.BRL]: {
    code: SupportedCurrency.BRL,
    symbol: 'R$',
    name: 'Brazilian Real',
    decimals: 2,
    flagEmoji: '🇧🇷',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.SGD]: {
    code: SupportedCurrency.SGD,
    symbol: 'SG$',
    name: 'Singapore Dollar',
    decimals: 2,
    flagEmoji: '🇸🇬',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.MXN]: {
    code: SupportedCurrency.MXN,
    symbol: 'MX$',
    name: 'Mexican Peso',
    decimals: 2,
    flagEmoji: '🇲🇽',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.KRW]: {
    code: SupportedCurrency.KRW,
    symbol: '₩',
    name: 'South Korean Won',
    decimals: 0,
    flagEmoji: '🇰🇷',
    symbolPosition: 'prefix',
  },
  [SupportedCurrency.SEK]: {
    code: SupportedCurrency.SEK,
    symbol: 'kr',
    name: 'Swedish Krona',
    decimals: 2,
    flagEmoji: '🇸🇪',
    symbolPosition: 'suffix',
  },
  [SupportedCurrency.NOK]: {
    code: SupportedCurrency.NOK,
    symbol: 'kr',
    name: 'Norwegian Krone',
    decimals: 2,
    flagEmoji: '🇳🇴',
    symbolPosition: 'suffix',
  },
  [SupportedCurrency.ZAR]: {
    code: SupportedCurrency.ZAR,
    symbol: 'R',
    name: 'South African Rand',
    decimals: 2,
    flagEmoji: '🇿🇦',
    symbolPosition: 'prefix',
  },
};

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = Object.values(SupportedCurrency);

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return currency.toUpperCase() in CURRENCY_REGISTRY;
}

export function getCurrencyMetadata(currency: string = 'USD'): CurrencyMetadata {
  const normalized = currency.toUpperCase() as SupportedCurrency;
  return CURRENCY_REGISTRY[normalized] || CURRENCY_REGISTRY.USD;
}

export function formatCurrencyAmount(
  amount: number,
  currency: string = 'USD',
  options?: { showCode?: boolean; maximumFractionDigits?: number },
): string {
  const meta = getCurrencyMetadata(currency);
  const maxDigits = options?.maximumFractionDigits ?? Math.max(meta.decimals, 4);
  const formattedNumber = amount.toLocaleString('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: maxDigits,
  });
  const symbolStr =
    meta.symbolPosition === 'prefix' ? `${meta.symbol}${formattedNumber}` : `${formattedNumber} ${meta.symbol}`;
  return options?.showCode ? `${symbolStr} ${meta.code}` : symbolStr;
}
