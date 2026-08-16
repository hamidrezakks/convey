export interface LineAdapterConfig {
  channelAccessToken?: string;
  channelSecret?: string;
}

export interface LineMessageItem {
  type: 'text' | 'image' | 'video' | 'audio';
  text?: string;
  originalContentUrl?: string;
  previewImageUrl?: string;
}

export interface LineApiRequest {
  to: string;
  messages: LineMessageItem[];
}

export interface LineApiResponse {
  sentMessages?: Array<{ id: string; quoteToken?: string }>;
  message?: string;
  details?: Array<{ message?: string }>;
}

export interface LineWebhookPayload {
  destination?: string;
  events?: Array<{
    type?: string;
    mode?: string;
    timestamp?: number;
    source?: { userId?: string; type?: string };
    webhookEventId?: string;
    deliveryContext?: { isRedelivery?: boolean };
    message?: { id?: string; type?: string; text?: string };
  }>;
  rawPayload?: unknown;
}
