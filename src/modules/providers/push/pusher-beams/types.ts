export interface PusherBeamsPushAdapterConfig {
  instanceId?: string;
  secretKey?: string;
}

export interface PusherBeamsApiNotification {
  title?: string;
  body?: string;
  sound?: string;
  badge?: number;
}

export interface PusherBeamsApiRequest {
  interests?: string[];
  users?: string[];
  apns?: {
    aps: {
      alert?: PusherBeamsApiNotification;
      badge?: number;
      sound?: string;
    };
  };
  fcm?: {
    notification?: PusherBeamsApiNotification;
    data?: Record<string, unknown>;
  };
  web?: {
    notification?: PusherBeamsApiNotification;
  };
}

export interface PusherBeamsApiResponse {
  publishId?: string;
  error?: string;
  description?: string;
}

export interface PusherBeamsWebhookPayload {
  publishId?: string;
  event?: string;
  rawPayload?: unknown;
}
