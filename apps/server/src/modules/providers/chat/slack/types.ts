export interface SlackChatAdapterConfig {
  webhookUrl?: string;
  botToken?: string;
  channel?: string;
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
}

export interface SlackApiRequest {
  channel?: string;
  text: string;
  blocks?: SlackBlock[];
}

export interface SlackApiResponse {
  ok?: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

export interface SlackWebhookPayload {
  ts?: string;
  channel?: string;
  rawPayload?: unknown;
}
