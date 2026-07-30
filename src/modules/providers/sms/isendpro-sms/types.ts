export interface IsendproSmsAdapterConfig {
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  from?: string;
  baseUrl?: string;
}

export interface IsendproSmsApiRequest {
  to: string;
  from?: string;
  text: string;
  mediaUrl?: string[];
  clientRef?: string;
}

export interface IsendproSmsApiResponse {
  id?: string;
  messageId?: string;
  status?: string;
  statusCode?: number;
  message?: string;
  error?: string;
}

export interface IsendproSmsWebhookPayload {
  messageId?: string;
  id?: string;
  status?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
