export interface MandrillEmailAdapterConfig {
  apiKey?: string;
  from?: string;
  senderName?: string;
}

export interface MandrillApiMessage {
  html?: string;
  text?: string;
  subject?: string;
  from_email?: string;
  from_name?: string;
  to?: Array<{ email: string; name?: string; type?: 'to' | 'cc' | 'bcc' }>;
  headers?: Record<string, string>;
  important?: boolean;
  track_opens?: boolean;
  track_clicks?: boolean;
  auto_text?: boolean;
  auto_html?: boolean;
  inline_css?: boolean;
  url_strip_qs?: boolean;
  preserve_recipients?: boolean;
  view_content_link?: boolean;
  bcc_address?: string;
  tracking_domain?: string;
  signing_domain?: string;
  return_path_domain?: string;
  merge?: boolean;
  merge_language?: string;
  global_merge_vars?: Array<{ name: string; content: unknown }>;
  merge_vars?: Array<{ rcpt: string; vars: Array<{ name: string; content: unknown }> }>;
  tags?: string[];
  subaccount?: string;
  google_analytics_domains?: string[];
  google_analytics_campaign?: string;
  metadata?: Record<string, unknown>;
  attachments?: Array<{ type: string; name: string; content: string }>;
  images?: Array<{ type: string; name: string; content: string }>;
}

export interface MandrillApiRequest {
  key?: string;
  message: MandrillApiMessage;
  async?: boolean;
  ip_pool?: string;
  send_at?: string;
}

export interface MandrillApiResponseItem {
  email?: string;
  status?: 'sent' | 'queued' | 'scheduled' | 'rejected' | 'invalid';
  reject_reason?: string;
  _id?: string;
}

export type MandrillApiResponse = MandrillApiResponseItem[];

export interface MandrillWebhookPayload {
  event?: string;
  msg?: {
    _id?: string;
    email?: string;
    state?: string;
    ts?: number;
  };
  rawPayload?: unknown;
}
