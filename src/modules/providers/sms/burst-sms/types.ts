export interface BurstSmsAdapterConfig {
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  from?: string;
  baseUrl?: string;
}

export interface BurstSmsApiRequest {
  to: string;
  from?: string;
  text: string;
  mediaUrl?: string[];
  clientRef?: string;
}

export interface BurstSmsApiResponse {
  id?: string;
  messageId?: string;
  status?: string;
  statusCode?: number;
  message?: string;
  error?: string;
}

export interface BurstSmsWebhookPayload {
  messageId?: string;
  id?: string;
  status?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
