import type {
  Channel,
  DlqReplayRequest,
  DlqReplayResult,
  LiveTelemetrySnapshot,
  MessageDetailDto,
  MessageStatus,
  MessageSummaryDto,
  PolicyDto,
  ProviderHealthDto,
  SuppressionDto,
  SuppressionReason,
} from '@convey/shared';
import ky from 'ky';

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

export interface CanaryProbeResult {
  providerId: string;
  timestamp: string;
  result: {
    healthy: boolean;
    latencyMs?: number;
    status?: string;
  };
}

export interface TestMessageResult {
  publicId: string;
  status: string;
  channel: Channel;
  recipient: string;
  acceptedAt: string;
  simulatedLatencyMs: number;
  receiptUrl: string;
}

// Configured Ky instance with prefix, retries, and timeout
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
});

export const api = {
  async getOverview(): Promise<OverviewData> {
    return httpClient.get('overview').json<OverviewData>();
  },

  async getLiveTelemetry(): Promise<LiveTelemetrySnapshot> {
    return httpClient.get('telemetry/live').json<LiveTelemetrySnapshot>();
  },

  async getMessages(params?: {
    page?: number;
    limit?: number;
    teamId?: string;
    channel?: Channel;
    status?: MessageStatus;
    search?: string;
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
};
