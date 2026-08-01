import { describe, expect, it } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { HedgedExecutor } from '../src/modules/providers/core/hedged-executor';
import { smartProviderRouter } from '../src/modules/providers/core/smart-router';

describe('Hedged Outbound Requests (Tail Latency & p99 Reducer)', () => {
  it('Resolves primary request immediately when primary is fast', async () => {
    let secondaryCalled = false;

    const res = await HedgedExecutor.execute(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { messageId: 'msg_primary_fast', status: 'sent' };
      },
      async () => {
        secondaryCalled = true;
        return { messageId: 'msg_secondary', status: 'sent' };
      },
      { hedgeDelayMs: 200, timeoutMs: 2000 },
    );

    expect(res.winner).toBe('primary');
    expect(res.hedgedTriggered).toBe(false);
    expect(res.result.messageId).toBe('msg_primary_fast');
    expect(secondaryCalled).toBe(false);
  });

  it('Speculatively fires secondary request when primary exceeds hedge window and secondary wins', async () => {
    const res = await HedgedExecutor.execute(
      async (signal) => {
        // Simulate lagging primary (takes 800ms)
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (signal.aborted) throw new Error('Aborted');
        return { messageId: 'msg_primary_slow', status: 'sent' };
      },
      async () => {
        // Fast secondary (takes 50ms once triggered at 100ms)
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { messageId: 'msg_secondary_fast', status: 'sent' };
      },
      { hedgeDelayMs: 100, timeoutMs: 2000 },
    );

    expect(res.winner).toBe('secondary');
    expect(res.hedgedTriggered).toBe(true);
    expect(res.result.messageId).toBe('msg_secondary_fast');
  });

  it('Immediately triggers secondary if primary fails before hedge timer', async () => {
    const res = await HedgedExecutor.execute(
      async () => {
        // Fast failure in primary
        throw new Error('Primary connection refused');
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { messageId: 'msg_secondary_on_fail', status: 'sent' };
      },
      { hedgeDelayMs: 500, timeoutMs: 2000 },
    );

    expect(res.winner).toBe('secondary');
    expect(res.hedgedTriggered).toBe(true);
    expect(res.result.messageId).toBe('msg_secondary_on_fail');
  });

  it('SmartProviderRouter resolves valid primary and secondary hedged pairs for email channel', () => {
    const pair = smartProviderRouter.getHedgedProviderPair(Channel.EMAIL, 'ses');
    expect(pair.primary).toBe('ses');
    expect(pair.secondary).toBeDefined();
    expect(pair.secondary).not.toBe('ses');
  });
});
