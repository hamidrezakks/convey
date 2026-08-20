export interface GetstreamAdapterConfig {
  apiKey?: string;
  secret?: string;
  appId?: string;
  channelType?: string;
  channelId?: string;
}

export interface GetstreamApiRequest {
  message: {
    text: string;
    user_id?: string;
    attachments?: Array<{
      type?: string;
      image_url?: string;
      title?: string;
    }>;
  };
}

export interface GetstreamApiResponse {
  message?: {
    id?: string;
    text?: string;
    created_at?: string;
    user?: { id?: string };
  };
  duration?: string;
  code?: number;
  message_text?: string;
  error?: string;
}

export interface GetstreamWebhookPayload {
  type?: string;
  cid?: string;
  message?: {
    id?: string;
    text?: string;
    user?: { id?: string };
  };
  created_at?: string;
  rawPayload?: unknown;
}
