import { logger } from '../../../utils/logger';

export interface HedgedExecutionOptions {
  hedgeDelayMs?: number; // Time before firing speculative secondary request (default 500ms)
  timeoutMs?: number; // Total timeout threshold (default 10,000ms)
}

export interface HedgedExecutionResult<T> {
  result: T;
  winner: 'primary' | 'secondary';
  hedgedTriggered: boolean;
  durationMs: number;
}

/**
 * Speculative Parallel Hedged Request Executor.
 *
 * Mitigates p99/p99.9 long-tail latency spikes for mission-critical alerts (2FA OTP, fraud alerts).
 * If primary provider does not settle within `hedgeDelayMs`, fires secondary provider speculatively.
 * The fastest successful response commits; the slower request is aborted via AbortSignal.
 */
export const HedgedExecutor = {
  async execute<T>(
    primaryFn: (signal: AbortSignal) => Promise<T>,
    hedgedFn?: (signal: AbortSignal) => Promise<T>,
    options: HedgedExecutionOptions = {},
  ): Promise<HedgedExecutionResult<T>> {
    const hedgeDelayMs = options.hedgeDelayMs ?? 500;
    const timeoutMs = options.timeoutMs ?? 10000;
    const startTime = performance.now();

    const primaryController = new AbortController();
    const secondaryController = new AbortController();

    let hedgedTriggered = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    return new Promise<HedgedExecutionResult<T>>((resolve, reject) => {
      let primaryError: Error | undefined;
      let secondaryError: Error | undefined;
      let primaryFinished = false;
      let secondaryFinished = false;

      const finishPrimary = (res: T) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        secondaryController.abort();
        resolve({
          result: res,
          winner: 'primary',
          hedgedTriggered,
          durationMs: performance.now() - startTime,
        });
      };

      const finishSecondary = (res: T) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        primaryController.abort();
        resolve({
          result: res,
          winner: 'secondary',
          hedgedTriggered: true,
          durationMs: performance.now() - startTime,
        });
      };

      const checkBothFailed = () => {
        if (settled) return;
        if (primaryFinished && (!hedgedFn || secondaryFinished)) {
          settled = true;
          if (timer) clearTimeout(timer);
          reject(primaryError || secondaryError || new Error('All hedged attempts failed'));
        }
      };

      const runSecondary = () => {
        if (settled || !hedgedFn || secondaryFinished) return;
        hedgedTriggered = true;
        logger.info(
          'HedgedExecutor',
          `Primary provider exceeded ${hedgeDelayMs}ms hedge window. Firing speculative secondary request.`,
        );

        Promise.resolve()
          .then(() => hedgedFn(secondaryController.signal))
          .then(finishSecondary)
          .catch((err) => {
            secondaryFinished = true;
            secondaryError = err as Error;
            checkBothFailed();
          });
      };

      // Run primary safely
      Promise.resolve()
        .then(() => primaryFn(primaryController.signal))
        .then(finishPrimary)
        .catch((err) => {
          primaryFinished = true;
          primaryError = err as Error;
          if (!settled && hedgedFn) {
            if (timer) clearTimeout(timer);
            runSecondary();
          } else {
            checkBothFailed();
          }
        });

      // Schedule secondary after hedgeDelayMs if hedgedFn provided
      if (hedgedFn) {
        timer = setTimeout(() => {
          if (!settled && !primaryFinished) {
            runSecondary();
          }
        }, hedgeDelayMs);
      }

      // Timeout watchdog
      setTimeout(() => {
        if (!settled) {
          settled = true;
          if (timer) clearTimeout(timer);
          primaryController.abort();
          secondaryController.abort();
          reject(new Error(`HedgedExecutionTimeout: Senders did not resolve within ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });
  },
};
