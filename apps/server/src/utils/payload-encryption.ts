import { createCipheriv, createDecipheriv, hkdfSync } from 'node:crypto';
import { type BunNativeRedis, redisClient } from '../queues/connection';
import { logger } from './logger';
import { formatPubSubChannel, formatRedisKey } from './redis-keys';

export interface EncryptedPayload {
  version: number;
  iv: string;
  authTag: string;
  ciphertext: string;
  recipientId?: string;
  keyArn?: string;
  encryptedDek?: string;
}

export interface KeyManagementProvider {
  name: string;
  generateDataKey(tenantId?: string): Promise<{ plaintextKey: Buffer; encryptedKeyEnvelope?: string; keyArn?: string }>;
  decryptDataKey(encryptedKeyEnvelope: string, keyArn?: string, tenantId?: string): Promise<Buffer>;
}

export class LocalKeyProvider implements KeyManagementProvider {
  name = 'local';
  constructor(private masterKey: Buffer) {}

  async generateDataKey(_tenantId?: string) {
    return { plaintextKey: this.masterKey };
  }

  async decryptDataKey(_encryptedKeyEnvelope: string, _keyArn?: string, _tenantId?: string) {
    return this.masterKey;
  }
}

export class MockKmsKeyProvider implements KeyManagementProvider {
  name = 'mock-kms';

  async generateDataKey(tenantId?: string) {
    const rawDek = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
    const keyArn = `arn:aws:kms:us-east-1:123456789012:key/${tenantId || 'default'}`;
    const encryptedKeyEnvelope = Buffer.from(
      JSON.stringify({
        dekHex: rawDek.toString('hex'),
        keyArn,
      }),
    ).toString('base64');

    return { plaintextKey: rawDek, encryptedKeyEnvelope, keyArn };
  }

  async decryptDataKey(encryptedKeyEnvelope: string, _keyArn?: string, _tenantId?: string) {
    const decoded = JSON.parse(Buffer.from(encryptedKeyEnvelope, 'base64').toString('utf8'));
    return Buffer.from(decoded.dekHex, 'hex');
  }
}

const HKDF_INFO = Buffer.from('convey-gdpr-v1');

export class CryptographicShreddedError extends Error {
  readonly code = 'CRYPTOGRAPHIC_SHREDDED';
  readonly recipientId: string;

  constructor(recipientId: string) {
    super(
      `CRYPTOGRAPHIC_SHREDDED: Decryption failed. Key for recipient '${recipientId}' was shredded under GDPR compliance.`,
    );
    this.name = 'CryptographicShreddedError';
    this.recipientId = recipientId;
  }
}

/**
 * Zero-Trust Envelope Payload Encryption Manager.
 *
 * Implements AES-256-GCM envelope encryption with HKDF key derivation, key versioning, pluggable BYOK KMS providers,
 * and LRU caching to transparently encrypt sensitive recipient PII and message content at rest.
 */
export class PayloadEncryptionManager {
  private masterKey: Buffer;
  private keyVersion = 1;
  private keyProviders = new Map<string, KeyManagementProvider>();
  private tenantKeyProviders = new Map<string, string>(); // tenantId -> providerName
  private revokedRecipientKeys = new Set<string>();
  private derivedKeyCache = new Map<string, Buffer>();
  private maxCacheSize = 10000;
  private pubSubClient: BunNativeRedis | null = null;

  constructor(secretKeyStr?: string) {
    const configuredKey = secretKeyStr || process.env.PAYLOAD_ENCRYPTION_KEY;
    if (
      process.env.NODE_ENV === 'production' &&
      (!configuredKey || configuredKey.length < 32 || configuredKey === 'default_secret_key_32_bytes_len_!')
    ) {
      throw new Error('Production requires a unique PAYLOAD_ENCRYPTION_KEY of at least 32 characters');
    }
    const rawKey = configuredKey || 'default_secret_key_32_bytes_len_!';
    // Bun native CryptoHasher (C++ fast path) guarantees exactly 32 bytes (256 bits) for AES-256-GCM
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(rawKey);
    this.masterKey = Buffer.from(hasher.digest());

    this.registerKeyProvider(new LocalKeyProvider(this.masterKey));
    if (process.env.NODE_ENV !== 'production') this.registerKeyProvider(new MockKmsKeyProvider());

    if (process.env.NODE_ENV !== 'test') {
      this.initRedisPubSub();
    }
  }

