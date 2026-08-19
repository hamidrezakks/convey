import type {
  AuditLogDto,
  Channel,
  ConfiguredProviderDto,
  DlqReplayRequest,
  DlqReplayResult,
  LiveTelemetrySnapshot,
  MessageDetailDto,
  MessageStatus,
  MessageSummaryDto,
  PolicyDto,
  ProviderCatalogItem,
  ProviderHealthDto,
  RegisterProviderRequest,
  SuppressionDto,
  SuppressionReason,
  TestConnectionResult,
  WebhookSubscriptionDto,
} from '@convey/shared';
import ky from 'ky';
import { getStoredEnvironment } from '../mode/EnvironmentContext';

export interface OverviewData {
  status: string;
  uptimeSeconds: number;
  deliverySuccessRatePercent: number;
  metrics24h: {
    totalIngested: number;
    delivered: number;
    failed: number;
    dlqPending: number;
    activeSuppressions: number;
  };
  latencyPercentiles: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    slaThresholdMs: number;
  };
  queues: {
    outboxRelay: number;
    messageDispatch: number;
    providerSend: number;
    scheduledPromoter: number;
    customerWebhook: number;
    activeWorkers: number;
  };
  runtime: {
    heapUsedMb: number;
    heapTotalMb: number;
    heapSaturationPercent: number;
    eventLoopLagMs: number;
  };
  whatsappCostSavings: {
    templateConvertedToSessionCount: number;
    estimatedUsdSaved: number;
  };
}

