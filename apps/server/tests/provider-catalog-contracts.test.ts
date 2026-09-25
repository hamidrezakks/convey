import { describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import type { ProviderModule } from '../src/modules/providers/core/provider-module';
import { ErrorCategory } from '../src/modules/providers/core/provider-types';

const root = resolve(import.meta.dir, '../src/modules/providers');
const paths = [...new Bun.Glob('{email,sms,push,chat,tool}/*/index.ts').scanSync(root)].sort();
const modules: Array<{ path: string; module: ProviderModule }> = [];
for (const path of paths) modules.push({ path, module: (await import(resolve(root, path))).default });

it('covers every one of the 88 catalog modules', () => {
  expect(modules).toHaveLength(88);
});
for (const { path, module } of modules) {
  describe(path, () => {
    it('does not treat unrelated options as credentials', () => {
      expect(module.adapter.hasSetup?.({})).toBe(false);
      expect(module.adapter.hasSetup?.({ unrelated: true })).toBe(false);
    });
    it('never accepts HTTP rejection and preserves retry categories', () => {
      for (const [status, category] of [
        [401, ErrorCategory.PERMANENT],
        [429, ErrorCategory.RATE_LIMITED],
        [503, ErrorCategory.TRANSIENT],
      ] as const) {
        const result = module.adapter.transformResponse?.({}, status);
        expect(result?.success).toBe(false);
        expect(result?.error?.category).toBe(category);
      }
    });
    it('ignores missing or unknown delivery events', () => {
      for (const payload of [
        null,
        {},
        {
          id: 'id',
          messageId: 'id',
          message_id: 'id',
          MessageId: 'id',
          status: 'queued',
          event: 'queued',
          type: 'queued',
        },
      ]) {
        expect(module.adapter.parseWebhook?.(payload) || []).toEqual([]);
      }
    });
  });
}
