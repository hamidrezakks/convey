/**
 * @convey/sdk - Middleware & Interceptor Pipeline
 * Chainable request, response, and error interceptors for APM, OpenTelemetry, metrics, and custom headers.
 */

import type { RequestOptions } from './types';

export interface RequestContext {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  options: RequestOptions;
  attempt: number;
}

export interface ResponseContext<T = unknown> {
  response: Response;
  data: T;
  request: RequestContext;
  durationMs: number;
}

export interface ErrorContext {
  error: Error;
  request: RequestContext;
  response?: Response;
  durationMs: number;
  attempt: number;
}

export interface ConveyMiddleware {
  /**
   * Optional human-readable identifier for the middleware.
   */
  name?: string;

  /**
   * Hook executed before the outbound HTTP request is dispatched.
   * Can mutate or return updated request context.
   */
  onRequest?: (context: RequestContext) => Promise<RequestContext | undefined> | RequestContext | undefined;

  /**
   * Hook executed after receiving a successful response (2xx) and parsing data.
   * Can transform or inspect the returned response context.
   */
  onResponse?: <T>(
    context: ResponseContext<T>,
  ) => Promise<ResponseContext<T> | undefined> | ResponseContext<T> | undefined;

  /**
   * Hook executed when an error occurs during the request lifecycle.
   */
  onError?: (context: ErrorContext) => Promise<void> | void;
}

export class MiddlewareRunner {
  private readonly middlewares: ConveyMiddleware[] = [];

  constructor(initialMiddlewares: ConveyMiddleware[] = []) {
    this.middlewares = [...initialMiddlewares];
  }

  use(middleware: ConveyMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async runOnRequest(initialContext: RequestContext): Promise<RequestContext> {
    let current = { ...initialContext, headers: { ...initialContext.headers } };

    for (const mw of this.middlewares) {
      if (mw.onRequest) {
        const result = await mw.onRequest(current);
        if (result && typeof result === 'object') {
          current = { ...result, headers: { ...result.headers } };
        }
      }
    }

    return current;
  }

  async runOnResponse<T>(initialContext: ResponseContext<T>): Promise<ResponseContext<T>> {
    let current = initialContext;

    // Run response interceptors in reverse order (onion model)
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const mw = this.middlewares[i];
      if (mw.onResponse) {
        const result = await mw.onResponse(current);
        if (result && typeof result === 'object') {
          current = result as ResponseContext<T>;
        }
      }
    }

    return current;
  }

  async runOnError(context: ErrorContext): Promise<void> {
    for (const mw of this.middlewares) {
      if (mw.onError) {
        try {
          await mw.onError(context);
        } catch {
          // Prevent middleware error from masking the primary request error
        }
      }
    }
  }
}
