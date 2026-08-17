import './setup';
import { beforeEach, describe, expect, it } from 'bun:test';
import { fireEvent, render } from '@testing-library/react';
import {
  DEFAULT_LOCALE,
  DICTIONARIES,
  I18nProvider,
  LanguageSwitcher,
  LOCALE_CONFIG_MAP,
  SUPPORTED_LOCALES,
  useI18n,
} from '../src/i18n';
import type { SupportedLocale } from '../src/i18n/types';

function getAllObjectKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...getAllObjectKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function TestConsumer() {
  const { locale, setLocale, dir, config, t, formatNumber, formatCurrency, formatRelativeTime } = useI18n();

  return (
    <div data-testid="i18n-test-root">
      <span data-testid="current-locale">{locale}</span>
      <span data-testid="current-dir">{dir}</span>
      <span data-testid="native-name">{config.nativeName}</span>
      <span data-testid="translated-title">{t('overview.title')}</span>
      <span data-testid="translated-refresh">{t('common.refresh')}</span>
      <span data-testid="interpolated-msg">{t('messages.totalMessagesCount', { count: 1234 })}</span>

      <span data-testid="formatted-num">{formatNumber(1234567)}</span>
      <span data-testid="formatted-curr">{formatCurrency(99.5)}</span>
      <span data-testid="formatted-time-ago">{formatRelativeTime(new Date(Date.now() - 60000).toISOString())}</span>

      <button type="button" data-testid="switch-fa" onClick={() => setLocale('fa')}>
        Switch to Farsi
      </button>
      <button type="button" data-testid="switch-zh" onClick={() => setLocale('zh')}>
        Switch to Chinese
      </button>
      <button type="button" data-testid="switch-ar" onClick={() => setLocale('ar')}>
        Switch to Arabic
      </button>
      <button type="button" data-testid="switch-es" onClick={() => setLocale('es')}>
        Switch to Spanish
      </button>
      <button type="button" data-testid="switch-hi" onClick={() => setLocale('hi')}>
        Switch to Hindi
      </button>
      <button type="button" data-testid="switch-fr" onClick={() => setLocale('fr')}>
        Switch to French
      </button>
      <button type="button" data-testid="switch-pt" onClick={() => setLocale('pt')}>
        Switch to Portuguese
      </button>
      <button type="button" data-testid="switch-en" onClick={() => setLocale('en')}>
        Switch to English
      </button>
    </div>
  );
}

