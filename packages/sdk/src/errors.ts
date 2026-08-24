/**
 * @convey/sdk - Typed Error Hierarchy
 * Production-grade error classes with rich contextual metadata for debugging and error handling.
 */

export class ConveyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConveyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ConveyApiErrorOptions {
  message: string;
  statusCode: number;
  errorCode?: string;
  details?: unknown;
  requestId?: string;
  traceparent?: string;
  headers?: Record<string, string>;
  rawBody?: string;
}

export class ConveyApiError extends ConveyError {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly details?: unknown;
  readonly requestId?: string;
  readonly traceparent?: string;
  readonly headers?: Record<string, string>;
  readonly rawBody?: string;

  constructor(options: ConveyApiErrorOptions) {
    super(options.message);
    this.name = 'ConveyApiError';
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode || 'API_ERROR';
    this.details = options.details;
    this.requestId = options.requestId;
    this.traceparent = options.traceparent;
    this.headers = options.headers;
    this.rawBody = options.rawBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConveyAuthenticationError extends ConveyApiError {
  constructor(options: Omit<ConveyApiErrorOptions, 'statusCode'>) {
    super({ ...options, statusCode: 401, errorCode: options.errorCode || 'UNAUTHORIZED' });
    this.name = 'ConveyAuthenticationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConveyForbiddenError extends ConveyApiError {
  constructor(options: Omit<ConveyApiErrorOptions, 'statusCode'>) {
    super({ ...options, statusCode: 403, errorCode: options.errorCode || 'FORBIDDEN' });
    this.name = 'ConveyForbiddenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConveyNotFoundError extends ConveyApiError {
  constructor(options: Omit<ConveyApiErrorOptions, 'statusCode'>) {
    super({ ...options, statusCode: 404, errorCode: options.errorCode || 'NOT_FOUND' });
    this.name = 'ConveyNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConveyConflictError extends ConveyApiError {
  constructor(options: Omit<ConveyApiErrorOptions, 'statusCode'>) {
    super({ ...options, statusCode: 409, errorCode: options.errorCode || 'IDEMPOTENCY_CONFLICT' });
    this.name = 'ConveyConflictError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConveyRateLimitError extends ConveyApiError {
  readonly retryAfterSeconds?: number;

  constructor(options: Omit<ConveyApiErrorOptions, 'statusCode'> & { retryAfterSeconds?: number }) {
    super({ ...options, statusCode: 429, errorCode: options.errorCode || 'RATE_LIMITED' });
    this.name = 'ConveyRateLimitError';
    this.retryAfterSeconds = options.retryAfterSeconds;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConveyValidationError extends ConveyApiError {
  constructor(options: Omit<ConveyApiErrorOptions, 'statusCode'>) {
    super({ ...options, statusCode: 400, errorCode: options.errorCode || 'VALIDATION_ERROR' });
    this.name = 'ConveyValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConveyTimeoutError extends ConveyError {
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = 'ConveyTimeoutError';
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConveyNetworkError extends ConveyError {
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ConveyNetworkError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConveySecurityError extends ConveyError {
  constructor(message: string) {
    super(message);
    this.name = 'ConveySecurityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
