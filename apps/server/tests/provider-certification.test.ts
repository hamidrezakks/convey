import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isNativeProviderIncomplete } from '@convey/shared';
import evidence from '../../../docs/operations/provider-certification-evidence.json';
import { ProviderRegistry } from '../src/modules/providers/core/provider-registry';

// Original unavailable cohort. Removing an availability restriction requires independent contract evidence.
const cohort = [
  'afro-sms',
  'burst-sms',
  'clickatell',
  'cm-telecom',
  'eazy-sms',
  'gupshup',
  'imedia',
  'isend-sms',
  'isendpro-sms',
  'kannel',
  'maqsam',
  'mobishastra',
  'ring-central',
  'ruach-sms',
  'sendchamp',
  'simpletexting',
  'sms-central',
  'smsmode',
  'termii',
  'unifonic',
];
test('incomplete native providers cannot be enabled by arbitrary credentials', () => {
  for (const id of cohort) {
    if (isNativeProviderIncomplete(id)) {
      expect(ProviderRegistry.hasSetup(id, { apiKey: 'present' })).toBe(false);
      expect(ProviderRegistry.isWorkable(id, { apiKey: 'present' })).toBe(false);
    } else {
      const certification = (
        evidence as Record<
          string,
          { apiVersion: string; request: string; response: string; failure: string; receipt: string }
        >
      )[id];
      expect(certification?.apiVersion).toBeTruthy();
      for (const kind of ['request', 'response', 'failure', 'receipt'] as const) {
        const path = certification?.[kind];
        expect(path?.startsWith('apps/server/tests/')).toBe(true);
        expect(path?.endsWith('.test.ts')).toBe(true);
        expect(existsSync(resolve(import.meta.dir, '../../..', path))).toBe(true);
      }
    }
  }
});
