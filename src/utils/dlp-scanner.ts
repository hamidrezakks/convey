/**
 * Enterprise PII Data Loss Prevention (DLP) & Dynamic Redaction Engine.
 *
 * Scans, detects, and redacts sensitive credentials, authentication tokens,
 * Luhn-verified credit card numbers, and Social Security Numbers before persistence.
 */
export const DlpScanner = {
  /**
   * Luhn algorithm validation for 13-19 digit credit card numbers.
   */
  isValidLuhn(numStr: string): boolean {
    const sanitized = numStr.replace(/\D/g, '');
    if (sanitized.length < 13 || sanitized.length > 19) {
      return false;
    }

    let sum = 0;
    let shouldDouble = false;

    for (let i = sanitized.length - 1; i >= 0; i--) {
      let digit = Number.parseInt(sanitized.charAt(i), 10);
      if (Number.isNaN(digit)) return false;

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  },

  /**
   * Masks valid credit card numbers with preserved 4-digit prefix and suffix (e.g. 4111-XXXX-XXXX-1111).
   */
  maskCreditCard(text: string): string {
    if (!text || typeof text !== 'string') return text;

    return text.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
      const digitsOnly = match.replace(/\D/g, '');
      if (this.isValidLuhn(digitsOnly)) {
        const firstFour = digitsOnly.slice(0, 4);
        const lastFour = digitsOnly.slice(-4);
        return `${firstFour}-XXXX-XXXX-${lastFour}`;
      }
      return match;
    });
  },

  /**
   * Masks 4-8 digit One-Time Passwords (OTPs) and verification PIN codes.
   */
  maskOtp(text: string): string {
    if (!text || typeof text !== 'string') return text;

    return text.replace(
      /\b(?:OTP|code|pin|verification\s*code|passcode)(?:\s+(?:is|was))?[\s:=]+(\d{4,8})\b/gi,
      (fullMatch, code) => {
        return fullMatch.replace(code, '[REDACTED_OTP]');
      },
    );
  },

  /**
   * Masks US Social Security Numbers (SSN: XXX-XX-XXXX).
   */
  maskSsn(text: string): string {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX');
  },

  /**
   * Masks sensitive API keys, JWT bearer tokens, and secret tokens.
   */
  maskApiKey(text: string): string {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(
        /\b(?:Bearer\s+)(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/gi,
        'Bearer [REDACTED_JWT]',
      )
      .replace(/\b(sk_live_[a-zA-Z0-9]{20,})\b/gi, '[REDACTED_API_KEY]');
  },

  /**
   * Runs complete DLP sanitization pipeline across a string.
   */
  sanitize(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let result = this.maskCreditCard(text);
    result = this.maskOtp(result);
    result = this.maskSsn(result);
    result = this.maskApiKey(result);
    return result;
  },

  /**
   * Deep recursive DLP sanitization for arbitrary objects and arrays.
   */
  sanitizeObject<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      return this.sanitize(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized as unknown as T;
    }

    return obj;
  },
};
