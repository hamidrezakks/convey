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
  const port = Number(process.env.MOCK_PORT || (process.env.PORT && process.env.PORT !== '3000' ? process.env.PORT : 4000));
  const webhookUrl = process.env.WEBHOOK_URL || (process.env.DOCKER_ENV ? 'http://convey-server:3000/v1/webhooks' : 'http://localhost:3000/v1/webhooks');
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
