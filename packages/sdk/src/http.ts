/**
 * @convey/sdk - Zero-Dependency Resilient HTTP Client
 * Web standard fetch engine with exponential backoff full-jitter retries,
 * socket keep-alive, AbortSignal timeout management, and typed error deserialization.
 */

import {
  ConveyApiError,
  type ConveyApiErrorOptions,
  ConveyAuthenticationError,
  ConveyConflictError,
  ConveyError,
  ConveyForbiddenError,
  ConveyNetworkError,
  ConveyNotFoundError,
  ConveyRateLimitError,
  ConveyTimeoutError,
  ConveyValidationError,
} from './errors';
import type { ConveyClientOptions, RequestOptions } from './types';
import { createChildTraceparent, generateTraceparent } from './utils/trace';
import { generateUlid } from './utils/ulid';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 10000;

export class HttpClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly isSandbox: boolean;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly teamId?: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: ConveyClientOptions) {
    if (!options.apiKey || typeof options.apiKey !== 'string' || options.apiKey.trim().length === 0) {
      throw new ConveyError('ConveyClient requires a valid apiKey. API Key is required.');
    }

    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.apiKey = options.apiKey.trim();
    this.isSandbox = options.isSandbox ?? this.apiKey.startsWith('sk_test_');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.teamId = options.teamId;
    this.fetchFn = options.fetch || globalThis.fetch;
  }

  /**
   * Execute an authenticated HTTP request with full-jitter exponential backoff.
   */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.baseUrl);
    const queryParams = { ...options.params, ...options.query };
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const method = options.method || 'GET';
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const maxRetries = options.maxRetries ?? this.maxRetries;

    // Distributed tracing: generate or stitch child traceparent
    const traceparentHeader = options.traceparent ? createChildTraceparent(options.traceparent) : generateTraceparent();

    // Idempotency key generation: automatic monotonic ULID for mutating operations
    const idempotencyKey = options.idempotencyKey || (method !== 'GET' ? `sdk_${generateUlid()}` : undefined);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'x-api-key': this.apiKey,
      traceparent: traceparentHeader,
      ...(options.headers as Record<string, string>),
    };

    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    if (this.isSandbox || options.isSandbox) {
      headers['x-convey-sandbox'] = 'true';
    }

    if (this.teamId) {
      headers['x-convey-team'] = this.teamId;
    }

    let requestBody: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(options.body);
    }

    let attempt = 0;
    while (true) {
      attempt++;

      // AbortController setup per attempt
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      }

      // Chain external signal if passed
      if (options.signal) {
        if (options.signal.aborted) {
          controller.abort();
        } else {
          options.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
      }

      try {
        const response = await this.fetchFn(url.toString(), {
          method,
          headers,
          body: requestBody,
          signal: controller.signal,
          keepalive: true,
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        // Handle successful response (2xx)
        if (response.ok) {
          if (options.responseType === 'text') {
            return (await response.text()) as unknown as T;
          }
          if (options.responseType === 'blob') {
            return (await response.blob()) as unknown as T;
          }
          const text = await response.text();
          if (!text) {
            return {} as T;
          }
          return JSON.parse(text) as T;
        }

        // Evaluate if we should retry (429 or transient 5xx)
        const isTransient5xx = [500, 502, 503, 504].includes(response.status);
        const isRateLimited = response.status === 429;
        const canRetry = (isTransient5xx || isRateLimited) && attempt <= maxRetries;

        if (canRetry) {
          const retryAfterHeader = response.headers.get('retry-after') || response.headers.get('Retry-After');
          let delayMs = -1;

          if (retryAfterHeader) {
            const parsedSeconds = Number.parseInt(retryAfterHeader, 10);
            if (!Number.isNaN(parsedSeconds)) {
              delayMs = Math.max(0, parsedSeconds * 1000);
            } else {
              const parsedDate = Date.parse(retryAfterHeader);
              if (!Number.isNaN(parsedDate)) {
                delayMs = Math.max(0, parsedDate - Date.now());
              }
            }
          }

          if (delayMs < 0) {
            delayMs = Math.floor(Math.random() * Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** (attempt - 1)));
          }

          if (delayMs > 0) {
            await this.sleep(delayMs);
          }
          continue;
        }

        const rawBody = await response.text();
        throw this.deserializeError(response, rawBody, traceparentHeader);
      } catch (err) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        if (err instanceof ConveyApiError) {
          throw err;
        }

        // Handle timeout / abort
        if (controller.signal.aborted || options.signal?.aborted || (err as Error).name === 'AbortError') {
          if (options.signal?.aborted) {
            throw new ConveyError('Request aborted by caller AbortSignal.');
          }
          throw new ConveyTimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
        }

        // Transient network error retry
        if (attempt <= maxRetries) {
          const backoff = Math.floor(Math.random() * Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** (attempt - 1)));
          await this.sleep(backoff);
          continue;
        }

        throw new ConveyNetworkError(`Network request failed: ${(err as Error).message}`, err as Error);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private deserializeError(response: Response, rawBody: string, traceparent?: string): ConveyApiError {
    const statusCode = response.status;
    let errorCode = 'API_ERROR';
    let message = `Convey HTTP ${statusCode} ${response.statusText}`;
    let details: unknown;

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === 'object') {
        if (parsed.error) {
          if (typeof parsed.error === 'string') {
            message = parsed.error;
          } else if (typeof parsed.error === 'object') {
            errorCode = parsed.error.code || errorCode;
            message = parsed.error.message || message;
            details = parsed.error.details;
          }
        } else if (parsed.message) {
          message = parsed.message;
          errorCode = parsed.code || errorCode;
          details = parsed.details;
        }
      }
    } catch {
      // Body is not JSON (e.g. HTML 502/504 gateway error)
      if (rawBody && rawBody.trim().length > 0) {
        message = rawBody.slice(0, 500);
      }
    }

    const errorOptions: ConveyApiErrorOptions = {
      message,
      statusCode,
      errorCode,
      details,
      requestId: responseHeaders['x-request-id'] || responseHeaders['request-id'],
      traceparent: traceparent || responseHeaders.traceparent,
      headers: responseHeaders,
      rawBody,
    };

    switch (statusCode) {
      case 400:
        return new ConveyValidationError(errorOptions);
      case 401:
        return new ConveyAuthenticationError(errorOptions);
      case 403:
        return new ConveyForbiddenError(errorOptions);
      case 404:
        return new ConveyNotFoundError(errorOptions);
      case 409:
        return new ConveyConflictError(errorOptions);
      case 429: {
        const retryAfterStr = responseHeaders['retry-after'] || responseHeaders['Retry-After'];
        const retryAfterSeconds = retryAfterStr ? Number.parseInt(retryAfterStr, 10) : undefined;
        return new ConveyRateLimitError({
          ...errorOptions,
          retryAfterSeconds: Number.isNaN(retryAfterSeconds) ? undefined : retryAfterSeconds,
        });
      }
      default:
        return new ConveyApiError(errorOptions);
    }
  }
}
