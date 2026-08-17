import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';
import { eq } from 'drizzle-orm';
import { bootstrapService } from '../src/bootstrap';
import { db } from '../src/db';
import { providers } from '../src/db/schema';
import { adminService } from '../src/modules/admin/admin.service';
import { getCachedProviderConfig, invalidateProviderConfigCache } from '../src/queues/workers/provider-send.worker';
import {
  decryptProviderCredentials,
  encryptProviderCredentials,
  isMaskedPlaceholder,
  maskCredentialValue,
  maskProviderCredentials,
} from '../src/utils/payload-encryption';

describe('Provider Credentials AES-256-GCM Encryption & Masking Suite', () => {
  beforeAll(async () => {
    await bootstrapService();
  });

  describe('1. Cryptographic Primitives & Envelope Encryption', () => {
    it('encrypts provider credentials into AES-256-GCM envelope ciphertext with random IV and authTag', () => {
      const plaintext = {
        apiKey: 'SG.real_secret_sendgrid_key_998877665544',
        webhookSecret: 'whsec_998877665544332211',
      };

      const encrypted = encryptProviderCredentials(plaintext);

      expect(encrypted.version).toBe(1);
      expect(typeof encrypted.iv).toBe('string');
      expect(encrypted.iv.length).toBe(24); // 12 bytes = 24 hex chars
      expect(typeof encrypted.authTag).toBe('string');
      expect(encrypted.authTag.length).toBe(32); // 16 bytes = 32 hex chars
      expect(typeof encrypted.ciphertext).toBe('string');
      expect(encrypted.ciphertext).not.toContain('SG.real_secret_sendgrid');
      expect(encrypted.ciphertext).not.toContain('whsec_');

      const decrypted = decryptProviderCredentials(encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it('produces unique IVs for identical credentials (semantic security)', () => {
      const creds = { apiKey: 'test_static_api_key_12345' };
      const enc1 = encryptProviderCredentials(creds);
      const enc2 = encryptProviderCredentials(creds);

      expect(enc1.iv).not.toEqual(enc2.iv);
      expect(enc1.ciphertext).not.toEqual(enc2.ciphertext);
      expect(decryptProviderCredentials(enc1)).toEqual(creds);
      expect(decryptProviderCredentials(enc2)).toEqual(creds);
    });

    it('decrypts plain legacy JSON objects for backwards compatibility', () => {
      const legacy = {
        accountSid: 'AC_legacy_1234567890',
        authToken: 'token_legacy_987654321',
      };

      const result = decryptProviderCredentials(legacy);
      expect(result).toEqual(legacy);
    });

    it('safely handles empty or null/undefined credentials without crashing', () => {
      expect(decryptProviderCredentials(null)).toEqual({});
      expect(decryptProviderCredentials(undefined)).toEqual({});
      expect(decryptProviderCredentials({})).toEqual({});
    });
  });

  describe('2. Masking Primitives & Heuristics', () => {
    it('masks long secrets while preserving leading and trailing chars', () => {
      const key = 'SG.1234567890abcdef';
      const masked = maskCredentialValue(key);
      expect(masked.startsWith('SG.1')).toBe(true);
      expect(masked.endsWith('cdef')).toBe(true);
      expect(masked).toContain('••••');
      expect(masked).not.toContain('234567890ab');
    });

    it('completely masks short secrets', () => {
      const shortKey = 'secret';
      const masked = maskCredentialValue(shortKey);
      expect(masked).toBe('••••••••');
    });

    it('correctly maps whole credential objects to masked versions', () => {
      const raw = {
        API_KEY: 'SG.live_production_key_44332211',
        SECRET_TOKEN: 'short',
      };

      const masked = maskProviderCredentials(raw);
      expect(masked.API_KEY.startsWith('SG.l')).toBe(true);
      expect(masked.API_KEY.endsWith('2211')).toBe(true);
      expect(masked.SECRET_TOKEN).toBe('••••••••');
    });

    it('identifies masked placeholders and blank entries via isMaskedPlaceholder', () => {
      expect(isMaskedPlaceholder('')).toBe(true);
      expect(isMaskedPlaceholder('   ')).toBe(true);
      expect(isMaskedPlaceholder('SG.4••••••••3f8a')).toBe(true);
      expect(isMaskedPlaceholder('••••••••••••')).toBe(true);
      expect(isMaskedPlaceholder('****')).toBe(true);
      expect(isMaskedPlaceholder('SG.1...cdef')).toBe(true);

      // Real secrets should return false
      expect(isMaskedPlaceholder('SG.live_production_key_99887766')).toBe(false);
      expect(isMaskedPlaceholder('AC1234567890abcdef1234567890abcdef')).toBe(false);
    });
  });

  describe('3. Admin Service Provider Registration, Encryption at Rest & Selective Merging', () => {
    const testProviderId = 'test-sendgrid-secure';

    it('persists encrypted credentials to PostgreSQL and returns masked values in DTO', async () => {
      const rawSecret = 'SG.secret_key_testing_live_vault_99887766';
      const result = await adminService.registerProvider({
        providerId: testProviderId,
        channel: Channel.EMAIL,
        credentials: {
          apiKey: rawSecret,
          senderEmail: 'test@example.com',
        },
        priority: 1,
        weight: 100,
        isPrimary: true,
      });

      // API response returns masked credentials
      expect(result.credentialsMasked.apiKey).toContain('••••');
      expect(result.credentialsMasked.apiKey).not.toEqual(rawSecret);
      expect(result.envSnippet).toContain('••••');
      expect(result.envSnippet).not.toContain(rawSecret);

      // Direct Database inspection: check that credentials column is encrypted
      const rows = await db.select().from(providers).where(eq(providers.id, testProviderId)).limit(1);
      expect(rows.length).toBe(1);
      const dbCreds = rows[0].credentials as { version?: number; iv?: string; ciphertext?: string };
      expect(dbCreds.version).toBe(1);
      expect(typeof dbCreds.ciphertext).toBe('string');
      expect(dbCreds.ciphertext).not.toContain(rawSecret);

      // Decrypted matches original
      const decrypted = decryptProviderCredentials(dbCreds);
      expect(decrypted.apiKey).toBe(rawSecret);
      expect(decrypted.senderEmail).toBe('test@example.com');
    });

    it('performs selective merging when editing provider with empty/masked credentials', async () => {
      const originalSecret = 'SG.secret_key_testing_live_vault_99887766';

      // Admin edits weight/priority but leaves credentials empty or sends masked placeholder
      const updateResult = await adminService.registerProvider({
        providerId: testProviderId,
        channel: Channel.EMAIL,
        credentials: {
          apiKey: '', // blank: retain existing
          senderEmail: 'updated-sender@example.com', // changed
        },
        priority: 2,
        weight: 80,
      });

      expect(updateResult.priority).toBe(2);
      expect(updateResult.weight).toBe(80);

      // Verify that database still has original secret preserved
      const rows = await db.select().from(providers).where(eq(providers.id, testProviderId)).limit(1);
      const decrypted = decryptProviderCredentials(rows[0].credentials);
      expect(decrypted.apiKey).toBe(originalSecret);
      expect(decrypted.senderEmail).toBe('updated-sender@example.com');
    });

    it('lists configured providers with masked credentials and no plain secrets exposed', async () => {
      const list = await adminService.getConfiguredProviders();
      const testItem = list.find((p) => p.providerId === testProviderId);

      expect(testItem).toBeDefined();
      expect(testItem?.credentialsMasked.apiKey).toContain('••••');
      expect((testItem as Record<string, unknown>).credentials).toBeUndefined();
    });

    it('exports environment vault with masked secrets', () => {
      const vault = adminService.exportEnvVariables();
      expect(vault.envFileContent).toContain('# Security: Secrets masked');
      expect(vault.variableCount).toBeGreaterThanOrEqual(1);
    });

    afterAll(async () => {
      await adminService.deleteConfiguredProvider(testProviderId);
    });
  });

  describe('4. Worker Transparent Decryption & Cache Invalidation', () => {
    const workerProviderId = 'test-worker-decrypt-provider';
    const workerSecret = 're_live_secret_resend_99887766';

    beforeAll(async () => {
      await adminService.registerProvider({
        providerId: workerProviderId,
        channel: Channel.EMAIL,
        credentials: {
          apiKey: workerSecret,
        },
        config: {
          openTracking: true,
        },
      });
    });

    it('transparently decrypts credentials for background send worker', async () => {
      invalidateProviderConfigCache(workerProviderId);
      const config = await getCachedProviderConfig(workerProviderId);

      expect(config).toBeDefined();
      expect(config?.apiKey).toBe(workerSecret);
      expect(config?.openTracking).toBe(true);
    });

    it('caches decrypted configuration in memory for fast worker execution', async () => {
      const config1 = await getCachedProviderConfig(workerProviderId);
      const config2 = await getCachedProviderConfig(workerProviderId);

      expect(config1).toEqual(config2);
    });

    afterAll(async () => {
      await adminService.deleteConfiguredProvider(workerProviderId);
      invalidateProviderConfigCache();
    });
  });
});
