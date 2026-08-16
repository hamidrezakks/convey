export interface DiscordChatAdapterConfig {
  webhookUrl?: string;
  botToken?: string;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export interface DiscordApiRequest {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

export interface DiscordApiResponse {
  id?: string;
  channel_id?: string;
  message?: string;
  code?: number;
}

export interface DiscordWebhookPayload {
  id?: string;
  channel_id?: string;
  rawPayload?: unknown;
}
