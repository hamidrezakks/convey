export interface PlunkEmailAdapterConfig {
  apiKey?: string;
}

export interface PlunkApiRequest {
  to: string | string[];
  subject: string;
  body: string;
  name?: string;
  subscribed?: boolean;
}

export interface PlunkApiResponse {
  success?: boolean;
  id?: string;
  timestamp?: string;
  error?: string;
}

export interface PlunkWebhookPayload {
  id?: string;
  event?: string;
  email?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
