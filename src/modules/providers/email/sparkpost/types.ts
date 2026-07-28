export interface SparkpostEmailAdapterConfig {
  apiKey?: string;
  endpoint?: string;
  from?: string;
  senderName?: string;
}

export interface SparkpostApiRecipient {
  address: {
    email: string;
    name?: string;
  };
}

export interface SparkpostApiRequest {
  options?: {
    open_tracking?: boolean;
    click_tracking?: boolean;
    transactional?: boolean;
  };
  recipients: SparkpostApiRecipient[];
  content: {
    from: {
      email: string;
      name?: string;
    };
    subject: string;
    html?: string;
    text?: string;
    reply_to?: string;
    template_id?: string;
  };
}

export interface SparkpostApiResponse {
  results?: {
    total_rejected_recipients?: number;
    total_accepted_recipients?: number;
    id?: string;
  };
  errors?: Array<{ message: string; code: string }>;
}

export interface SparkpostWebhookPayload {
  msys?: {
    message_event?: {
      type?: string;
      message_id?: string;
      rcpt_to?: string;
      timestamp?: string | number;
    };
  };
  rawPayload?: unknown;
}
