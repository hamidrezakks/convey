export interface MockServerConfig {
  providerId: string;
  port: number;
  webhookUrl: string;
  webhookDelayMs: number;
  chaosLatencyMs: number;
  chaosErrorRate: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadMockConfig(): MockServerConfig {
  const providerId = (process.env.PROVIDER_ID || 'all').toLowerCase();
  const defaultPort = providerId === 'all' ? 4000 : 4000;
  const port = Number(process.env.PORT || defaultPort);
  const webhookUrl = process.env.WEBHOOK_URL || 'http://convey-server:3000/v1/webhooks/providers';
  const webhookDelayMs = Number(process.env.WEBHOOK_DELAY_MS || 400);
  const chaosLatencyMs = Number(process.env.CHAOS_LATENCY_MS || 0);
  const chaosErrorRate = Number(process.env.CHAOS_ERROR_RATE || 0);
  const logLevel = (process.env.LOG_LEVEL || 'info') as MockServerConfig['logLevel'];

  return {
    providerId,
    port,
    webhookUrl,
    webhookDelayMs,
    chaosLatencyMs,
    chaosErrorRate,
    logLevel,
  };
}

export const mockConfig = loadMockConfig();
