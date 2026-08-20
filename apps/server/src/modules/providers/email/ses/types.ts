export interface SesEmailAdapterConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  from?: string;
  senderName?: string;
}

export interface SesApiDestination {
  ToAddresses: string[];
  CcAddresses?: string[];
  BccAddresses?: string[];
}

export interface SesApiSimpleContent {
  Subject: { Data: string; Charset?: string };
  Body: {
    Html?: { Data: string; Charset?: string };
    Text?: { Data: string; Charset?: string };
  };
}

export interface SesApiRequest {
  FromEmailAddress: string;
  Destination: SesApiDestination;
  Content: {
    Simple: SesApiSimpleContent;
  };
}

export interface SesApiResponse {
  MessageId?: string;
  message?: string;
}

export interface SesWebhookPayload {
  notificationType?: string;
  mail?: {
    messageId?: string;
    timestamp?: string;
    destination?: string[];
  };
}