describe('Convey Enterprise i18n & RTL Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
  });

  describe('1. Dictionary Completeness & Schema Parity (All 8 Languages)', () => {
    const expectedLocales: SupportedLocale[] = ['en', 'zh', 'hi', 'es', 'ar', 'fr', 'pt', 'fa'];
    const canonicalKeys = getAllObjectKeys(DICTIONARIES.en);

    it('contains all 8 requested languages in SUPPORTED_LOCALES', () => {
      expect(SUPPORTED_LOCALES.length).toBe(8);
      const codes = SUPPORTED_LOCALES.map((l) => l.code);
      for (const expected of expectedLocales) {
        expect(codes).toContain(expected);
      }
    });

    it('ensures every supported language has a valid configuration mapping', () => {
      for (const loc of expectedLocales) {
        const config = LOCALE_CONFIG_MAP[loc];
        expect(config).toBeDefined();
        expect(config.code).toBe(loc);
        expect(config.name).toBeTruthy();
        expect(config.nativeName).toBeTruthy();
        expect(config.flag).toBeTruthy();
        expect(['ltr', 'rtl']).toContain(config.dir);
      }
    });

    it('verifies Arabic (ar) and Persian / Farsi (fa) are correctly designated as RTL', () => {
      expect(LOCALE_CONFIG_MAP.ar.dir).toBe('rtl');
      expect(LOCALE_CONFIG_MAP.fa.dir).toBe('rtl');
      expect(LOCALE_CONFIG_MAP.en.dir).toBe('ltr');
      expect(LOCALE_CONFIG_MAP.zh.dir).toBe('ltr');
      expect(LOCALE_CONFIG_MAP.hi.dir).toBe('ltr');
      expect(LOCALE_CONFIG_MAP.es.dir).toBe('ltr');
      expect(LOCALE_CONFIG_MAP.fr.dir).toBe('ltr');
      expect(LOCALE_CONFIG_MAP.pt.dir).toBe('ltr');
    });

    for (const loc of expectedLocales) {
      it(`verifies dictionary "${loc}" has 100% parity with canonical schema without missing keys`, () => {
        const dict = DICTIONARIES[loc];
        expect(dict).toBeDefined();
        const dictKeys = getAllObjectKeys(dict);

        for (const canonicalKey of canonicalKeys) {
          expect(dictKeys).toContain(canonicalKey);
          // Ensure value is not empty or undefined
          const segments = canonicalKey.split('.');
          let val: unknown = dict;
          for (const s of segments) {
            val = (val as Record<string, unknown>)?.[s];
          }
          expect(typeof val).toBe('string');
          expect((val as string).length).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('2. I18nProvider & Reactive Locale Switching', () => {
    it('initializes with default locale (en) and LTR direction', () => {
      const { getByTestId } = render(
        <I18nProvider>
          <TestConsumer />
        </I18nProvider>,
      );

      expect(getByTestId('current-locale').textContent).toBe('en');
      expect(getByTestId('current-dir').textContent).toBe('ltr');
      expect(getByTestId('translated-title').textContent).toBe('Planetary Telemetry & Ops Center');
      expect(getByTestId('translated-refresh').textContent).toBe('Refresh');
    });

    it('switches to Persian (fa), updates direction to RTL and updates document attributes', () => {
      const { getByTestId } = render(
        <I18nProvider>
          <TestConsumer />
        </I18nProvider>,
      );

      fireEvent.click(getByTestId('switch-fa'));

      expect(getByTestId('current-locale').textContent).toBe('fa');
      expect(getByTestId('current-dir').textContent).toBe('rtl');
      expect(getByTestId('native-name').textContent).toBe('فارسی');
      expect(getByTestId('translated-title').textContent).toBe('مرکز عملیات و تله‌متری سیاره‌ای');
      expect(getByTestId('translated-refresh').textContent).toBe('تازه‌سازی');
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('fa');
      expect(localStorage.getItem('convey_locale_preference')).toBe('fa');
    });

    it('switches to Arabic (ar), sets RTL direction and Arabic translations', () => {
      const { getByTestId } = render(
        <I18nProvider>
          <TestConsumer />
        </I18nProvider>,
      );

      fireEvent.click(getByTestId('switch-ar'));

      expect(getByTestId('current-locale').textContent).toBe('ar');
      expect(getByTestId('current-dir').textContent).toBe('rtl');
      expect(getByTestId('native-name').textContent).toBe('العربية');
      expect(getByTestId('translated-title').textContent).toBe('مركز القياس والعمليات الكوكبي');
      expect(getByTestId('translated-refresh').textContent).toBe('تحديث');
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('ar');
    });

    it('switches to Chinese (zh), Hindi (hi), Spanish (es), French (fr), Portuguese (pt)', () => {
      const { getByTestId } = render(
        <I18nProvider>
          <TestConsumer />
        </I18nProvider>,
      );

      // Chinese
      fireEvent.click(getByTestId('switch-zh'));
      expect(getByTestId('current-locale').textContent).toBe('zh');
      expect(getByTestId('translated-title').textContent).toBe('全球行星遥测与运维中控台');
      expect(getByTestId('translated-refresh').textContent).toBe('刷新');

      // Hindi
      fireEvent.click(getByTestId('switch-hi'));
      expect(getByTestId('current-locale').textContent).toBe('hi');
      expect(getByTestId('translated-title').textContent).toBe('प्लेनेटरी टेलीमेट्री और ऑप्स सेंटर');
      expect(getByTestId('translated-refresh').textContent).toBe('रीफ़्रेश करें');

      // Spanish
      fireEvent.click(getByTestId('switch-es'));
      expect(getByTestId('current-locale').textContent).toBe('es');
      expect(getByTestId('translated-title').textContent).toBe('Centro de Telemetría y Operaciones Planetarias');
      expect(getByTestId('translated-refresh').textContent).toBe('Actualizar');

      // French
      fireEvent.click(getByTestId('switch-fr'));
      expect(getByTestId('current-locale').textContent).toBe('fr');
      expect(getByTestId('translated-title').textContent).toBe('Centre de Télémétrie et d’Opérations Planétaires');
      expect(getByTestId('translated-refresh').textContent).toBe('Actualiser');

      // Portuguese
      fireEvent.click(getByTestId('switch-pt'));
      expect(getByTestId('current-locale').textContent).toBe('pt');
      expect(getByTestId('translated-title').textContent).toBe('Centro de Telemetria e Operações Planetárias');
      expect(getByTestId('translated-refresh').textContent).toBe('Atualizar');
    });

    it('restores locale preference from localStorage on mounting', () => {
      localStorage.setItem('convey_locale_preference', 'fa');

      const { getByTestId } = render(
        <I18nProvider>
          <TestConsumer />
        </I18nProvider>,
      );

      expect(getByTestId('current-locale').textContent).toBe('fa');
      expect(getByTestId('current-dir').textContent).toBe('rtl');
    });

    it('gracefully degrades with fallback if useI18n is invoked outside I18nProvider', () => {
      const { getByTestId } = render(<TestConsumer />);
      expect(getByTestId('current-locale').textContent).toBe(DEFAULT_LOCALE);
      expect(getByTestId('translated-title').textContent).toBe('Planetary Telemetry & Ops Center');
    });
  });

  describe('3. LanguageSwitcher Dropdown Component', () => {
    it('renders language switcher button with current flag and native name', () => {
      const { getByText } = render(
        <I18nProvider initialLocale="fa">
          <LanguageSwitcher />
        </I18nProvider>,
      );

      expect(getByText('فارسی')).toBeDefined();
      expect(getByText('🇮🇷')).toBeDefined();
    });

    it('opens dropdown menu with all 8 languages on click and allows selection', () => {
      const { getByText, getByRole, getByTestId } = render(
        <I18nProvider initialLocale="en">
          <LanguageSwitcher />
          <TestConsumer />
        </I18nProvider>,
      );

      const triggerBtn = getByRole('button', { name: /Language/i });
      fireEvent.click(triggerBtn);

      // Verify dropdown shows options
      expect(getByText('8 Supported')).toBeDefined();
      expect(getByText('فارسی')).toBeDefined();
      expect(getByText('中文 (简体)')).toBeDefined();
      expect(getByText('हिन्दी')).toBeDefined();
      expect(getByText('Español')).toBeDefined();
      expect(getByText('العربية')).toBeDefined();
      expect(getByText('Français')).toBeDefined();
      expect(getByText('Português')).toBeDefined();

      // Click Farsi option
      const farsiOption = getByText('فارسی').closest('button');
      if (farsiOption) {
        fireEvent.click(farsiOption);
      }

      expect(getByTestId('current-locale').textContent).toBe('fa');
      expect(getByTestId('current-dir').textContent).toBe('rtl');
    });
  });
});
