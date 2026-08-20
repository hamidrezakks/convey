export interface ZulipAdapterConfig {
  domain?: string;
  email?: string;
  username?: string;
  apiKey?: string;
  topic?: string;
}

export interface ZulipApiRequest {
  type: 'stream' | 'private';
  to: string;
  topic?: string;
  content: string;
}

export interface ZulipApiResponse {
  id?: number;
  result?: string;
  msg?: string;
  code?: string;
}

export interface ZulipWebhookPayload {
  event?: string;
  message?: {
    id?: number | string;
    content?: string;
    display_recipient?: string;
    timestamp?: number;
  };
  rawPayload?: unknown;
}