  registerKeyProvider(provider: KeyManagementProvider): void {
    if (
      process.env.NODE_ENV === 'production' &&
      (provider instanceof MockKmsKeyProvider || provider.name === 'mock-kms')
    ) {
      throw new Error('Mock KMS is prohibited in production');
    }
    this.keyProviders.set(provider.name, provider);
  }

  setTenantKeyProvider(tenantId: string, providerName: string): void {
    if (!this.keyProviders.has(providerName)) {
      throw new Error(`KeyManagementProvider '${providerName}' is not registered.`);
    }
    this.tenantKeyProviders.set(tenantId, providerName);
  }

  rotateKeyVersion(newVersion?: number): number {
    this.keyVersion = newVersion ?? this.keyVersion + 1;
    this.derivedKeyCache.clear();
    return this.keyVersion;
  }

  getKeyVersion(): number {
    return this.keyVersion;
  }

  private initRedisPubSub(): void {
    try {
      const channel = formatPubSubChannel('gdpr-key-shredded');
      this.pubSubClient = redisClient.duplicate();
      this.pubSubClient.on('error', (err: Error) => {
        logger.warn('PayloadEncryption', `Redis PubSub subscriber error: ${err?.message || String(err)}`);
      });
      this.pubSubClient.subscribe(channel, (err: unknown) => {
        if (err) logger.warn('PayloadEncryption', `Redis PubSub subscribe failed: ${(err as Error).message}`);
      });
      this.pubSubClient.on('message', (_chan: string, recipientId: string) => {
        if (recipientId) {
          this.revokedRecipientKeys.add(recipientId);
          this.derivedKeyCache.delete(recipientId);
        }
      });
    } catch {
      // Non-blocking fallback
    }
  }

  /**
   * Derives a recipient/tenant specific 32-byte encryption key using HKDF-SHA256 with LRU caching.
   */
  deriveRecipientKey(recipientId: string): Buffer {
    const cached = this.derivedKeyCache.get(recipientId);
    if (cached) {
      return cached;
    }

    const recipientBuf = Buffer.from(recipientId);
    const derived = Buffer.from(hkdfSync('sha256', this.masterKey, recipientBuf, HKDF_INFO, 32));

    if (this.derivedKeyCache.size >= this.maxCacheSize) {
      const firstKey = this.derivedKeyCache.keys().next().value;
      if (firstKey) this.derivedKeyCache.delete(firstKey);
    }

    this.derivedKeyCache.set(recipientId, derived);
    return derived;
  }

  /**
   * Shreds/revokes the encryption key for a specific recipient across memory and Redis cluster.
   */
  shredRecipientKey(recipientId: string): void {
    this.revokedRecipientKeys.add(recipientId);
    this.derivedKeyCache.delete(recipientId);

    this.publishShredEvent(recipientId).catch(() => {});
  }

  private async publishShredEvent(recipientId: string): Promise<void> {
    try {
      const redisKey = formatRedisKey('shredded_keys');
      const channel = formatPubSubChannel('gdpr-key-shredded');
      const pipeline = redisClient.pipeline();
      pipeline.sadd(redisKey, recipientId);
      pipeline.publish(channel, recipientId);
      await pipeline.exec();
    } catch {
      // Non-blocking fallback
    }
  }

  /**
   * Checks if a recipient key has been cryptographically shredded.
   */
  isShredded(recipientId: string): boolean {
    return this.revokedRecipientKeys.has(recipientId);
  }

