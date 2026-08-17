import type { LocaleConfig, SupportedLocale, TranslationSchema } from '../types';
import { ar } from './ar';
import { en } from './en';
import { es } from './es';
import { fa } from './fa';
import { fr } from './fr';
import { hi } from './hi';
import { pt } from './pt';
import { zh } from './zh';

export const DICTIONARIES: Record<SupportedLocale, TranslationSchema> = {
  en,
  zh,
  hi,
  es,
  ar,
  fr,
  pt,
  fa,
};

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
    flag: '🇺🇸',
    region: 'Global / North America',
  },
  {
    code: 'fa',
    name: 'Persian',
    nativeName: 'فارسی',
    dir: 'rtl',
    flag: '🇮🇷',
    region: 'Middle East',
    fontFamily: '"Vazirmatn", system-ui, -apple-system, sans-serif',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl',
    flag: '🇸🇦',
    region: 'Middle East & North Africa',
    fontFamily: '"Vazirmatn", "Segoe UI", system-ui, sans-serif',
  },
  {
    code: 'zh',
    name: 'Chinese (Simplified)',
    nativeName: '中文 (简体)',
    dir: 'ltr',
    flag: '🇨🇳',
    region: 'East Asia',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    dir: 'ltr',
    flag: '🇮🇳',
    region: 'South Asia',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    dir: 'ltr',
    flag: '🇪🇸',
    region: 'Europe & Latin America',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    dir: 'ltr',
    flag: '🇫🇷',
    region: 'Europe & Africa',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    dir: 'ltr',
    flag: '🇧🇷',
    region: 'Latin America & Europe',
  },
];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const LOCALE_CONFIG_MAP: Record<SupportedLocale, LocaleConfig> = SUPPORTED_LOCALES.reduce(
  (acc, item) => {
    acc[item.code] = item;
    return acc;
  },
  {} as Record<SupportedLocale, LocaleConfig>,
);
