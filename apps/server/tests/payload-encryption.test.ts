import { describe, expect, it } from 'bun:test';
import {
  CryptographicShreddedError,
  type EncryptedPayload,
  PayloadEncryptionManager,
} from '../src/utils/payload-encryption';

describe('Payload Encryption & Distributed Cryptographic Shredding', async () => {
  it('encrypts and decrypts sensitive payload with AES-256-GCM envelope', async () => {
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

    const decrypted = await manager.decryptPayload<typeof originalPayload>(encrypted);
    expect(decrypted).toEqual(originalPayload);
  });

  it('instant cryptographic shredding revokes recipient decryption across instances', async () => {
    const manager = new PayloadEncryptionManager();
    const recipientId = `user_gdpr_${crypto.randomUUID()}`;
    const originalPayload = { secret: 'confidential' };

    const encrypted = manager.encryptPayload(originalPayload, recipientId);
    const decryptedBefore = await manager.decryptPayload<typeof originalPayload>(encrypted);
    expect(decryptedBefore).toEqual(originalPayload);

    // GDPR Right to be Forgotten: Shred key
    await manager.shredRecipientKey(recipientId);

    // Decryption MUST fail with CryptographicShreddedError
    await expect(manager.decryptPayload(encrypted)).rejects.toThrow(CryptographicShreddedError);
  });

  it('caches derived HKDF recipient keys for optimal throughput', async () => {
    const manager = new PayloadEncryptionManager();

    const key1 = manager.deriveRecipientKey('user_1');
    const key2 = manager.deriveRecipientKey('user_1');

    expect(key1).toBe(key2); // Same Buffer instance from LRU cache
  });

  it('validates invalid container objects defensively', async () => {
    const manager = new PayloadEncryptionManager();

    expect(() => manager.encryptPayload(null)).toThrow(/Invalid payload/);
    await expect(manager.decryptPayload(null as unknown as EncryptedPayload)).rejects.toThrow(
      /InvalidEncryptedPayload/,
    );
    await expect(
      manager.decryptPayload({ version: 1, iv: '', authTag: '', ciphertext: '' } as EncryptedPayload),
    ).rejects.toThrow(/Missing required/);
  });
});

it('a new manager observes durable revocation after restart', async () => {
  const id = `revocation_${crypto.randomUUID()}`;
  const first = new PayloadEncryptionManager('restart-test-key-at-least-32-characters');
  const envelope = first.encryptPayload({ secret: 'private' }, id);
  await first.shredRecipientKey(id);
  const restarted = new PayloadEncryptionManager('restart-test-key-at-least-32-characters');
  await expect(restarted.decryptPayload(envelope)).rejects.toThrow(CryptographicShreddedError);
});

it('fails closed when the revocation store cannot be read or written', async () => {
  const manager = new PayloadEncryptionManager('store-outage-test-key-at-least-32-characters', {
    async isRevoked() {
      throw new Error('store unavailable');
    },
    async revoke() {
      throw new Error('store unavailable');
    },
  });
  const envelope = manager.encryptPayload('secret', 'recipient');
  await expect(manager.decryptPayload(envelope)).rejects.toThrow('store unavailable');
  await expect(manager.shredRecipientKey('recipient')).rejects.toThrow('store unavailable');
  expect(() => manager.decryptProviderPayload(envelope)).toThrow('durable revocation');
});
