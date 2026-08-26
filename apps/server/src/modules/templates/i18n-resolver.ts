import type { TemplateChannelConfig } from '@convey/shared';

/**
 * Resolves localized channel templates with hierarchical fallback logic.
 * Example: 'de-AT' -> 'de' -> 'en-US' (defaultLocale) -> base channel config.
 */
export const I18nResolver = {
  /**
   * Generates candidate locale keys in priority order.
   */
  getCandidateLocales(targetLocale?: string, defaultLocale = 'en-US'): string[] {
    const candidates: string[] = [];

    if (targetLocale && typeof targetLocale === 'string') {
      const clean = targetLocale.trim();
      if (clean) {
        candidates.push(clean);

        // Normalize hyphen vs underscore (e.g. de_DE <-> de-DE)
        if (clean.includes('-')) {
          candidates.push(clean.replace('-', '_'));
          const languageOnly = clean.split('-')[0];
          if (languageOnly && languageOnly !== clean) {
            candidates.push(languageOnly);
          }
        } else if (clean.includes('_')) {
          candidates.push(clean.replace('_', '-'));
          const languageOnly = clean.split('_')[0];
          if (languageOnly && languageOnly !== clean) {
            candidates.push(languageOnly);
          }
        }
      }
    }

    if (defaultLocale && !candidates.includes(defaultLocale)) {
      candidates.push(defaultLocale);
      if (defaultLocale.includes('-')) {
        const lang = defaultLocale.split('-')[0];
        if (lang && !candidates.includes(lang)) {
          candidates.push(lang);
        }
      }
    }

    return candidates;
  },

  /**
   * Resolves the localized channel configuration by merging the best matching translation onto the base config.
   */
  resolveLocalizedChannelConfig(
    baseConfig: TemplateChannelConfig,
    translations: Record<string, Partial<TemplateChannelConfig>> = {},
    targetLocale?: string,
    defaultLocale = 'en-US',
  ): { resolvedConfig: TemplateChannelConfig; matchedLocale: string } {
    if (!translations || Object.keys(translations).length === 0) {
      return { resolvedConfig: baseConfig, matchedLocale: defaultLocale };
    }

    const candidateLocales = this.getCandidateLocales(targetLocale, defaultLocale);

    for (const locale of candidateLocales) {
      const translation = translations[locale];
      if (translation && typeof translation === 'object') {
        const merged: TemplateChannelConfig = {
          email: translation.email ? { ...baseConfig.email, ...translation.email } : baseConfig.email,
          sms: translation.sms ? { ...baseConfig.sms, ...translation.sms } : baseConfig.sms,
          push: translation.push ? { ...baseConfig.push, ...translation.push } : baseConfig.push,
          chat: translation.chat ? { ...baseConfig.chat, ...translation.chat } : baseConfig.chat,
          whatsapp: translation.whatsapp ? { ...baseConfig.whatsapp, ...translation.whatsapp } : baseConfig.whatsapp,
        };

        return { resolvedConfig: merged, matchedLocale: locale };
      }
    }

    return { resolvedConfig: baseConfig, matchedLocale: defaultLocale };
  },
};
