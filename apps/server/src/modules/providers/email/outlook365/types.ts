export interface Outlook365EmailAdapterConfig {
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  fromUser?: string;
}

export interface Outlook365ApiRecipient {
  emailAddress: {
    address: string;
    name?: string;
  };
}

export interface Outlook365ApiMessage {
  subject: string;
  body: {
    contentType: 'HTML' | 'Text';
    content: string;
  };
  toRecipients: Outlook365ApiRecipient[];
  ccRecipients?: Outlook365ApiRecipient[];
  bccRecipients?: Outlook365ApiRecipient[];
  replyTo?: Outlook365ApiRecipient[];
  attachments?: Array<{
    '@odata.type': '#microsoft.graph.fileAttachment';
    name: string;
    contentType: string;
    contentBytes: string;
  }>;
}

export interface Outlook365ApiRequest {
  message: Outlook365ApiMessage;
  saveToSentItems?: boolean;
}

export interface Outlook365ApiResponse {
  id?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface Outlook365WebhookPayload {
  value?: Array<{
    subscriptionId?: string;
    clientState?: string;
    resourceData?: {
      id?: string;
    };
  }>;
  rawPayload?: unknown;
}
