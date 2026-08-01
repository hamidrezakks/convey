import { describe, expect, it } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { HedgedExecutor } from '../src/modules/providers/core/hedged-executor';
import { smartProviderRouter } from '../src/modules/providers/core/smart-router';

describe('Hedged Outbound Requests (p99 / Tail-Latency Reducer) Suite', () => {
  it('fast primary execution (50ms) completes with winner: primary and hedgedTriggered: false', async () => {
    const res = await HedgedExecutor.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'fast_primary_payload';
      },
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'secondary_payload';
      },
      { hedgeDelayMs: 200 },
    );

    expect(res.result).toBe('fast_primary_payload');
    expect(res.winner).toBe('primary');
    expect(res.hedgedTriggered).toBe(false);
  });

  it('secondary execution is not invoked when primary completes within hedgeDelayMs', async () => {
    let secondaryInvoked = false;
    await HedgedExecutor.execute(
      async () => {
        return 'primary_instant';
      },
      async () => {
        secondaryInvoked = true;
        return 'secondary_never';
      },
      { hedgeDelayMs: 100 },
    );
    expect(secondaryInvoked).toBe(false);
  });

  it('slow primary triggers secondary and secondary wins the race', async () => {
    const res = await HedgedExecutor.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 300));
        return 'slow_primary';
      },
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'fast_secondary';
      },
      { hedgeDelayMs: 50 },
    );

    expect(res.result).toBe('fast_secondary');
    expect(res.winner).toBe('secondary');
    expect(res.hedgedTriggered).toBe(true);
  });

  it('AbortController aborts primary when secondary wins', async () => {
    let primaryAborted = false;
    await HedgedExecutor.execute(
      async (signal) => {
        signal.addEventListener('abort', () => {
          primaryAborted = true;
        });
        await new Promise((r) => setTimeout(r, 300));
        return 'slow_primary';
      },
      async () => {
        await new Promise((r) => setTimeout(r, 20));
        return 'fast_secondary';
      },
      { hedgeDelayMs: 30 },
    );

    expect(primaryAborted).toBe(true);
  });

  it('AbortController aborts secondary when primary wins after hedge delay', async () => {
    let secondaryAborted = false;
    await HedgedExecutor.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 80));
        return 'primary_win';
      },
      async (signal) => {
        signal.addEventListener('abort', () => {
          secondaryAborted = true;
        });
        await new Promise((r) => setTimeout(r, 200));
        return 'secondary_slow';
      },
      { hedgeDelayMs: 30 },
    );

    expect(secondaryAborted).toBe(true);
  });

  it('immediate primary failure triggers secondary without waiting for hedgeDelayMs', async () => {
    const startTime = performance.now();
    const res = await HedgedExecutor.execute(
      async () => {
        throw new Error('Primary immediate failure');
      },
      async () => {
        return 'secondary_fallback_success';
      },
      { hedgeDelayMs: 500 },
    );

    const elapsed = performance.now() - startTime;
    expect(res.result).toBe('secondary_fallback_success');
    expect(res.winner).toBe('secondary');
    expect(elapsed).toBeLessThan(300);
  });

  it('both primary and secondary failures reject with consolidated error', async () => {
    let caughtError = false;
    try {
      await HedgedExecutor.execute(
        async () => {
          throw new Error('Primary hard failure');
        },
        async () => {
          throw new Error('Secondary hard failure');
        },
        { hedgeDelayMs: 30 },
      );
    } catch (err) {
      caughtError = true;
      expect((err as Error).message).toContain('failure');
    }
    expect(caughtError).toBe(true);
  });

  it('primary failure after secondary started allows secondary to succeed', async () => {
    const res = await HedgedExecutor.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 60));
        throw new Error('Primary delayed failure');
      },
      async () => {
        await new Promise((r) => setTimeout(r, 40));
        return 'secondary_success';
      },
      { hedgeDelayMs: 20 },
    );

    expect(res.result).toBe('secondary_success');
    expect(res.winner).toBe('secondary');
  });

  it('secondary failure after primary still pending allows primary to succeed', async () => {
    const res = await HedgedExecutor.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 80));
        return 'primary_slow_success';
      },
      async () => {
        await new Promise((r) => setTimeout(r, 20));
        throw new Error('Secondary fast failure');
      },
      { hedgeDelayMs: 30 },
    );

    expect(res.result).toBe('primary_slow_success');
    expect(res.winner).toBe('primary');
  });

  it('zero hedge delay (0ms) initiates speculative request concurrently', async () => {
    let secondaryRan = false;
    const res = await HedgedExecutor.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'primary_res';
      },
      async () => {
        secondaryRan = true;
        await new Promise((r) => setTimeout(r, 100));
        return 'secondary_res';
      },
      { hedgeDelayMs: 0 },
    );

    expect(res.result).toBe('primary_res');
    expect(secondaryRan).toBe(true);
  });

  it('timeout watchdog rejects when both senders exceed timeout threshold', async () => {
    let timedOut = false;
    try {
      await HedgedExecutor.execute(
        async () => {
          await new Promise((r) => setTimeout(r, 500));
          return 'primary';
        },
        async () => {
          await new Promise((r) => setTimeout(r, 500));
          return 'secondary';
        },
        { hedgeDelayMs: 50, timeoutMs: 100 },
      );
    } catch (err) {
      timedOut = true;
      expect((err as Error).message).toContain('HedgedExecutionTimeout');
    }
    expect(timedOut).toBe(true);
  });

  it('duration metric durationMs accurately tracks elapsed time', async () => {
    const res = await HedgedExecutor.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 40));
        return 'measured_result';
      },
      undefined,
      { hedgeDelayMs: 100 },
    );
    expect(res.durationMs).toBeGreaterThan(30);
    expect(res.durationMs).toBeLessThan(200);
  });

  it('SmartProviderRouter getHedgedProviderPair returns 2 healthy providers', () => {
    const pair = smartProviderRouter.getHedgedProviderPair(Channel.SMS);
    expect(pair.primary).toBeDefined();
    expect(pair.secondary).toBeDefined();
    expect(pair.primary).not.toBe(pair.secondary);
  });

  it('SmartProviderRouter getHedgedProviderPair returns distinct providers for email', () => {
    const pair = smartProviderRouter.getHedgedProviderPair(Channel.EMAIL);
    expect(pair.primary).toBeDefined();
    expect(pair.secondary).toBeDefined();
    expect(pair.primary).not.toBe(pair.secondary);
  });

  it('single provider fallback operates normally when hedgedFn is undefined', async () => {
    const res = await HedgedExecutor.execute(async () => 'single_provider_success');
    expect(res.result).toBe('single_provider_success');
    expect(res.winner).toBe('primary');
    expect(res.hedgedTriggered).toBe(false);
  });

  it('single provider failure immediately rejects', async () => {
    let rejected = false;
    try {
      await HedgedExecutor.execute(async () => {
        throw new Error('Solo failure');
      });
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });

  it('concurrency stress: 50 simultaneous hedged calls resolve without race conditions', async () => {
    const tasks = Array.from({ length: 50 }).map((_, idx) =>
      HedgedExecutor.execute(
        async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 30));
          return `task_${idx}`;
        },
        async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 30));
          return `task_${idx}_hedged`;
        },
        { hedgeDelayMs: 15 },
      ),
    );

    const results = await Promise.all(tasks);
    expect(results.length).toBe(50);
    results.forEach((r, idx) => {
      expect(r.result).toContain(`task_${idx}`);
    });
  });

  it('AbortSignal correctly carries aborted: true on cancelled provider', async () => {
    let capturedSignal: AbortSignal | undefined;
    await HedgedExecutor.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 20));
        return 'winner';
      },
      async (signal) => {
        capturedSignal = signal;
        await new Promise((r) => setTimeout(r, 100));
        return 'loser';
      },
      { hedgeDelayMs: 10 },
    );

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('synchronous throw in provider is caught and triggers fallback', async () => {
    const res = await HedgedExecutor.execute(
      () => {
        throw new Error('Sync throw');
      },
      async () => {
        return 'async_secondary_saved';
      },
      { hedgeDelayMs: 50 },
    );
    expect(res.result).toBe('async_secondary_saved');
  });

  it('tail-latency bounding: 99th percentile spike is bounded by secondary request', async () => {
    const res = await HedgedExecutor.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return 'slow_hung_response';
      },
      async () => {
        await new Promise((r) => setTimeout(r, 30));
        return 'fast_hedged_recovery';
      },
      { hedgeDelayMs: 50 },
    );

    expect(res.result).toBe('fast_hedged_recovery');
    expect(res.durationMs).toBeLessThan(300);
  });
});
