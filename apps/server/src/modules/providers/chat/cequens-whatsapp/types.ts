export enum CequensMessageType {
  TEXT = 'text',
  TEMPLATE = 'template',
  MEDIA = 'media',
}

export enum CequensMessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export interface CequensWhatsappAdapterConfig {
  apiKey?: string;
  senderId?: string;
  clientRef?: string;
  sessionOptimization?: {
    enabled?: boolean;
    ttlSeconds?: number;
    fallbackToTemplateIfMissingText?: boolean;
  };
}

export interface CequensWhatsappTemplateParameter {
  type: string;
  text?: string;
  image?: { link: string };
  document?: { link: string; filename?: string };
}

export interface CequensWhatsappTemplateComponent {
  type: string;
  parameters: CequensWhatsappTemplateParameter[];
}

export interface CequensWhatsappApiRequest {
  senderId?: string;
  senderName?: string;
  recipientPhone: string;
  messageType: CequensMessageType | 'text' | 'template' | 'media';
  messageText?: string;
  mediaUrl?: string;
  caption?: string;
  templateName?: string;
  templateLanguage?: string;
  text?: { body: string };
  media?: { link: string; caption?: string };
  template?: {
    name: string;
    language: string | { code: string };
    components?: CequensWhatsappTemplateComponent[];
  };
  clientRef?: string;
}

export interface CequensWhatsappApiResponse {
  replyCode?: number;
  replyMessage?: string;
  data?: {
    messageId?: string;
    id?: string;
  };
}

export interface CequensWhatsappWebhookPayload {
  messageId?: string;
  status?: string;
  direction?: CequensMessageDirection | 'inbound' | 'outbound';
  senderPhone?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
