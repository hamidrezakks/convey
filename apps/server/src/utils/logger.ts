import pino from 'pino';

export const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: {
    service: 'convey',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function redactLogMetadata(value: unknown, seen = new WeakSet<object>()): unknown {
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactLogMetadata(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /authorization|cookie|password|token|secret|api[-_]?key|credentials|recipients?|email|phone|webhookurl/i.test(key)
        ? '[REDACTED]'
        : redactLogMetadata(item, seen),
    ]),
  );
}

export class Logger {
  debug(component: string, message: string, meta?: Record<string, unknown>): void {
    pinoLogger.debug({ component, metadata: redactLogMetadata(meta) }, message);
  }

  info(component: string, message: string, meta?: Record<string, unknown>): void {
    pinoLogger.info({ component, metadata: redactLogMetadata(meta) }, message);
  }

  warn(component: string, message: string, meta?: Record<string, unknown>): void {
    pinoLogger.warn({ component, metadata: redactLogMetadata(meta) }, message);
  }

  error(component: string, message: string, meta?: Record<string, unknown> | Error | unknown): void {
    const errorObj =
      meta instanceof Error
        ? { error: meta.message, stack: meta.stack }
        : meta && typeof meta === 'object'
          ? (meta as Record<string, unknown>)
          : { meta };
    pinoLogger.error({ component, metadata: redactLogMetadata(errorObj) }, message);
  }
}

export const logger = new Logger();
