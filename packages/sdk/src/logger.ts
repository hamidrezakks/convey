/**
 * @convey/sdk - Pluggable Structured Logging & Telemetry
 * Secure, zero-dependency logging engine with sensitive token masking.
 */

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export interface ConveyLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const SENSITIVE_KEY_PATTERNS = [/auth/i, /key/i, /token/i, /secret/i, /password/i, /signature/i, /credential/i];

/**
 * Mask sensitive credentials in logs (API keys, authorization headers, tokens).
 */
export function sanitizeLogData<T>(data: T): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive && typeof val === 'string') {
      if (val.length <= 8) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = `${val.slice(0, 4)}...${val.slice(-4)} [REDACTED]`;
      }
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeLogData(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized as T;
}

export class ConsoleLogger implements ConveyLogger {
  private readonly level: LogLevel;

  constructor(level: LogLevel = 'warn') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_WEIGHTS[this.level] >= LOG_LEVEL_WEIGHTS[level];
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    const sanitized = meta ? sanitizeLogData(meta) : undefined;
    console.debug(`[Convey SDK DEBUG] ${message}`, sanitized || '');
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    const sanitized = meta ? sanitizeLogData(meta) : undefined;
    console.info(`[Convey SDK INFO] ${message}`, sanitized || '');
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;
    const sanitized = meta ? sanitizeLogData(meta) : undefined;
    console.warn(`[Convey SDK WARN] ${message}`, sanitized || '');
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    const sanitized = meta ? sanitizeLogData(meta) : undefined;
    console.error(`[Convey SDK ERROR] ${message}`, sanitized || '');
  }
}

export class NoopLogger implements ConveyLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export function createLogger(logger?: ConveyLogger, level?: LogLevel): ConveyLogger {
  if (logger) {
    return logger;
  }
  if (level === 'silent') {
    return new NoopLogger();
  }
  return new ConsoleLogger(level ?? 'silent');
}
