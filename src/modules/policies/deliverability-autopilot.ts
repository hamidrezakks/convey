export enum BounceCategory {
  HARD_BOUNCE = 'HARD_BOUNCE',
  SOFT_BOUNCE = 'SOFT_BOUNCE',
  SPAM_COMPLAINT = 'SPAM_COMPLAINT',
  GREYLISTED = 'GREYLISTED',
  CARRIER_BLOCKED = 'CARRIER_BLOCKED',
  UNKNOWN = 'UNKNOWN',
}

export enum DeliverabilityAction {
  AUTO_SUPPRESS = 'AUTO_SUPPRESS',
  RETRY_WITH_BACKOFF = 'RETRY_WITH_BACKOFF',
  FAILOVER_CARRIER = 'FAILOVER_CARRIER',
  LOG_ONLY = 'LOG_ONLY',
}

export interface BounceEvaluation {
  category: BounceCategory;
  action: DeliverabilityAction;
  isPermanent: boolean;
  recommendedBackoffMs?: number;
  reason: string;
}

export const BounceClassifier = {
  /**
   * Evaluates SMTP status codes, provider error categories, or error messages into actionable deliverability actions.
   */
  classify(params: {
    smtpCode?: number | string;
    enhancedCode?: string;
    errorMessage?: string;
    providerEventType?: string;
  }): BounceEvaluation {
    const errorStr = (params.errorMessage || '').toLowerCase();
    const eventType = (params.providerEventType || '').toLowerCase();
    const smtpCode = Number(params.smtpCode) || 0;
    const enhCode = params.enhancedCode || '';

    // 1. Spam Complaints / FBL
    if (
      eventType.includes('complaint') ||
      eventType.includes('spam') ||
      errorStr.includes('spam') ||
      errorStr.includes('complaint') ||
      errorStr.includes('feedback loop')
    ) {
      return {
        category: BounceCategory.SPAM_COMPLAINT,
        action: DeliverabilityAction.AUTO_SUPPRESS,
        isPermanent: true,
        reason: 'Recipient marked message as spam/complaint',
      };
    }

    // 2. Hard Bounces: 5.1.1, 550, user unknown, mailbox not found
    if (
      smtpCode === 550 ||
      smtpCode === 551 ||
      smtpCode === 553 ||
      enhCode.startsWith('5.1.1') ||
      enhCode.startsWith('5.1.2') ||
      errorStr.includes('user not found') ||
      errorStr.includes('mailbox unavailable') ||
      errorStr.includes('invalid recipient') ||
      errorStr.includes('does not exist') ||
      eventType === 'hard_bounce' ||
      eventType === 'hardbounce'
    ) {
      return {
        category: BounceCategory.HARD_BOUNCE,
        action: DeliverabilityAction.AUTO_SUPPRESS,
        isPermanent: true,
        reason: 'Mailbox does not exist or permanent recipient rejection',
      };
    }

    // 3. Greylisting: 4.5.3, 451, greylisted
    if (
      smtpCode === 451 ||
      enhCode.startsWith('4.5.3') ||
      errorStr.includes('greylist') ||
      errorStr.includes('try again later')
    ) {
      return {
        category: BounceCategory.GREYLISTED,
        action: DeliverabilityAction.RETRY_WITH_BACKOFF,
        isPermanent: false,
        recommendedBackoffMs: 900_000, // 15 minutes
        reason: 'Greylisted by receiving mail server; retry with delay',
      };
    }

    // 4. Soft Bounces: 4.2.2 Mailbox full, 4.4.1 Timeout, 421 Rate Limited
    if (
      smtpCode === 421 ||
      smtpCode === 450 ||
      smtpCode === 452 ||
      enhCode.startsWith('4.2.2') ||
      enhCode.startsWith('4.4.1') ||
      errorStr.includes('mailbox full') ||
      errorStr.includes('quota exceeded') ||
      eventType === 'soft_bounce'
    ) {
      return {
        category: BounceCategory.SOFT_BOUNCE,
        action: DeliverabilityAction.RETRY_WITH_BACKOFF,
        isPermanent: false,
        recommendedBackoffMs: 300_000, // 5 minutes
        reason: 'Temporary mailbox issue or mailbox full',
      };
    }

    // 5. SMS Carrier Filtering / 10DLC blocked: 30007, 30008, filtered
    if (
      errorStr.includes('30007') ||
      errorStr.includes('carrier violation') ||
      errorStr.includes('filtered') ||
      errorStr.includes('unregistered 10dlc')
    ) {
      return {
        category: BounceCategory.CARRIER_BLOCKED,
        action: DeliverabilityAction.FAILOVER_CARRIER,
        isPermanent: false,
        reason: 'Carrier filtering or 10DLC unregistered routing; failover to secondary provider',
      };
    }

    return {
      category: BounceCategory.UNKNOWN,
      action: DeliverabilityAction.LOG_ONLY,
      isPermanent: false,
      reason: 'General provider failure; retry permitted',
    };
  },
};

