export interface UnifonicAdapterConfig {
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  from?: string;
  baseUrl?: string;
}

export interface UnifonicApiRequest {
  to: string;
  from?: string;
  text: string;
  mediaUrl?: string[];
  clientRef?: string;
}

export interface UnifonicApiResponse {
  id?: string;
  messageId?: string;
  status?: string;
  statusCode?: number;
  message?: string;
  error?: string;
}

export interface UnifonicWebhookPayload {
  messageId?: string;
  id?: string;
  status?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
