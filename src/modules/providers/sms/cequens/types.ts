export interface CequensSmsAdapterConfig {
  apiKey?: string;
  senderName?: string;
  from?: string;
  baseUrl?: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface CequensApiRequest {
  recipient: string;
  sender: string;
  message: string;
  clientRefId?: string;
}

export interface CequensApiResponse {
  message_id?: string;
  status?: string;
  replyCode?: number;
  replyMessage?: string;
  data?: {
    messageId?: string | number;
    smsCount?: number;
    invalidRecipients?: string[];
  };
}

export interface CequensWebhookPayload {
  message_id?: string;
  status?: string;
  recipient?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
