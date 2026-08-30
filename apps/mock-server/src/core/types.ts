export type Channel = 'email' | 'sms' | 'chat' | 'push' | 'tool';

export interface MockRequestContext {
  providerId: string;
  channel: Channel;
  url: URL;
  method: string;
  headers: Headers;
  rawBody: string;
  parsedBody: unknown;
  receivedAt: Date;
}

export interface MockResponseResult {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
  messageId?: string;
  recipient?: string;
  from?: string;
  subject?: string;
  error?: string;
  webhookPayload?: {
    eventType: 'delivered' | 'bounced' | 'failed' | 'read' | 'clicked';
    payload: unknown;
    headers: Record<string, string>;
  };
}

export interface ProviderMockHandler {
  readonly id: string;
  readonly channel: Channel;
  readonly defaultPort?: number;
  matchesRequest(req: Request, url: URL): boolean;
  handle(req: Request, ctx?: Partial<MockRequestContext>): Promise<Response>;
}

export interface RecordedRequest {
  id: string;
  providerId: string;
  channel: Channel;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  status: number;
  responseBody: unknown;
  timestamp: string;
  durationMs: number;
}
