/**
 * @convey/sdk - Zero-Dependency Resilient HTTP Client
 * Web standard fetch engine with exponential backoff full-jitter retries,
 * socket keep-alive, AbortSignal timeout management, pluggable middleware pipeline,
 * client-side rate smoothing, and typed error deserialization.
 */

import { normalizeBaseUrl, resolveBaseUrl } from './environments';
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
import { type ConveyLogger, createLogger } from './logger';
import {
  type ConveyMiddleware,
  type ErrorContext,
  MiddlewareRunner,
  type RequestContext,
  type ResponseContext,
} from './middleware';
import { TokenBucketRateLimiter } from './rate-limiter';
import type { ConveyClientOptions, RequestOptions, RetryPolicy } from './types';
import { createChildTraceparent, generateTraceparent } from './utils/trace';
import { generateUlid } from './utils/ulid';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 10000;

export class HttpClient {
  private currentBaseUrl: string;
  readonly apiKey: string;
  readonly isSandbox: boolean;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly teamId?: string;
  readonly defaultHeaders?: Record<string, string>;
  readonly retryPolicy?: RetryPolicy;
  readonly logger: ConveyLogger;
  private readonly middlewareRunner: MiddlewareRunner;
  private readonly rateLimiter?: TokenBucketRateLimiter;
  private readonly fetchFn: typeof fetch;

  constructor(options: ConveyClientOptions = {}) {
    // 1. Mandatory Base URL Resolution
    this.currentBaseUrl = resolveBaseUrl({
      baseUrl: options.baseUrl,
      environment: options.environment,
    });

    // 2. API Key Resolution
    const resolvedApiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.CONVEY_API_KEY : undefined);

    if (!resolvedApiKey || typeof resolvedApiKey !== 'string' || resolvedApiKey.trim().length === 0) {
      throw new ConveyError(
        'ConveyClient requires a valid apiKey. Please provide "apiKey" or set the "CONVEY_API_KEY" environment variable.',
      );
    }

    this.apiKey = resolvedApiKey.trim();
    this.isSandbox = options.isSandbox ?? this.apiKey.startsWith('sk_test_');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? options.retryPolicy?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryPolicy = options.retryPolicy;
    this.teamId = options.teamId;
    this.defaultHeaders = options.defaultHeaders;
    this.fetchFn = options.fetch || globalThis.fetch;

    // 3. Logger Initialization
    this.logger = createLogger(options.logger, options.logLevel);

    // 4. Middleware Runner Initialization
    this.middlewareRunner = new MiddlewareRunner(options.middlewares || []);

