export enum WhatsappMessagingProduct {
  WHATSAPP = 'whatsapp',
}

export enum WhatsappRecipientType {
  INDIVIDUAL = 'individual',
}

export enum WhatsappMessageType {
  TEXT = 'text',
  TEMPLATE = 'template',
  IMAGE = 'image',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum WhatsappWebhookStatusType {
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  SENT = 'sent',
}

export interface WhatsappBusinessChatAdapterConfig {
  phoneNumberId?: string;
  accessToken?: string;
  apiVersion?: string; // Default 'v18.0'
  baseUrl?: string; // Default 'https://graph.facebook.com'
  appSecret?: string; // For HMAC-SHA256 webhook signature verification
  sessionOptimization?: {
    enabled?: boolean;
    ttlSeconds?: number;
    fallbackToTemplateIfMissingText?: boolean;
  };
}

export interface WhatsappBusinessApiRequest {
  messaging_product: WhatsappMessagingProduct | 'whatsapp';
  recipient_type?: WhatsappRecipientType | 'individual';
  to: string;
  type: WhatsappMessageType | 'text' | 'template' | 'image' | 'document' | 'audio' | 'video';
  text?: { body: string; preview_url?: boolean };
  template?: {
    name: string;
    language: { code: string };
    components?: unknown[];
  };
  image?: { link: string; caption?: string };
  document?: { link: string; caption?: string; filename?: string };
}

export interface WhatsappBusinessApiResponse {
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

export interface WhatsappBusinessWebhookPayload {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        statuses?: Array<{
          id?: string;
          status?: WhatsappWebhookStatusType | string;
          timestamp?: string;
        }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: WhatsappMessageType | string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
  rawPayload?: unknown;
}

export type WhatsappApiRequest = WhatsappBusinessApiRequest;
export type WhatsappApiResponse = WhatsappBusinessApiResponse;
export type WhatsappWebhookPayload = WhatsappBusinessWebhookPayload;
