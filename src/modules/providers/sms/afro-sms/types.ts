export interface AfroSmsSmsAdapterConfig {
  apiKey?: string;
  senderId?: string;
  from?: string;
  baseUrl?: string;
}
export type AfroSmsAdapterConfig = AfroSmsSmsAdapterConfig;

export interface AfroSmsApiRequest {
  to: string;
  message: string;
  from?: string;
  sender_id?: string;
}

export interface AfroSmsApiResponse {
  acknowledge?: 'success' | 'error';
  response?: {
    status?: string;
    message_id?: string;
  };
  message_id?: string;
  status?: string;
  error?: string;
}

export interface AfroSmsWebhookPayload {
  message_id?: string;
  status?: string;
  rawPayload?: unknown;
}
