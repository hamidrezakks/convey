/**
 * @convey/sdk - Lifecycle Polling & Async Awaiting
 * High-level polling utilities for tracking message delivery and batch completion.
 */

import { ConveyError, ConveyTimeoutError } from './errors';
import type { BatchesResource } from './resources/batches';
import type { MessagesResource } from './resources/messages';
import {
  type BatchDto,
  BatchState,
  type BatchStateType,
  type MessageDetailDto,
  MessageStatus,
  type MessageStatusType,
} from './types';

export interface WaitForDeliveryOptions {
  /**
   * Interval between status checks in milliseconds.
   * @default 500
   */
  pollIntervalMs?: number;

  /**
   * Maximum duration to wait before timing out in milliseconds.
   * @default 30000 (30 seconds)
   */
  timeoutMs?: number;

  /**
   * Target status to wait for.
   */
  targetStatus?: MessageStatus | MessageStatusType | string;

  /**
   * Terminal statuses to stop polling on.
   * @default ['DELIVERED', 'FAILED', 'SUPPRESSED']
   */
  terminalStatuses?: Array<MessageStatus | MessageStatusType | string>;

  /**
   * Callback invoked on every status probe.
   */
  onPoll?: (message: MessageDetailDto) => void;

  /**
   * Optional AbortSignal for cancellation.
   */
  signal?: AbortSignal;
}

export interface WaitForBatchOptions {
  /**
   * Interval between batch checks in milliseconds.
   * @default 1000
   */
  pollIntervalMs?: number;

  /**
   * Maximum duration to wait before timing out in milliseconds.
   * @default 60000 (60 seconds)
   */
  timeoutMs?: number;

  /**
   * Target state to wait for.
   */
  targetState?: BatchState | BatchStateType | string;

  /**
   * Terminal states to stop polling on.
   * @default ['COMPLETED', 'CANCELLED']
   */
  terminalStates?: Array<BatchState | BatchStateType | string>;

  /**
   * Callback invoked on every status probe.
   */
  onPoll?: (batch: BatchDto) => void;

  /**
   * Optional AbortSignal for cancellation.
   */
  signal?: AbortSignal;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new ConveyError('Polling aborted by caller signal.'));
    }

    const timer = setTimeout(() => {
      resolve();
    }, ms);

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new ConveyError('Polling aborted by caller signal.'));
        },
        { once: true },
      );
    }
  });
}

/**
 * Poll message status until it reaches a terminal delivery state or times out.
 */
export async function waitForDelivery(
  resource: MessagesResource,
  messageId: string,
  options: WaitForDeliveryOptions = {},
): Promise<MessageDetailDto> {
  const pollIntervalMs = Math.max(5, options.pollIntervalMs ?? 500);
  const timeoutMs = Math.max(50, options.timeoutMs ?? 30000);
  const terminalStatuses = (
    options.terminalStatuses || [MessageStatus.DELIVERED, MessageStatus.FAILED, MessageStatus.SUPPRESSED]
  ).map((s) => String(s).toUpperCase());

  const startTime = Date.now();

  while (true) {
    if (options.signal?.aborted) {
      throw new ConveyError('Polling aborted by caller signal.');
    }

    if (Date.now() - startTime >= timeoutMs) {
      throw new ConveyTimeoutError(
        `Message '${messageId}' did not reach terminal delivery state within ${timeoutMs}ms.`,
        timeoutMs,
      );
    }

    const message = await resource.get(messageId);
    if (options.onPoll) {
      options.onPoll(message);
    }

    const currentStatus = String(message.status || '').toUpperCase();
    if (terminalStatuses.includes(currentStatus)) {
      return message;
    }

    await sleep(pollIntervalMs, options.signal);
  }
}

/**
 * Poll batch processing status until it completes or cancels.
 */
export async function waitForBatchCompletion(
  resource: BatchesResource,
  batchId: string,
  options: WaitForBatchOptions = {},
): Promise<BatchDto> {
  const pollIntervalMs = Math.max(5, options.pollIntervalMs ?? 1000);
  const timeoutMs = Math.max(50, options.timeoutMs ?? 60000);
  const terminalStates = (options.terminalStates || [BatchState.COMPLETED, BatchState.CANCELLED]).map((s) =>
    String(s).toUpperCase(),
  );

  const startTime = Date.now();

  while (true) {
    if (options.signal?.aborted) {
      throw new ConveyError('Polling aborted by caller signal.');
    }

    if (Date.now() - startTime >= timeoutMs) {
      throw new ConveyTimeoutError(`Batch '${batchId}' did not complete within ${timeoutMs}ms.`, timeoutMs);
    }

    const res = await resource.get(batchId);
    const batchDto = (res.batch || res) as BatchDto;
    if (options.onPoll) {
      options.onPoll(batchDto);
    }

    const currentState = String(batchDto.state || '').toUpperCase();
    if (terminalStates.includes(currentState)) {
      return batchDto;
    }

    await sleep(pollIntervalMs, options.signal);
  }
}
