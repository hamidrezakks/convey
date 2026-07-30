export interface BrevoSmsSmsAdapterConfig {
  apiKey?: string;
  from?: string;
  sender?: string;
  baseUrl?: string;
}
export type BrevoSmsAdapterConfig = BrevoSmsSmsAdapterConfig;

export interface BrevoSmsApiRequest {
  sender: string;
  recipient: string;
  content: string;
  type?: 'transactional' | 'marketing';
  tag?: string;
  webUrl?: string;
}

export interface BrevoSmsApiResponse {
  reference?: string;
  messageId?: number | string;
  smsCount?: number;
  usedCredits?: number;
  remainingCredits?: number;
  code?: string;
  message?: string;
}

export interface BrevoSmsWebhookPayload {
  event?: string;
  phoneNumber?: string;
  messageId?: string;
  date?: string | number;
  rawPayload?: unknown;
}
