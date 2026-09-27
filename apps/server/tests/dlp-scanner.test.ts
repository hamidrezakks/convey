import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { messages } from '../src/db/schema';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { Channel, MessagePriority } from '../src/modules/messaging/messaging.types';
import { DlpScanner } from '../src/utils/dlp-scanner';
import { type EncryptedPayload, payloadEncryptionManager } from '../src/utils/payload-encryption';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';
import { disableProviderMock, enableProviderMock } from './mocks/provider-mock';

describe('Enterprise PII DLP & Dynamic Redaction Engine', () => {
  beforeAll(async () => {
    await setupFreshIsolatedDatabase();
    enableProviderMock(0);
  });

  afterAll(() => {
    disableProviderMock();
  });

  it('Validates credit card checksum using Luhn algorithm', async () => {
    expect(DlpScanner.isValidLuhn('4111111111111111')).toBe(true);
    expect(DlpScanner.isValidLuhn('4111 1111 1111 1111')).toBe(true);
    expect(DlpScanner.isValidLuhn('4111111111111112')).toBe(false); // Invalid check digit
    expect(DlpScanner.isValidLuhn('12345')).toBe(false); // Too short
  });

  it('Masks Luhn-verified credit card numbers while preserving non-card numbers', async () => {
    const text = 'Payment with card 4111 1111 1111 1111 for order #98765432101234';
    const masked = DlpScanner.maskCreditCard(text);
    expect(masked).toContain('4111-XXXX-XXXX-1111');
  });

  it('Redacts authentication OTP tokens and verification codes', async () => {
    expect(DlpScanner.maskOtp('Your verification code is 849201')).toBe('Your verification code is [REDACTED_OTP]');
    expect(DlpScanner.maskOtp('Your OTP: 123456')).toBe('Your OTP: [REDACTED_OTP]');
    expect(DlpScanner.maskOtp('Security pin: 9988')).toBe('Security pin: [REDACTED_OTP]');
  });

  it('Redacts Social Security Numbers and API keys', async () => {
    const text = 'Employee SSN 123-45-6789 using API key sk_live_abcdef1234567890abcdef123456';
    const masked = DlpScanner.sanitize(text);
    expect(masked).toContain('XXX-XX-XXXX');
    expect(masked).toContain('[REDACTED_API_KEY]');
  });

  it('Recursively sanitizes nested objects and arrays', async () => {
    const payload = {
      user: {
        name: 'Jane Doe',
        notes: 'SSN 987-65-4321, OTP: 543210',
      },
      cards: ['4111111111111111', 'Non-card-string'],
    };

    const sanitized = DlpScanner.sanitizeObject(payload);
    expect(sanitized.user.notes).toBe('SSN XXX-XX-XXXX, OTP: [REDACTED_OTP]');
    expect(sanitized.cards[0]).toBe('4111-XXXX-XXXX-1111');
    expect(sanitized.cards[1]).toBe('Non-card-string');
  });

  it('Sanitizes message metadata before database persistence while keeping raw envelope encrypted', async () => {
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_dlp_${Date.now()}`,
      userId: 'usr_dlp_test',
      team: 'team_dlp',
      category: 'security',
      country: 'US',
      priority: MessagePriority.CRITICAL,
      recipients: { phone: '+14155551234', email: 'dlp@example.com' },
      channels: [{ channel: Channel.SMS, content: { text: 'Your OTP is 765432' } }],
      metadata: {
        rawOtp: 'Your OTP is 765432',
        card: '4111 1111 1111 1111',
      },
    });

    const publicId = (res.body as { messageId: string }).messageId;
    const dbMsg = (await db.select().from(messages).where(eq(messages.publicId, publicId)))[0];

    const metadata = dbMsg.metadata as { rawOtp?: string; card?: string; _encryptedEnvelope?: EncryptedPayload };
    expect(metadata.rawOtp).toBe('Your OTP is [REDACTED_OTP]');
    expect(metadata.card).toBe('4111-XXXX-XXXX-1111');

    // Verify envelope still holds raw unredacted channels/content for worker delivery
    if (metadata._encryptedEnvelope) {
      const decrypted = await payloadEncryptionManager.decryptPayload<{
        channels: Array<{ content: { text: string } }>;
      }>(metadata._encryptedEnvelope);
      expect(decrypted.channels[0].content.text).toBe('Your OTP is 765432');
    }
  });
});
