export interface GrafanaToolAdapterConfig {
  webhookUrl?: string;
  apiToken?: string;
  alertUrl?: string;
}

export interface GrafanaApiAlertItem {
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
  dashboardURL?: string;
  panelURL?: string;
}

export interface GrafanaApiAlertPayload {
  receiver?: string;
  status: 'firing' | 'resolved';
  alerts: GrafanaApiAlertItem[];
  groupLabels?: Record<string, string>;
  commonLabels?: Record<string, string>;
  commonAnnotations?: Record<string, string>;
  externalURL?: string;
  title?: string;
  message?: string;
}

export interface GrafanaApiResponse {
  status?: string;
  message?: string;
  error?: string;
}

export interface GrafanaWebhookPayload {
  state?: string;
  title?: string;
  messageId?: string;
  ruleId?: number;
  evalMatches?: Array<{ metric: string; value: number }>;
}
