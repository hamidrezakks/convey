/**
 * @convey/sdk - High-Performance Zero-Dependency HTTP Client
 * Implements deterministic resiliency with full-jitter exponential backoff,
 * 429 Retry-After parsing, W3C traceparent stitching, and typed error deserialization.
 */

import {
  ConveyApiError,
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

export interface HttpRequestOptions extends RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  responseType?: 'json' | 'text' | 'blob';
}

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 10_000;

export class HttpClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly isSandbox: boolean;
  readonly teamId?: string;
  readonly fetchFn: typeof fetch;
  readonly defaultHeaders: Record<string, string>;

  constructor(options: ConveyClientOptions) {
    if (!options.apiKey) {
      throw new Error('[Convey SDK] API Key is required. Pass { apiKey: "sk_..." }');
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || (typeof process !== 'undefined' && process.env?.CONVEY_BASE_URL) || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.isSandbox = Boolean(options.isSandbox || (options.apiKey.startsWith('sk_test_')));
    this.teamId = options.teamId;
    this.fetchFn = options.fetch || globalThis.fetch.bind(globalThis);
    this.defaultHeaders = options.defaultHeaders || {};
  }

  /**
   * Execute an HTTP request with automatic full-jitter retries and W3C trace propagation.
   */
  async request<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    const method = options.method || 'GET';
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const isSandbox = options.isSandbox ?? this.isSandbox;

    // URL & Query Params
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    // Idempotency Key (Generated for state-mutating requests if not provided)
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const idempotencyKey = options.idempotencyKey || (isMutating ? `sdk_${generateUlid()}` : undefined);

    // Distributed Trace Context
    const traceparent = options.traceparent
      ? createChildTraceparent(options.traceparent)
      : generateTraceparent();

    // Headers Assembly
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'x-api-key': this.apiKey,
      traceparent,
      ...this.defaultHeaders,
      ...options.headers,
    };

    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    if (isSandbox) {
      headers['x-convey-sandbox'] = 'true';
    }

    if (this.teamId && !headers['x-convey-team']) {
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

      // AbortController setup
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      }

      // Chain external signal if passed
      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
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
          let delayMs = 0;

          if (retryAfterHeader) {
            const parsedSeconds = Number.parseInt(retryAfterHeader, 10);
            if (!Number.isNaN(parsedSeconds)) {
              delayMs = parsedSeconds * 1000;
            } else {
              const parsedDate = Date.parse(retryAfterHeader);
              if (!Number.isNaN(parsedDate)) {
                delayMs = Math.max(0, parsedDate - Date.now());
              }
            }
          }

          if (delayMs === 0) {
            // Full-Jitter Exponential Backoff: sleep = min(maxBackoff, rand(0, base * 2^attempt))
            const maxBackoffForAttempt = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** (attempt - 1));
            delayMs = Math.floor(Math.random() * maxBackoffForAttempt);
          }

          await this.sleep(delayMs);
          continue; // Retry next attempt
        }

        // Non-retryable error: parse response and throw typed error
        const rawBody = await response.text();
        throw this.deserializeError(response, rawBody, traceparent);
      } catch (err: unknown) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (err instanceof ConveyApiError) {
          throw err;
        }

        // Handle timeout / abort
        if (controller.signal.aborted) {
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
      if (rawBody) {
        const json = JSON.parse(rawBody);
        if (json.error) {
          errorCode = json.error.code || errorCode;
          message = json.error.message || message;
          details = json.error.details;
        } else if (json.message) {
          message = json.message;
        }
      }
    } catch {
      if (rawBody) {
        message = rawBody;
      }
    }

    const errorOptions = {
      message,
      statusCode,
      errorCode,
      details,
      traceparent,
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
        const retryAfter = response.headers.get('retry-after') || response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : undefined;
        return new ConveyRateLimitError({ ...errorOptions, retryAfterSeconds });
      }
      default:
        return new ConveyApiError(errorOptions);
    }
  }
}
