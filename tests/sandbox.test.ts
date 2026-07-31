import { describe, expect, it } from 'bun:test';
import { sandboxAdapter } from '../src/modules/providers/core/sandbox-adapter';

describe('Sandbox Test Mode Execution Suite', () => {
  it('simulates dispatch cleanly via sandbox mock adapter', async () => {
    const res = await sandboxAdapter.send({
      recipient: { email: 'sandbox@test.com' },
      content: { subject: 'Test', body: 'Hello Sandbox' },
    });

    expect(res.success).toBe(true);
    expect(res.providerMessageId).toContain('sb_');
    expect(res.metadata?.sandbox).toBe(true);
  });
});
