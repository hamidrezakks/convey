export interface MsTeamsAdapterConfig {
  webhookUrl?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  teamId?: string;
  channelId?: string;
}

export interface MsTeamsApiRequest {
  type?: string;
  summary?: string;
  themeColor?: string;
  title?: string;
  text?: string;
  body?: {
    contentType?: string;
    content?: string;
  };
  sections?: Array<{
    activityTitle?: string;
    activitySubtitle?: string;
    activityImage?: string;
    text?: string;
  }>;
}

export interface MsTeamsApiResponse {
  id?: string;
  createdDateTime?: string;
  status?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface MsTeamsWebhookPayload {
  id?: string;
  status?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