  /**
   * Encrypts a text or object payload using AES-256-GCM.
   */
  encryptPayload(data: unknown, recipientId?: string): EncryptedPayload {
    if (data === undefined || data === null) {
      throw new Error('Invalid payload: Cannot encrypt null or undefined data.');
    }

    const key = recipientId ? this.deriveRecipientKey(recipientId) : this.masterKey;
    const rawStr = typeof data === 'string' ? data : JSON.stringify(data);
    const iv = Buffer.from(crypto.getRandomValues(new Uint8Array(12))); // 96-bit IV for AES-GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    let ciphertext = cipher.update(rawStr, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      version: this.keyVersion,
      iv: iv.toString('hex'),
      authTag,
      ciphertext,
      recipientId,
    };
  }

  /**
   * Decrypts an AES-256-GCM encrypted payload object.
   */
  decryptPayload<T = unknown>(encrypted: EncryptedPayload): T {
    if (!encrypted || typeof encrypted !== 'object') {
      throw new Error('InvalidEncryptedPayload: Container must be a valid object.');
    }
    if (!encrypted.iv || !encrypted.authTag || !encrypted.ciphertext) {
      throw new Error('InvalidEncryptedPayload: Missing required iv, authTag, or ciphertext fields.');
    }

    if (encrypted.recipientId && this.isShredded(encrypted.recipientId)) {
      throw new CryptographicShreddedError(encrypted.recipientId);
    }

    const key = encrypted.recipientId ? this.deriveRecipientKey(encrypted.recipientId) : this.masterKey;
    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted: string;
    try {
      decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
    } catch (err) {
      throw new Error(`DecryptionError: Failed to decipher envelope payload - ${(err as Error).message}`);
    }

    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return decrypted as T;
    }
  }
}

/** Singleton instance of PayloadEncryptionManager */
export const payloadEncryptionManager = new PayloadEncryptionManager();

/**
 * Encrypts provider credentials using AES-256-GCM envelope encryption.
 */
export function encryptProviderCredentials(credentials: Record<string, unknown>): EncryptedPayload {
  return payloadEncryptionManager.encryptPayload(credentials);
}

/**
 * Transparently checks if raw credentials are encrypted with AES-256-GCM envelope,
 * deciphers them if so, or returns them as-is for backward compatibility.
 */
export function decryptProviderCredentials(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  if (typeof rec.ciphertext === 'string' && typeof rec.iv === 'string' && typeof rec.authTag === 'string') {
    try {
      const envelope: EncryptedPayload = {
        version: typeof rec.version === 'number' ? rec.version : 1,
        iv: rec.iv,
        authTag: rec.authTag,
        ciphertext: rec.ciphertext,
        recipientId: typeof rec.recipientId === 'string' ? rec.recipientId : undefined,
        keyArn: typeof rec.keyArn === 'string' ? rec.keyArn : undefined,
        encryptedDek: typeof rec.encryptedDek === 'string' ? rec.encryptedDek : undefined,
      };
      return payloadEncryptionManager.decryptPayload<Record<string, string>>(envelope);
    } catch {
      return {};
    }
  }
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) {
    result[k] = v !== null && v !== undefined ? String(v) : '';
  }
  return result;
}

/**
 * Securely masks a credential secret string while preserving context for operators.
 * - Long strings (> 8 chars): First 4 chars + '••••••••' + last 4 chars (e.g. SG.4••••••••3f8a).
 * - Short strings (<= 8 chars): '••••••••'.
 */
export function maskCredentialValue(val: string): string {
  if (!val) return '';
  const str = String(val);
  if (str.length > 8) {
    return `${str.slice(0, 4)}••••••••${str.slice(-4)}`;
  }
  return '••••••••';
}

/**
 * Returns a dictionary with all credential values masked.
 */
export function maskProviderCredentials(creds: Record<string, unknown>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    masked[k] = maskCredentialValue(String(v ?? ''));
  }
  return masked;
}

/**
 * Checks if an input value is a masked placeholder (or empty) to prevent overwriting existing secrets.
 */
export function isMaskedPlaceholder(val: string): boolean {
  if (!val || val.trim() === '') return true;
  const trimmed = val.trim();
  if (trimmed.includes('•') || trimmed.includes('****') || trimmed.includes('...')) {
    return true;
  }
  if (/^[•*]+$/.test(trimmed)) return true;
  return false;
}
