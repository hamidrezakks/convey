export interface OpsgenieToolAdapterConfig {
  apiKey?: string;
  region?: 'us' | 'eu' | string;
  webhookUrl?: string;
}

export interface OpsgenieApiCreateAlertPayload {
  message: string;
  alias?: string;
  description?: string;
  responders?: Array<{ id?: string; name?: string; type: 'team' | 'user' | 'escalation' | 'schedule' }>;
  tags?: string[];
  entity?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  details?: Record<string, unknown>;
  note?: string;
  source?: string;
}

export interface OpsgenieApiResponse {
  result?: string;
  took?: number;
  requestId?: string;
  message?: string;
  code?: string;
}

export interface OpsgenieWebhookPayload {
  action?: string;
  alert?: {
    alertId?: string;
    message?: string;
  };
}
