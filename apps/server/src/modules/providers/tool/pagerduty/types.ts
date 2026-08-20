export interface PagerdutyToolAdapterConfig {
  routingKey?: string;
}

export interface PagerdutyApiRequest {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  payload: {
    summary: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    source: string;
    custom_details?: Record<string, unknown>;
  };
  dedup_key?: string;
}

export interface PagerdutyApiResponse {
  status?: string;
  message?: string;
  dedup_key?: string;
  errors?: string[];
}

export interface PagerdutyWebhookPayload {
  event?: {
    id?: string;
    event_type?: string;
    resource_type?: string;
    occurred_at?: string;
    data?: Record<string, unknown>;
  };
}
