export interface NexmoSmsAdapterConfig {
  apiKey?: string;
  apiSecret?: string;
  from?: string;
  baseUrl?: string;
  [key: string]: unknown;
}
export type NexmoAdapterConfig = NexmoSmsAdapterConfig;

export interface NexmoApiRequest {
  api_key: string;
  api_secret: string;
  to: string;
  from: string;
  text: string;
}

export interface NexmoApiResponse {
  'message-count'?: string;
  messages?: Array<{
    to?: string;
    'message-id'?: string;
    status?: string;
    'error-text'?: string;
  }>;
}

export interface NexmoWebhookPayload {
  messageId?: string;
  status?: string;
  rawPayload?: unknown;
}
