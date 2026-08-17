import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, DICTIONARIES, LOCALE_CONFIG_MAP, SUPPORTED_LOCALES } from './locales';
import type { LocaleConfig, LocaleDirection, SupportedLocale, TranslationKey } from './types';

const STORAGE_KEY = 'convey_locale_preference';

export interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  dir: LocaleDirection;
  config: LocaleConfig;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (isoString: string) => string;
  supportedLocales: LocaleConfig[];
}

function resolveNestedKey(obj: unknown, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const segments = path.split('.');
  let current: unknown = obj;
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  let result = text;
  for (const [key, value] of Object.entries(params)) {
    // Supports both {{key}} and {key}
    result = result.replaceAll(`{{${key}}}`, String(value));
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
}

function detectInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in DICTIONARIES) {
      return saved as SupportedLocale;
    }

    const browserLang = navigator.language?.toLowerCase() || '';
    if (browserLang.startsWith('fa')) return 'fa';
    if (browserLang.startsWith('zh')) return 'zh';
    if (browserLang.startsWith('hi')) return 'hi';
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('ar')) return 'ar';
    if (browserLang.startsWith('fr')) return 'fr';
    if (browserLang.startsWith('pt')) return 'pt';
  } catch {
    // Ignore storage access errors
  }

  return DEFAULT_LOCALE;
}

function createTranslator(locale: SupportedLocale) {
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    const currentDict = DICTIONARIES[locale];
    const fallbackDict = DICTIONARIES[DEFAULT_LOCALE];

    let translation = resolveNestedKey(currentDict, key);
    if (translation === undefined) {
      translation = resolveNestedKey(fallbackDict, key);
    }

    if (translation === undefined) {
      return key;
    }

    return interpolate(translation, params);
  };
}

const defaultI18nValue: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  dir: 'ltr',
  config: LOCALE_CONFIG_MAP[DEFAULT_LOCALE],
  t: createTranslator(DEFAULT_LOCALE),
  formatNumber: (num: number) => num.toLocaleString('en-US'),
  formatCurrency: (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount),
  formatDate: (date: string | Date | number) => new Date(date).toLocaleString('en-US'),
  formatRelativeTime: (isoString: string) => {
    const parsedTime = new Date(isoString).getTime();
    if (Number.isNaN(parsedTime)) return '-';
    const seconds = Math.floor((Date.now() - parsedTime) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  },
  supportedLocales: SUPPORTED_LOCALES,
};

export const I18nContext = createContext<I18nContextValue>(defaultI18nValue);

export interface I18nProviderProps {
  children: React.ReactNode;
  initialLocale?: SupportedLocale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => initialLocale || detectInitialLocale());

  const config = useMemo(() => LOCALE_CONFIG_MAP[locale] || LOCALE_CONFIG_MAP[DEFAULT_LOCALE], [locale]);

  const setLocale = (newLocale: SupportedLocale) => {
    if (newLocale in DICTIONARIES) {
      setLocaleState(newLocale);
      try {
        localStorage.setItem(STORAGE_KEY, newLocale);
      } catch {
        // Ignore storage write errors
      }
    }
  };

  // Sync document root direction and lang attributes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = config.dir;
      document.documentElement.lang = locale;
      if (config.dir === 'rtl') {
        document.body.classList.add('rtl-layout');
      } else {
        document.body.classList.remove('rtl-layout');
      }
    }
  }, [locale, config]);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const formatNumber = useMemo(() => {
    return (num: number, options?: Intl.NumberFormatOptions): string => {
      if (num === undefined || num === null || Number.isNaN(num)) return '0';
      try {
        return new Intl.NumberFormat(locale, options).format(num);
      } catch {
        return num.toLocaleString();
      }
    };
  }, [locale]);

  const formatCurrency = useMemo(() => {
    return (amount: number, currency = 'USD'): string => {
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
      } catch {
        return `$${amount.toFixed(2)}`;
      }
    };
  }, [locale]);

  const formatDate = useMemo(() => {
    return (date: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
      try {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        return new Intl.DateTimeFormat(locale, options).format(d);
      } catch {
        return String(date);
      }
    };
  }, [locale]);

  const formatRelativeTime = useMemo(() => {
    return (isoString: string): string => {
      if (!isoString) return '-';
      const parsedTime = new Date(isoString).getTime();
      if (Number.isNaN(parsedTime)) return '-';

      const diffSec = Math.floor((Date.now() - parsedTime) / 1000);
      try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second');
        const diffMin = Math.floor(diffSec / 60);
        if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
        const diffHour = Math.floor(diffMin / 60);
        if (Math.abs(diffHour) < 24) return rtf.format(-diffHour, 'hour');
        const diffDay = Math.floor(diffHour / 24);
        return rtf.format(-diffDay, 'day');
      } catch {
        if (diffSec < 60) return `${diffSec}s ago`;
        const minutes = Math.floor(diffSec / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
      }
    };
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      dir: config.dir,
      config,
      t,
      formatNumber,
      formatCurrency,
      formatDate,
      formatRelativeTime,
      supportedLocales: SUPPORTED_LOCALES,
    }),
    [locale, config, t, formatNumber, formatCurrency, formatDate, formatRelativeTime],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export const useTranslation = useI18n;
