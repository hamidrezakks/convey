export interface TimezoneResolution {
  country: string;
  ianaTimezone: string;
  utcOffsetHours: number;
}

const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  US: 'America/New_York',
  CA: 'America/Toronto',
  GB: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh',
  IN: 'Asia/Kolkata',
  SG: 'Asia/Singapore',
  JP: 'Asia/Tokyo',
  AU: 'Australia/Sydney',
  BR: 'America/Sao_Paulo',
  MX: 'America/Mexico_City',
  NL: 'Europe/Amsterdam',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  EG: 'Africa/Cairo',
  ZA: 'Africa/Johannesburg',
  NG: 'Africa/Lagos',
  KE: 'Africa/Nairobi',
};

const DIAL_CODE_PREFIXES: Array<{ prefix: string; country: string }> = [
  { prefix: '+971', country: 'AE' },
  { prefix: '+966', country: 'SA' },
  { prefix: '+91', country: 'IN' },
  { prefix: '+81', country: 'JP' },
  { prefix: '+65', country: 'SG' },
  { prefix: '+61', country: 'AU' },
  { prefix: '+55', country: 'BR' },
  { prefix: '+52', country: 'MX' },
  { prefix: '+49', country: 'DE' },
  { prefix: '+44', country: 'GB' },
  { prefix: '+39', country: 'IT' },
  { prefix: '+34', country: 'ES' },
  { prefix: '+33', country: 'FR' },
  { prefix: '+31', country: 'NL' },
  { prefix: '+27', country: 'ZA' },
  { prefix: '+20', country: 'EG' },
  { prefix: '+1', country: 'US' },
];

export const TimezoneResolver = {
  /**
   * Computes approximate UTC offset hours for a given IANA timezone at current time.
   */
  getUtcOffsetHours(ianaTimezone: string, date = new Date()): number {
    try {
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: ianaTimezone }));
      return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
    } catch {
      return 0;
    }
  },

  /**
   * Resolves recipient country code and E.164 phone to an IANA timezone string.
   */
  resolve(country?: string, phone?: string): TimezoneResolution {
    let resolvedCountry = country?.toUpperCase();

    if ((!resolvedCountry || resolvedCountry === 'ALL' || resolvedCountry === 'XX') && phone) {
      const match = DIAL_CODE_PREFIXES.find((item) => phone.startsWith(item.prefix));
      if (match) {
        resolvedCountry = match.country;
      }
    }

    resolvedCountry = resolvedCountry && COUNTRY_TIMEZONE_MAP[resolvedCountry] ? resolvedCountry : 'US';
    const tz = COUNTRY_TIMEZONE_MAP[resolvedCountry] || 'UTC';

    return {
      country: resolvedCountry,
      ianaTimezone: tz,
      utcOffsetHours: this.getUtcOffsetHours(tz),
    };
  },
};
