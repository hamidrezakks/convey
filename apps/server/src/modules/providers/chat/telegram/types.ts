export interface TelegramChatAdapterConfig {
  botToken?: string;
  chatId?: string;
}

export interface TelegramApiRequest {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown' | string;
  disable_web_page_preview?: boolean;
}

export interface TelegramApiResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat?: { id: number };
  };
  description?: string;
  error_code?: number;
}

export interface TelegramWebhookPayload {
  update_id?: number;
  message?: {
    message_id?: number;
    chat?: { id?: number };
    date?: number;
  };
  rawPayload?: unknown;
}
