export interface RocketChatAdapterConfig {
  token?: string;
  user?: string;
  userId?: string;
  serverUrl?: string;
  channel?: string;
}

export interface RocketChatApiRequest {
  roomId?: string;
  channel?: string;
  text: string;
  alias?: string;
  emoji?: string;
  avatar?: string;
  attachments?: Array<{
    title?: string;
    title_link?: string;
    text?: string;
    image_url?: string;
    color?: string;
  }>;
}

export interface RocketChatApiResponse {
  success?: boolean;
  message?: {
    _id?: string;
    rid?: string;
    msg?: string;
    ts?: string;
  };
  error?: string;
}

export interface RocketChatWebhookPayload {
  message_id?: string;
  _id?: string;
  status?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