    // 5. Rate Limiter Initialization
    if (options.rateLimiter === true) {
      this.rateLimiter = new TokenBucketRateLimiter({ maxRequestsPerSecond: 50 });
    } else if (options.rateLimiter && typeof options.rateLimiter === 'object') {
      this.rateLimiter = new TokenBucketRateLimiter(options.rateLimiter);
    }
  }

  /**
   * Get the current effective base URL.
   */
  get baseUrl(): string {
    return this.currentBaseUrl;
  }

  /**
   * Dynamically update the base URL for subsequent requests.
   */
  setBaseUrl(url: string): void {
    this.currentBaseUrl = normalizeBaseUrl(url);
    this.logger.debug(`Base URL updated to: ${this.currentBaseUrl}`);
  }

  /**
   * Register a middleware interceptor into the execution pipeline.
   */
  use(middleware: ConveyMiddleware): this {
    this.middlewareRunner.use(middleware);
    return this;
  }

  /**
   * Execute an authenticated HTTP request with interceptors and full-jitter exponential backoff.
   */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const effectiveBaseUrl = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : this.currentBaseUrl;
    const rawUrl = new URL(path.startsWith('/') ? path : `/${path}`, effectiveBaseUrl);
    const queryParams = { ...options.params, ...options.query };
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        rawUrl.searchParams.set(key, String(value));
      }
    }

    const method = options.method || 'GET';
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const maxRetries = options.maxRetries ?? this.retryPolicy?.maxRetries ?? this.maxRetries;

    // Distributed tracing: generate or stitch child traceparent
    const traceparentHeader = options.traceparent ? createChildTraceparent(options.traceparent) : generateTraceparent();

    // Idempotency key generation: automatic monotonic ULID for mutating operations
    const idempotencyKey = options.idempotencyKey || (method !== 'GET' ? `sdk_${generateUlid()}` : undefined);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'x-api-key': this.apiKey,
      traceparent: traceparentHeader,
      ...this.defaultHeaders,
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
      requestBody = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    let attempt = 0;
    while (true) {
      attempt++;

      // Client-side rate smoothing pace
      if (this.rateLimiter) {
        await this.rateLimiter.acquire();
      }

      const requestContext: RequestContext = {
        url: rawUrl,
        method,
        headers,
        body: options.body,
        options,
        attempt,
      };

      // Run onRequest middlewares
      const interceptedContext = await this.middlewareRunner.runOnRequest(requestContext);

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

      const requestStartTime = Date.now();
      this.logger.debug(
        `[HTTP] ${method} ${interceptedContext.url.toString()} (Attempt ${attempt}/${maxRetries + 1})`,
        {
          headers: interceptedContext.headers,
        },
      );

      try {
        const response = await this.fetchFn(interceptedContext.url.toString(), {
          method: interceptedContext.method,
          headers: interceptedContext.headers,
          body: requestBody,
          signal: controller.signal,
          keepalive: true,
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        const durationMs = Date.now() - requestStartTime;

        // Handle successful response (2xx)
        if (response.ok) {
          let parsedData: T;
          if (options.responseType === 'text') {
            parsedData = (await response.text()) as unknown as T;
          } else if (options.responseType === 'blob') {
            parsedData = (await response.blob()) as unknown as T;
          } else {
            const text = await response.text();
            parsedData = text ? (JSON.parse(text) as T) : ({} as T);
          }

          const responseContext: ResponseContext<T> = {
            response,
            data: parsedData,
            request: interceptedContext,
            durationMs,
          };

          // Run onResponse middlewares
          const interceptedResponse = await this.middlewareRunner.runOnResponse(responseContext);

          this.logger.debug(
            `[HTTP OK] ${method} ${interceptedContext.url.pathname} (${response.status}) in ${durationMs}ms`,
          );
          return interceptedResponse.data;
        }

        // Evaluate if we should retry (429 or transient 5xx)
        const isTransient5xx = [500, 502, 503, 504].includes(response.status);
        const isRateLimited = response.status === 429;
        const defaultCanRetry = (isTransient5xx || isRateLimited) && attempt <= maxRetries;

        if (defaultCanRetry) {
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
            delayMs = this.computeBackoff(attempt);
          }

          this.logger.warn(
            `[HTTP RETRY] ${method} ${interceptedContext.url.pathname} received HTTP ${response.status}. Retrying in ${delayMs}ms (Attempt ${attempt}/${maxRetries})...`,
          );

          if (delayMs > 0) {
            await this.sleep(delayMs);
          }
          continue;
        }

        const rawBody = await response.text();
        const apiError = this.deserializeError(response, rawBody, traceparentHeader);

        // Run onError middlewares
        const errorContext: ErrorContext = {
          error: apiError,
          request: interceptedContext,
          response,
          durationMs,
          attempt,
        };
        await this.middlewareRunner.runOnError(errorContext);

        throw apiError;
      } catch (err) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        const durationMs = Date.now() - requestStartTime;

        if (err instanceof ConveyApiError) {
          throw err;
        }

        // Handle timeout / abort
        if (controller.signal.aborted || options.signal?.aborted || (err as Error).name === 'AbortError') {
          if (options.signal?.aborted) {
            throw new ConveyError('Request aborted by caller AbortSignal.');
          }
          const timeoutError = new ConveyTimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
          await this.middlewareRunner.runOnError({
            error: timeoutError,
            request: interceptedContext,
            durationMs,
            attempt,
          });
          throw timeoutError;
        }

        // Transient network error retry
        const shouldRetryNetwork = this.retryPolicy?.shouldRetry
          ? this.retryPolicy.shouldRetry(err as Error, attempt)
          : attempt <= maxRetries;

        if (shouldRetryNetwork && attempt <= maxRetries) {
          const backoff = this.computeBackoff(attempt);
          this.logger.warn(
            `[HTTP NETWORK RETRY] Network failure '${(err as Error).message}'. Retrying in ${backoff}ms (Attempt ${attempt}/${maxRetries})...`,
          );
          await this.sleep(backoff);
          continue;
        }

        const networkError = new ConveyNetworkError(`Network request failed: ${(err as Error).message}`, err as Error);
        await this.middlewareRunner.runOnError({
          error: networkError,
          request: interceptedContext,
          durationMs,
          attempt,
        });
        throw networkError;
      }
    }
  }

  private computeBackoff(attempt: number): number {
    const initial = this.retryPolicy?.initialBackoffMs ?? INITIAL_BACKOFF_MS;
    const max = this.retryPolicy?.maxBackoffMs ?? MAX_BACKOFF_MS;
    const strategy = this.retryPolicy?.strategy ?? 'exponential';
    const jitter = this.retryPolicy?.jitter ?? 'full';

    let baseDelay: number;
    if (strategy === 'linear') {
      baseDelay = Math.min(max, initial * attempt);
    } else if (strategy === 'fixed') {
      baseDelay = initial;
    } else {
      baseDelay = Math.min(max, initial * 2 ** (attempt - 1));
    }

    if (jitter === 'none') {
      return baseDelay;
    }
    if (jitter === 'equal') {
      return Math.floor(baseDelay / 2 + Math.random() * (baseDelay / 2));
    }
    // Full jitter
    return Math.floor(Math.random() * baseDelay);
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
