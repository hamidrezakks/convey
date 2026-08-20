import { describe, expect, it } from 'bun:test';
import { CascadeManager } from '../src/modules/messaging/cascade-manager';

describe('Dynamic Event-Driven Omnichannel Cascades', () => {
  it('should manage cascade cancellation and short-circuiting in Redis', async () => {
    const publicId = `msg_cascade_${Date.now()}`;

    expect(await CascadeManager.isCancelled(publicId)).toBe(false);

    await CascadeManager.cancelRemainingSteps(publicId);

    expect(await CascadeManager.isCancelled(publicId)).toBe(true);
    expect(await CascadeManager.isShortCircuited(publicId)).toBe(true);
  });

  it('should generate deterministic cancel and state Redis keys', () => {
    const publicId = 'msg_01J8F6K2B4E9';
    const cancelKey = CascadeManager.getCancelKey(publicId);
    const stateKey = CascadeManager.getStateKey(publicId);

    expect(cancelKey).toContain(publicId);
    expect(stateKey).toContain(publicId);
  });
});
