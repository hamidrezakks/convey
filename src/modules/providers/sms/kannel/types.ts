export interface KannelAdapterConfig {
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  from?: string;
  baseUrl?: string;
}

export interface KannelApiRequest {
  to: string;
  from?: string;
  text: string;
  mediaUrl?: string[];
  clientRef?: string;
}

export interface KannelApiResponse {
  id?: string;
  messageId?: string;
  status?: string;
  statusCode?: number;
  message?: string;
  error?: string;
}

export interface KannelWebhookPayload {
  messageId?: string;
  id?: string;
  status?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
