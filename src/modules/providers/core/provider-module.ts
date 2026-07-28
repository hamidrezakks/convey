import type { Job } from 'bullmq';
import type { AttemptOrigin } from '../../messaging/messaging.types';
import type { ProviderAdapter } from './provider-adapter';
import type { Channel, NormalizedWebhookEvent, ProviderCapabilities, ProviderSendResult } from './provider-types';

export interface ProviderSendJobData {
  publicId: string;
  channel: Channel;
  content: Record<string, unknown>;
  recipient: Record<string, unknown>;
  origin: AttemptOrigin;
  attemptNo: number;
  config?: Record<string, unknown>;
}

export interface ProviderWebhookJobData {
  providerId: string;
  payload: unknown;
  headers: Record<string, string>;
  receivedAt: string;
}

export interface ProviderWebhookHandler<TConfig = Record<string, unknown>> {
  verifySignature?(request: Request, rawBody: string, config?: TConfig): Promise<boolean>;
  parsePayload?(body: unknown, headers?: Record<string, string>): NormalizedWebhookEvent[];
  parseWebhookEvent?(params: { rawBody: unknown; headers: Record<string, string> }): {
    providerId: string;
    providerMessageId: string;
    normalizedStatus: string;
    timestamp: Date;
    rawPayload: unknown;
  } | null;
  handleHttpRequest?(req: Request): Promise<Response>;
}

export interface ProviderMockResponseParams {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
  providerMessageId: string;
}

export interface ProviderWebhookMockParams {
  eventType: 'delivered' | 'failed' | 'read' | 'clicked' | 'bounce';
  providerMessageId: string;
  recipient: string;
  errorReason?: string;
}

export interface ProviderMockHandler {
  /** Checks whether an outgoing HTTP request URL / method matches this provider */
  matchesRequest(url: string, method?: string): boolean;

  /** Constructs an authentic provider-native HTTP response */
  buildResponse(params: ProviderMockResponseParams): Response;

  /** Optional generator for realistic incoming webhook payloads */
  buildWebhookPayload?(params: ProviderWebhookMockParams): {
    payload: unknown;
    headers: Record<string, string>;
  };
}

export interface ProviderWorkerHandlers {
  processSend?(job: Job<ProviderSendJobData>): Promise<ProviderSendResult>;
  processWebhook?(job: Job<ProviderWebhookJobData>): Promise<void>;
}

export interface ProviderModule<TConfig = Record<string, unknown>, TReq = unknown, TRes = unknown> {
  readonly id: string;
  readonly channel: Channel;
  readonly capabilities: ProviderCapabilities;

  /** Returns true if required provider configuration, credentials, or environment variables exist */
  hasSetup?(config?: TConfig): boolean;

  /** Returns true if provider has valid configuration and is workable */
  isWorkable?(config?: TConfig): boolean;

  /** Core sending adapter */
  readonly adapter: ProviderAdapter<TConfig, TReq, TRes>;

  /** Co-located webhook verification & parsing handlers */
  readonly webhook?: ProviderWebhookHandler<TConfig>;

  /** Co-located BullMQ worker processors */
  readonly workers?: ProviderWorkerHandlers;

  /** Co-located provider mock request & response simulator */
  readonly mock?: ProviderMockHandler;

  /** Optional lifecycle hook when configured for a tenant or environment */
  onConfigured?(config: TConfig): Promise<void> | void;
}
