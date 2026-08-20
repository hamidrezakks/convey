import pino from 'pino';

export const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: {
    service: 'convey',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export class Logger {
  debug(component: string, message: string, meta?: Record<string, unknown>): void {
    pinoLogger.debug({ component, ...meta }, message);
  }

  info(component: string, message: string, meta?: Record<string, unknown>): void {
    pinoLogger.info({ component, ...meta }, message);
  }

  warn(component: string, message: string, meta?: Record<string, unknown>): void {
    pinoLogger.warn({ component, ...meta }, message);
  }

  error(component: string, message: string, meta?: Record<string, unknown> | Error | unknown): void {
    const errorObj =
      meta instanceof Error
        ? { error: meta.message, stack: meta.stack }
        : meta && typeof meta === 'object'
          ? (meta as Record<string, unknown>)
          : { meta };
    pinoLogger.error({ component, ...errorObj }, message);
  }
}

export const logger = new Logger();
