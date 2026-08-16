import { describe, expect, it } from 'bun:test';
import { DlpScanner } from '../src/utils/dlp-scanner';

describe('Enterprise PII DLP & Dynamic Redaction Engine Suite', () => {
  it('masks valid 16-digit Visa card with preserved 4-digit prefix and suffix', () => {
    const text = 'Payment charged to 4242 4242 4242 4242 successfully';
    const sanitized = DlpScanner.maskCreditCard(text);
    expect(sanitized).toBe('Payment charged to 4242-XXXX-XXXX-4242 successfully');
  });

  it('masks valid 16-digit Mastercard', () => {
    const text = 'Card number: 5500 0000 0000 0004';
    const sanitized = DlpScanner.maskCreditCard(text);
    expect(sanitized).toBe('Card number: 5500-XXXX-XXXX-0004');
  });

  it('masks valid 15-digit American Express card', () => {
    const text = 'Amex: 3782 822463 10005';
    const sanitized = DlpScanner.maskCreditCard(text);
    expect(sanitized).toBe('Amex: 3782-XXXX-XXXX-0005');
  });

  it('masks valid 16-digit Discover card', () => {
    const text = 'Discover card 6011 0000 0000 1119 processed';
    const sanitized = DlpScanner.maskCreditCard(text);
    expect(sanitized).toBe('Discover card 6011-XXXX-XXXX-1119 processed');
  });

  it('masks valid 14-digit Diners Club card', () => {
    const text = 'Diners: 3056 930902 5672';
    const sanitized = DlpScanner.maskCreditCard(text);
    expect(sanitized).toBe('Diners: 3056-XXXX-XXXX-5672');
  });

  it('masks valid 16-digit JCB card', () => {
    const text = 'JCB: 3528 0000 0000 0007';
    const sanitized = DlpScanner.maskCreditCard(text);
    expect(sanitized).toBe('JCB: 3528-XXXX-XXXX-0007');
  });

  it('invalid 16-digit number (fails Luhn) is NOT masked as credit card', () => {
    const text = 'Tracking ID: 1234 5678 9012 3456';
    const sanitized = DlpScanner.maskCreditCard(text);
    expect(sanitized).toBe('Tracking ID: 1234 5678 9012 3456');
  });

  it('4-digit verification OTP ("Your code is 4921") is redacted', () => {
    const text = 'Your verification code is 4921. Do not share.';
    const sanitized = DlpScanner.maskOtp(text);
    expect(sanitized).toBe('Your verification code is [REDACTED_OTP]. Do not share.');
  });

  it('6-digit login OTP ("Your OTP is: 839102") is redacted', () => {
    const text = 'Your OTP is: 839102 to log in.';
    const sanitized = DlpScanner.maskOtp(text);
    expect(sanitized).toBe('Your OTP is: [REDACTED_OTP] to log in.');
  });

  it('8-digit security PIN ("passcode = 94820194") is redacted', () => {
    const text = 'Security passcode = 94820194';
    const sanitized = DlpScanner.maskOtp(text);
    expect(sanitized).toBe('Security passcode = [REDACTED_OTP]');
  });

  it('false positive numeric strings (e.g. "ZIP code 94103") are preserved', () => {
    const text = 'Delivery to ZIP 94103 in Year 2026';
    const sanitized = DlpScanner.sanitize(text);
    expect(sanitized).toBe('Delivery to ZIP 94103 in Year 2026');
  });

  it('standard US SSN (123-45-6789) is masked to XXX-XX-XXXX', () => {
    const text = 'Client SSN is 123-45-6789';
    const sanitized = DlpScanner.maskSsn(text);
    expect(sanitized).toBe('Client SSN is XXX-XX-XXXX');
  });

  it('SSN embedded inside long sentence is accurately detected and masked', () => {
    const text = 'For verification, ensure SSN 987-65-4321 matches tax record.';
    const sanitized = DlpScanner.maskSsn(text);
    expect(sanitized).toBe('For verification, ensure SSN XXX-XX-XXXX matches tax record.');
  });

  it('Stripe live secret key is masked to [REDACTED_API_KEY]', () => {
    const text = 'Using key sk_live_9837498237498237498237498234 for gateway';
    const sanitized = DlpScanner.maskApiKey(text);
    expect(sanitized).toBe('Using key [REDACTED_API_KEY] for gateway');
  });

  it('JWT Bearer authentication token is masked to Bearer [REDACTED_JWT]', () => {
    const text =
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgN_pGMstBvW4M';
    const sanitized = DlpScanner.maskApiKey(text);
    expect(sanitized).toBe('Authorization: Bearer [REDACTED_JWT]');
  });

  it('deep recursive object sanitization scrubs nested properties', () => {
    const payload = {
      user: {
        name: 'Alice',
        billing: {
          cardNumber: '4242 4242 4242 4242',
          secret: 'sk_live_123456789012345678901234',
        },
      },
      meta: {
        pin: 'Your pin is 9944',
      },
    };

    const cleaned = DlpScanner.sanitizeObject(payload);
    expect(cleaned.user.billing.cardNumber).toBe('4242-XXXX-XXXX-4242');
    expect(cleaned.user.billing.secret).toBe('[REDACTED_API_KEY]');
    expect(cleaned.meta.pin).toBe('Your pin is [REDACTED_OTP]');
  });

  it('multi-dimensional array sanitization scrubs string elements at arbitrary depth', () => {
    const list = [
      ['4242 4242 4242 4242', 'safe_text'],
      [{ auth: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgN_pGMstBvW4M' }],
    ];

    const cleaned = DlpScanner.sanitizeObject(list);
    expect(cleaned[0][0]).toBe('4242-XXXX-XXXX-4242');
    expect(cleaned[0][1]).toBe('safe_text');
    expect((cleaned[1][0] as { auth: string }).auth).toBe('Bearer [REDACTED_JWT]');
  });

  it('null, undefined, numbers, and boolean primitives pass through unchanged', () => {
    expect(DlpScanner.sanitizeObject(null)).toBeNull();
    expect(DlpScanner.sanitizeObject(undefined)).toBeUndefined();
    expect(DlpScanner.sanitizeObject(42)).toBe(42);
    expect(DlpScanner.sanitizeObject(true)).toBe(true);
  });

  it('string with multiple PII elements scrubs all in a single pass', () => {
    const combo = 'Charged 4242 4242 4242 4242 with code is 1234 for SSN 123-45-6789';
    const sanitized = DlpScanner.sanitize(combo);
    expect(sanitized).toBe('Charged 4242-XXXX-XXXX-4242 with code is [REDACTED_OTP] for SSN XXX-XX-XXXX');
  });

  it('high-throughput benchmark: scrubs 5,000 mixed PII records in < 100ms', () => {
    const records = Array.from({ length: 5000 }).map((_, idx) => ({
      id: idx,
      card: '4242 4242 4242 4242',
      otp: 'Your OTP is 123456',
      ssn: '123-45-6789',
      key: 'sk_live_123456789012345678901234',
    }));

    const start = performance.now();
    const cleaned = DlpScanner.sanitizeObject(records);
    const duration = performance.now() - start;

    expect(cleaned.length).toBe(5000);
    expect(duration).toBeLessThan(100);
  });
});
