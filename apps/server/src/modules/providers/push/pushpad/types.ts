export interface PushpadPushAdapterConfig {
  authToken?: string;
  projectId?: string;
}

export interface PushpadApiNotification {
  body: string;
  title?: string;
  target_url?: string;
  icon_url?: string;
  badge_url?: string;
  image_url?: string;
  custom_data?: Record<string, unknown>;
  uids?: string[];
  tags?: string[];
}

export type PushpadApiRequest = PushpadApiNotification;

export interface PushpadApiResponse {
  id?: number | string;
  scheduled?: number;
  send_at?: string;
  error?: string;
}

export interface PushpadWebhookPayload {
  id?: number | string;
  event?: string;
  rawPayload?: unknown;
}
