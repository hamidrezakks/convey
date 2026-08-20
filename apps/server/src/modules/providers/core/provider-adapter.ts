import type {
  Channel,
  NormalizedWebhookEvent,
  ProviderCapabilities,
  ProviderSendOptions,
  ProviderSendResult,
} from './provider-types';

export interface ProviderAdapter<TConfig = Record<string, unknown>, TReq = unknown, TRes = unknown> {
  readonly id: string;
  readonly channel: Channel;
  readonly capabilities: ProviderCapabilities;

  /** Returns true if required provider configuration, credentials, or environment variables exist */
  hasSetup?(config?: TConfig): boolean;

  send(options: ProviderSendOptions, config?: TConfig): Promise<ProviderSendResult>;
  transformRequest?(options: ProviderSendOptions, config?: TConfig): TReq;
  transformResponse?(response: TRes, statusCode?: number, rawBody?: unknown): ProviderSendResult;
  verifyWebhook?(request: Request, rawBody: string, config?: TConfig): Promise<boolean>;
  parseWebhook?(body: unknown, headers?: Record<string, string>): NormalizedWebhookEvent[];
  probeHealth?(config?: TConfig): Promise<{ healthy: boolean; latencyMs: number; message?: string }>;
}