export interface MessagesResponse {
  messages: MessageSummaryDto[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogsResponse {
  logs: AuditLogDto[];
  total: number;
  page: number;
  limit: number;
}

export interface DlqMessageItem {
  id: string;
  messageId: string;
  channel: string;
  errorCategory: string;
  errorCode?: string;
  errorMessage?: string;
  recipient?: string;
  team?: string;
  createdAt: string;
}

export interface DlqListResponse {
  items: DlqMessageItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CanaryProbeResult {
  providerId: string;
  timestamp: string;
  result: {
    success: boolean;
    latencyMs: number;
    message: string;
  };
}

export interface TestMessageResult {
  publicId: string;
  status: string;
  channel: Channel;
  recipient: string;
  isSandbox?: boolean;
  acceptedAt: string;
  simulatedLatencyMs: number;
  receiptUrl: string;
}

// Configured Ky instance with prefix, retries, timeout, and environment headers
export const httpClient = ky.create({
  prefix: '/v1/admin',
  timeout: 20000,
  retry: {
    limit: 2,
    methods: ['get', 'put', 'head', 'delete', 'options'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  headers: {
    Accept: 'application/json',
  },
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const activeEnv = getStoredEnvironment();
        if (activeEnv === 'sandbox') {
          request.headers.set('x-convey-sandbox', 'true');
        }
        request.headers.set('x-convey-environment', activeEnv);
      },
    ],
  },
});

export const api = {
  async getOverview(isSandbox?: boolean): Promise<OverviewData> {
    const searchParams: Record<string, string> = {};
    if (typeof isSandbox === 'boolean') searchParams.isSandbox = String(isSandbox);
    return httpClient.get('overview', { searchParams }).json<OverviewData>();
  },

  async getLiveTelemetry(isSandbox?: boolean): Promise<LiveTelemetrySnapshot> {
    const searchParams: Record<string, string> = {};
    if (typeof isSandbox === 'boolean') searchParams.isSandbox = String(isSandbox);
    return httpClient.get('telemetry/live', { searchParams }).json<LiveTelemetrySnapshot>();
  },

  async getMessages(params?: {
    page?: number;
    limit?: number;
    teamId?: string;
    channel?: Channel;
    status?: MessageStatus;
    search?: string;
    isSandbox?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<MessagesResponse> {
    const searchParams: Record<string, string | number> = {};
    if (params?.page) searchParams.page = params.page;
    if (params?.limit) searchParams.limit = params.limit;
    if (params?.teamId) searchParams.teamId = params.teamId;
    if (params?.channel) searchParams.channel = params.channel;
    if (params?.status) searchParams.status = params.status;
    if (params?.search) searchParams.search = params.search;
    if (typeof params?.isSandbox === 'boolean') searchParams.isSandbox = String(params.isSandbox);
    if (params?.startDate) searchParams.startDate = params.startDate;
    if (params?.endDate) searchParams.endDate = params.endDate;

    return httpClient.get('messages', { searchParams }).json<MessagesResponse>();
  },

  async getMessageDetails(id: string): Promise<MessageDetailDto> {
    return httpClient.get(`messages/${id}`).json<MessageDetailDto>();
  },

  async getProviders(): Promise<ProviderHealthDto[]> {
    return httpClient.get('providers').json<ProviderHealthDto[]>();
  },

  async setProviderCircuit(
    providerId: string,
    action: 'CLOSE' | 'FORCE_OPEN' | 'FORCE_HALF_OPEN',
    rampPercentage = 20,
  ): Promise<{ providerId: string; action: string; rampPercentage: number; state: string; updatedAt: string }> {
    return httpClient
      .post(`providers/${providerId}/circuit`, {
        json: { action, rampPercentage },
      })
      .json();
  },

  async triggerCanary(providerId: string): Promise<CanaryProbeResult> {
    return httpClient.post(`providers/${providerId}/canary`).json<CanaryProbeResult>();
  },

  async replayDlq(request: DlqReplayRequest): Promise<DlqReplayResult> {
    return httpClient.post('dlq/replay', { json: request }).json<DlqReplayResult>();
  },

  async getSuppressions(search?: string): Promise<SuppressionDto[]> {
    const searchParams: Record<string, string> = {};
    if (search) searchParams.search = search;
    return httpClient.get('suppressions', { searchParams }).json<SuppressionDto[]>();
  },

  async addSuppression(data: {
    teamId?: string;
    recipient: string;
    channel: Channel;
    reason: SuppressionReason;
  }): Promise<SuppressionDto> {
    return httpClient.post('suppressions', { json: data }).json<SuppressionDto>();
  },

  async removeSuppression(id: string): Promise<{ success: boolean; id: string }> {
    return httpClient.delete(`suppressions/${id}`).json<{ success: boolean; id: string }>();
  },

  async getPolicies(): Promise<PolicyDto[]> {
    return httpClient.get('policies').json<PolicyDto[]>();
  },

  async sendTestMessage(data: {
    channel: Channel;
    recipient: string;
    payload: Record<string, unknown>;
    teamId?: string;
  }): Promise<TestMessageResult> {
    return httpClient.post('composer/send-test', { json: data }).json<TestMessageResult>();
  },

  // --- Provider Setup & Registration Studio ---
  async getProviderCatalog(): Promise<ProviderCatalogItem[]> {
    return httpClient.get('providers/catalog').json<ProviderCatalogItem[]>();
  },

  async getConfiguredProviders(): Promise<ConfiguredProviderDto[]> {
    return httpClient.get('providers/configured').json<ConfiguredProviderDto[]>();
  },

  async registerProvider(data: RegisterProviderRequest): Promise<ConfiguredProviderDto> {
    return httpClient.post('providers/register', { json: data }).json<ConfiguredProviderDto>();
  },

  async deleteConfiguredProvider(id: string): Promise<{ success: boolean; id: string }> {
    return httpClient.delete(`providers/configured/${id}`).json<{ success: boolean; id: string }>();
  },

  async testProviderConnection(providerId: string, credentials: Record<string, string>): Promise<TestConnectionResult> {
    return httpClient
      .post('providers/test-connection', { json: { providerId, credentials } })
      .json<TestConnectionResult>();
  },

  async seedAllProviders(): Promise<{
    success: boolean;
    totalSeeded: number;
    providers: Array<{ id: string; name: string; channel: string }>;
  }> {
    return httpClient.post('providers/seed-all').json<{
      success: boolean;
      totalSeeded: number;
      providers: Array<{ id: string; name: string; channel: string }>;
    }>();
  },

  async exportEnvVariables(): Promise<{ envFileContent: string; variableCount: number; providerCount: number }> {
    return httpClient
      .get('providers/env-export')
      .json<{ envFileContent: string; variableCount: number; providerCount: number }>();
  },

  // --- Audit Logs ---
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    team?: string;
    action?: string;
  }): Promise<AuditLogsResponse> {
    const searchParams: Record<string, string | number> = {};
    if (params?.page) searchParams.page = params.page;
    if (params?.limit) searchParams.limit = params.limit;
    if (params?.tenantId) searchParams.tenantId = params.tenantId;
    if (params?.team) searchParams.team = params.team;
    if (params?.action) searchParams.action = params.action;

    return httpClient.get('audit-logs', { searchParams }).json<AuditLogsResponse>();
  },

  // --- Dead-Letter Queue (DLQ) Inspector ---
  async getDlqMessages(params?: { limit?: number; offset?: number }): Promise<DlqListResponse> {
    const searchParams: Record<string, number> = {};
    if (params?.limit) searchParams.limit = params.limit;
    if (params?.offset) searchParams.offset = params.offset;

    return httpClient.get('dlq', { prefix: '/v1', searchParams }).json<DlqListResponse>();
  },

  // --- Webhook Subscriptions ---
  async getWebhookSubscriptions(): Promise<{ subscriptions: WebhookSubscriptionDto[] }> {
    return httpClient
      .get('webhook-subscriptions', { prefix: '/v1' })
      .json<{ subscriptions: WebhookSubscriptionDto[] }>();
  },

  async createWebhookSubscription(data: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<{ subscription: WebhookSubscriptionDto }> {
    return httpClient
      .post('webhook-subscriptions', { prefix: '/v1', json: data })
      .json<{ subscription: WebhookSubscriptionDto }>();
  },

  async deleteWebhookSubscription(id: string): Promise<{ success: boolean }> {
    return httpClient.delete(`webhook-subscriptions/${id}`, { prefix: '/v1' }).json<{ success: boolean }>();
  },
};
