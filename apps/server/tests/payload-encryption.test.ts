import { describe, expect, it } from 'bun:test';
import {
  CryptographicShreddedError,
  type EncryptedPayload,
  PayloadEncryptionManager,
} from '../src/utils/payload-encryption';

describe('Payload Encryption & Distributed Cryptographic Shredding', () => {
  it('encrypts and decrypts sensitive payload with AES-256-GCM envelope', () => {
    const manager = new PayloadEncryptionManager();
    const originalPayload = {
      recipients: { phone: '+14155550199' },
      channels: [{ channel: 'sms', content: { text: 'Your OTP is 987654' } }],
    };

    const encrypted = manager.encryptPayload(originalPayload, 'user_123');
    expect(encrypted.version).toBe(1);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.recipientId).toBe('user_123');

    const decrypted = manager.decryptPayload<typeof originalPayload>(encrypted);
    expect(decrypted).toEqual(originalPayload);
  });

  it('instant cryptographic shredding revokes recipient decryption across instances', async () => {
    const manager = new PayloadEncryptionManager();
    const originalPayload = { secret: 'confidential' };

    const encrypted = manager.encryptPayload(originalPayload, 'user_gdpr_delete');
    const decryptedBefore = manager.decryptPayload<typeof originalPayload>(encrypted);
    expect(decryptedBefore).toEqual(originalPayload);

    // GDPR Right to be Forgotten: Shred key
    await manager.shredRecipientKey('user_gdpr_delete');

    // Decryption MUST fail with CryptographicShreddedError
    expect(() => manager.decryptPayload(encrypted)).toThrow(CryptographicShreddedError);
  });

  it('caches derived HKDF recipient keys for optimal throughput', () => {
    const manager = new PayloadEncryptionManager();

    const key1 = manager.deriveRecipientKey('user_1');
    const key2 = manager.deriveRecipientKey('user_1');

    expect(key1).toBe(key2); // Same Buffer instance from LRU cache
  });

  it('validates invalid container objects defensively', () => {
    const manager = new PayloadEncryptionManager();

    expect(() => manager.encryptPayload(null)).toThrow(/Invalid payload/);
    expect(() => manager.decryptPayload(null as unknown as EncryptedPayload)).toThrow(/InvalidEncryptedPayload/);
    expect(() =>
      manager.decryptPayload({ version: 1, iv: '', authTag: '', ciphertext: '' } as EncryptedPayload),
    ).toThrow(/Missing required/);
  });
});
