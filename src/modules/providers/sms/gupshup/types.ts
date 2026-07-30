export interface GupshupAdapterConfig {
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  from?: string;
  baseUrl?: string;
}

export interface GupshupApiRequest {
  to: string;
  from?: string;
  text: string;
  mediaUrl?: string[];
  clientRef?: string;
}

export interface GupshupApiResponse {
  id?: string;
  messageId?: string;
  status?: string;
  statusCode?: number;
  message?: string;
  error?: string;
}

export interface GupshupWebhookPayload {
  messageId?: string;
  id?: string;
  status?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
