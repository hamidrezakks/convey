import { describe, expect, it } from 'bun:test';
import { MockKmsKeyProvider, PayloadEncryptionManager } from '../src/utils/payload-encryption';

describe('Enterprise BYOK & KMS Envelope Encryption', async () => {
  it('should encrypt and decrypt payloads with default master key', async () => {
    const manager = new PayloadEncryptionManager();
    const payload = {
      recipients: { email: 'alice@example.com', phone: '+15551234567' },
      secretToken: 'sec_xyz_98765',
    };

    const encrypted = manager.encryptPayload(payload, 'user_alice_001');
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.ciphertext).not.toContain('alice@example.com');

    const decrypted = await manager.decryptPayload<typeof payload>(encrypted);
    expect(decrypted.recipients.email).toBe('alice@example.com');
    expect(decrypted.secretToken).toBe('sec_xyz_98765');
  });

  it('should support pluggable MockKmsKeyProvider for enterprise tenants', async () => {
    const manager = new PayloadEncryptionManager();
    const kmsProvider = new MockKmsKeyProvider();
    manager.registerKeyProvider(kmsProvider);
    manager.setTenantKeyProvider('tenant-enterprise-99', 'mock-kms');

    const generated = await kmsProvider.generateDataKey('tenant-enterprise-99');
    expect(generated.keyArn).toContain('tenant-enterprise-99');
    const recoveredKey = await kmsProvider.decryptDataKey(generated.encryptedKeyEnvelope || '');
    expect(recoveredKey.toString('hex')).toBe(generated.plaintextKey.toString('hex'));
  });

  it('should support key version rotation while retaining previous encryption keys', async () => {
    const manager = new PayloadEncryptionManager();
    const payloadV1 = { version: 'v1-data' };
    const encryptedV1 = manager.encryptPayload(payloadV1, 'user_v1');
    expect(encryptedV1.version).toBe(1);

    // Rotate key version
    const newVersion = manager.rotateKeyVersion(2, 'rotation-test-key-distinct-at-least-32-characters');
    expect(newVersion).toBe(2);

    const payloadV2 = { version: 'v2-data' };
    const encryptedV2 = manager.encryptPayload(payloadV2, 'user_v2');
    expect(encryptedV2.version).toBe(2);

    // Decrypt both versions successfully
    const decryptedV1 = await manager.decryptPayload<typeof payloadV1>(encryptedV1);
    const decryptedV2 = await manager.decryptPayload<typeof payloadV2>(encryptedV2);
    expect(decryptedV1.version).toBe('v1-data');
    expect(decryptedV2.version).toBe('v2-data');
  });
});