export interface IpWarmupConfig {
  initialDailyCap: number;
  rampFactor: number; // e.g. 0.40 = +40% per day
  maxTargetCap: number;
}

export const DEFAULT_IP_WARMUP_CONFIG: IpWarmupConfig = {
  initialDailyCap: 100,
  rampFactor: 0.4,
  maxTargetCap: 500_000,
};

export const IpWarmupScheduler = {
  DEFAULT_CONFIG: DEFAULT_IP_WARMUP_CONFIG,

  /**
   * Computes the maximum allowed daily and hourly sending volume for a dedicated IP pool on day N.
   */
  computeWarmupCap(
    dayNumber: number,
    recentBounceRate = 0.0,
    config: IpWarmupConfig = DEFAULT_IP_WARMUP_CONFIG,
  ): {
    dayNumber: number;
    dailyCap: number;
    hourlyCap: number;
    isHealthDegraded: boolean;
  } {
    const validDay = Math.max(1, dayNumber);
    // Formula: initialCap * (1 + rampFactor)^(day - 1)
    const rawDailyCap = Math.round(config.initialDailyCap * (1 + config.rampFactor) ** (validDay - 1));
    let dailyCap = Math.min(config.maxTargetCap, rawDailyCap);

    // Health decay: If bounce rate > 2.0%, throttle the day's capacity by 50%
    const isHealthDegraded = recentBounceRate > 0.02;
    if (isHealthDegraded) {
      dailyCap = Math.max(config.initialDailyCap, Math.round(dailyCap * 0.5));
    }

    const hourlyCap = Math.max(10, Math.round(dailyCap / 12)); // Allow reasonable burst across active hours

    return {
      dayNumber: validDay,
      dailyCap,
      hourlyCap,
      isHealthDegraded,
    };
  },
};

const ALPHA_SUPPORTED_COUNTRIES = new Set([
  'GB',
  'AE',
  'SA',
  'DE',
  'FR',
  'NL',
  'ES',
  'IT',
  'AU',
  'SG',
  'ZA',
  'SE',
  'NO',
  'DK',
]);
const ALPHA_PROHIBITED_COUNTRIES = new Set(['US', 'CA', 'BR', 'MX']);

export const SenderIdCompliance = {
  /**
   * Sanitizes an alphanumeric sender ID (max 11 characters, uppercase/lowercase letters and numbers).
   */
  sanitizeAlphanumericSenderId(senderId: string): string {
    const cleaned = senderId.replace(/[^a-zA-Z0-9]/g, '');
    return cleaned.slice(0, 11);
  },

  /**
   * Evaluates whether an alphanumeric sender ID can be used for a given destination country.
   */
  evaluateSenderId(
    senderId: string,
    countryCode: string,
  ): {
    isValid: boolean;
    formattedSenderId: string;
    mode: 'ALPHANUMERIC' | 'SHORTCODE_OR_10DLC' | 'NUMERIC';
    reason?: string;
  } {
    const country = (countryCode || '').toUpperCase();
    const sanitized = this.sanitizeAlphanumericSenderId(senderId);

    if (ALPHA_PROHIBITED_COUNTRIES.has(country)) {
      return {
        isValid: true,
        formattedSenderId: senderId,
        mode: 'SHORTCODE_OR_10DLC',
        reason: `Country ${country} requires 10DLC or numeric Shortcode; alphanumeric sender IDs prohibited.`,
      };
    }

    if (ALPHA_SUPPORTED_COUNTRIES.has(country)) {
      if (sanitized.length === 0) {
        return {
          isValid: false,
          formattedSenderId: '',
          mode: 'ALPHANUMERIC',
          reason: 'Alphanumeric sender ID cannot be empty after sanitization.',
        };
      }
      return {
        isValid: true,
        formattedSenderId: sanitized,
        mode: 'ALPHANUMERIC',
      };
    }

    return {
      isValid: true,
      formattedSenderId: senderId,
      mode: 'NUMERIC',
    };
  },
};
