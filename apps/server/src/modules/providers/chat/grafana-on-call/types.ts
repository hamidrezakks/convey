export interface GrafanaOnCallAdapterConfig {
  webhookUrl?: string;
  apiKey?: string;
  alertUid?: string;
  title?: string;
  state?: string;
}

export interface GrafanaOnCallApiRequest {
  title?: string;
  message: string;
  image_url?: string;
  link_url?: string;
  state?: string;
  alert_id?: string;
}

export interface GrafanaOnCallApiResponse {
  alert_id?: string;
  id?: string;
  status?: string;
  message?: string;
  error?: string;
}

export interface GrafanaOnCallWebhookPayload {
  alert_id?: string;
  id?: string;
  status?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
