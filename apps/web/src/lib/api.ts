import type {
  AuditLogDto,
  BudgetPolicyDto,
  CampaignDetailDto,
  CampaignsReportResponse,
  CarrierCostEvaluationResult,
  CarrierRateCardDto,
  CategoriesReportResponse,
  Channel,
  ConfiguredProviderDto,
  CreateTemplateRequest,
  CreateTemplateVersionRequest,
  DlqReplayRequest,
  DlqReplayResult,
  InAppFeedResponse,
  InAppNotificationDto,
  LiveTelemetrySnapshot,
  MessageDetailDto,
  MessageStatus,
  MessageSummaryDto,
  PolicyDto,
  PreferenceCheckResult,
  ProviderCatalogItem,
  ProviderHealthDto,
  ProviderProxyConfig,
  ProxyDiagnosticResult,
  RecipientPreferencesDto,
  RegisterProviderRequest,
  RenderTemplateRequest,
  RenderTemplateResponse,
  ReportingOverviewResponse,
  SubscriptionTopicDto,
  SuppressionDto,
  SuppressionReason,
  TeamsReportResponse,
  TemplateDto,
  TemplatePartialDto,
  TemplateVersionDto,
  TenantQuotaDto,
  TestConnectionResult,
  WebhookSubscriptionDto,
} from '@convey/shared';
import { getStoredEnvironment } from '../mode/EnvironmentContext';
import { coreApiPrefix, coreClient, createApiClient, pluginClient } from './http';

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
    p50Ms: number | null;
    p95Ms: number | null;
    p99Ms: number | null;
    slaThresholdMs: number;
  };
  queues: {
    outboxRelay: number;
    messageDispatch: number | null;
    providerSend: number | null;
    scheduledPromoter: number | null;
    customerWebhook: number | null;
    activeWorkers: number;
  };
  runtime: {
    heapUsedMb: number;
    heapTotalMb: number;
    heapSaturationPercent: number;
    eventLoopLagMs: number | null;
  };
  whatsappCostSavings: {
    templateConvertedToSessionCount: number | null;
    estimatedUsdSaved: number | null;
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

export const httpClient = createApiClient(`${coreApiPrefix}/admin`);

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

  async getBudgetHolds(team: string) {
    return httpClient.get(`budgets/${encodeURIComponent(team)}/holds`).json<
      Array<{
        id: string;
        messageId: string;
        providerId: string;
        amount: string;
        currency: string;
        createdAt: string;
        stale: boolean;
      }>
    >();
  },
  async reconcileBudgetHold(team: string, id: string, outcome: 'committed' | 'released', reason: string) {
    return httpClient
      .post(`budgets/${encodeURIComponent(team)}/holds/${encodeURIComponent(id)}/reconcile`, {
        json: { outcome, reason },
      })
      .json();
  },
  async getBudget(team: string): Promise<BudgetPolicyDto | null> {
    return httpClient.get(`budgets/${encodeURIComponent(team)}`).json<BudgetPolicyDto | null>();
  },
  async saveBudget(
    team: string,
    input: { monthlyBudget: number; currency: string; hardStop: boolean },
  ): Promise<BudgetPolicyDto> {
    return httpClient.put(`budgets/${encodeURIComponent(team)}`, { json: input }).json<BudgetPolicyDto>();
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

  async testProviderConnection(
    providerId: string,
    credentials: Record<string, string>,
    config?: Record<string, unknown>,
  ): Promise<TestConnectionResult> {
    return httpClient
      .post('providers/test-connection', { json: { providerId, credentials, config } })
      .json<TestConnectionResult>();
  },

  async testProxyConnection(proxy: ProviderProxyConfig): Promise<ProxyDiagnosticResult> {
    return httpClient.post('providers/test-proxy', { json: { proxy } }).json<ProxyDiagnosticResult>();
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

    return httpClient.get('dlq', { prefix: coreApiPrefix, searchParams }).json<DlqListResponse>();
  },

  // --- Webhook Subscriptions ---
  async getWebhookSubscriptions(): Promise<{ subscriptions: WebhookSubscriptionDto[] }> {
    return httpClient
      .get('webhook-subscriptions', { prefix: coreApiPrefix })
      .json<{ subscriptions: WebhookSubscriptionDto[] }>();
  },

  async createWebhookSubscription(data: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<{ subscription: WebhookSubscriptionDto }> {
    return httpClient
      .post('webhook-subscriptions', { prefix: coreApiPrefix, json: data })
      .json<{ subscription: WebhookSubscriptionDto }>();
  },

  async deleteWebhookSubscription(id: string): Promise<{ success: boolean }> {
    return httpClient.delete(`webhook-subscriptions/${id}`, { prefix: coreApiPrefix }).json<{ success: boolean }>();
  },

  // --- Multi-Dimension Analytics & Delivery Reporting ---
  async getReportingOverview(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    category?: string;
    campaignId?: string;
    isSandbox?: boolean;
  }): Promise<ReportingOverviewResponse> {
    const searchParams: Record<string, string> = {};
    if (params?.startDate) searchParams.startDate = params.startDate;
    if (params?.endDate) searchParams.endDate = params.endDate;
    if (params?.teamId) searchParams.teamId = params.teamId;
    if (params?.category) searchParams.category = params.category;
    if (params?.campaignId) searchParams.campaignId = params.campaignId;
    if (typeof params?.isSandbox === 'boolean') searchParams.isSandbox = String(params.isSandbox);

    return httpClient.get('reports/overview', { searchParams }).json<ReportingOverviewResponse>();
  },

  async getTeamReports(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    isSandbox?: boolean;
  }): Promise<TeamsReportResponse> {
    const searchParams: Record<string, string> = {};
    if (params?.startDate) searchParams.startDate = params.startDate;
    if (params?.endDate) searchParams.endDate = params.endDate;
    if (params?.teamId) searchParams.teamId = params.teamId;
    if (typeof params?.isSandbox === 'boolean') searchParams.isSandbox = String(params.isSandbox);

    return httpClient.get('reports/teams', { searchParams }).json<TeamsReportResponse>();
  },

  async getCategoryReports(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    category?: string;
    isSandbox?: boolean;
  }): Promise<CategoriesReportResponse> {
    const searchParams: Record<string, string> = {};
    if (params?.startDate) searchParams.startDate = params.startDate;
    if (params?.endDate) searchParams.endDate = params.endDate;
    if (params?.teamId) searchParams.teamId = params.teamId;
    if (params?.category) searchParams.category = params.category;
    if (typeof params?.isSandbox === 'boolean') searchParams.isSandbox = String(params.isSandbox);

    return httpClient.get('reports/categories', { searchParams }).json<CategoriesReportResponse>();
  },

  async getCampaignReports(params?: {
    search?: string;
    teamId?: string;
    category?: string;
    campaignId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    isSandbox?: boolean;
  }): Promise<CampaignsReportResponse> {
    const searchParams: Record<string, string | number> = {};
    if (params?.search) searchParams.search = params.search;
    if (params?.teamId) searchParams.teamId = params.teamId;
    if (params?.category) searchParams.category = params.category;
    if (params?.campaignId) searchParams.campaignId = params.campaignId;
    if (params?.startDate) searchParams.startDate = params.startDate;
    if (params?.endDate) searchParams.endDate = params.endDate;
    if (params?.page) searchParams.page = params.page;
    if (params?.limit) searchParams.limit = params.limit;
    if (typeof params?.isSandbox === 'boolean') searchParams.isSandbox = String(params.isSandbox);

    return httpClient.get('reports/campaigns', { searchParams }).json<CampaignsReportResponse>();
  },

  async getCampaignDetails(campaignId: string, isSandbox?: boolean): Promise<CampaignDetailDto> {
    const searchParams: Record<string, string> = {};
    if (typeof isSandbox === 'boolean') searchParams.isSandbox = String(isSandbox);

    return httpClient
      .get(`reports/campaigns/${encodeURIComponent(campaignId)}`, { searchParams })
      .json<CampaignDetailDto>();
  },

  async downloadReport(
    type: 'teams' | 'categories' | 'campaigns' | 'overview',
    format: 'csv' | 'json',
    params?: {
      startDate?: string;
      endDate?: string;
      teamId?: string;
      category?: string;
      campaignId?: string;
      isSandbox?: boolean;
    },
  ): Promise<void> {
    const searchParams: Record<string, string> = { type, format };
    if (params?.startDate) searchParams.startDate = params.startDate;
    if (params?.endDate) searchParams.endDate = params.endDate;
    if (params?.teamId) searchParams.teamId = params.teamId;
    if (params?.category) searchParams.category = params.category;
    if (params?.campaignId) searchParams.campaignId = params.campaignId;
    if (typeof params?.isSandbox === 'boolean') searchParams.isSandbox = String(params.isSandbox);

    const response = await httpClient.get('reports/export', { searchParams });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convey_report_${type}_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async reconcileReportBuckets(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    category?: string;
    campaignId?: string;
  }): Promise<{
    status: string;
    bucketsReconciled: number;
    campaignBucketsReconciled: number;
    driftHealedCount: number;
    durationMs: number;
    repairedAt: string;
  }> {
    const result = await httpClient.post('reports/reconcile', { json: params || {} }).json<{
      status: string;
      bucketsReconciled: number;
      campaignBucketsReconciled: number;
      driftHealedCount: number;
      durationMs: number;
      repairedAt: string;
    }>();
    return result;
  },

  // --- Templates API ---
  async listTemplates(environment = getStoredEnvironment()): Promise<{ success: boolean; templates: TemplateDto[] }> {
    const raw = coreClient;
    return raw
      .get('templates', { searchParams: { environment } })
      .json<{ success: boolean; templates: TemplateDto[] }>();
  },

  async getTemplate(
    slug: string,
  ): Promise<{ success: boolean; template: TemplateDto; versions: TemplateVersionDto[] }> {
    const raw = coreClient;
    return raw
      .get(`templates/${slug}`)
      .json<{ success: boolean; template: TemplateDto; versions: TemplateVersionDto[] }>();
  },

  async createTemplate(request: CreateTemplateRequest): Promise<{ success: boolean; template: TemplateDto }> {
    const raw = coreClient;
    return raw.post('templates', { json: request }).json<{ success: boolean; template: TemplateDto }>();
  },

  async createTemplateVersion(
    slug: string,
    request: CreateTemplateVersionRequest,
  ): Promise<{ success: boolean; version: TemplateVersionDto }> {
    const raw = coreClient;
    return raw
      .post(`templates/${slug}/versions`, { json: request })
      .json<{ success: boolean; version: TemplateVersionDto }>();
  },

  async publishTemplateVersion(slug: string, version: string): Promise<{ success: boolean; template: TemplateDto }> {
    const raw = coreClient;
    return raw
      .post(`templates/${slug}/publish`, { json: { version } })
      .json<{ success: boolean; template: TemplateDto }>();
  },

  async renderTemplate(
    request: RenderTemplateRequest,
  ): Promise<{ success: boolean; rendered: RenderTemplateResponse }> {
    const raw = coreClient;
    return raw
      .post('templates/render', { json: request })
      .json<{ success: boolean; rendered: RenderTemplateResponse }>();
  },

  async listTemplatePartials(): Promise<{ success: boolean; partials: TemplatePartialDto[] }> {
    const raw = coreClient;
    return raw.get('templates/partials').json<{ success: boolean; partials: TemplatePartialDto[] }>();
  },

  // --- FinOps Carrier Rates & Quota ---
  async getCarrierRates(
    recipient?: string,
    channel?: Channel,
  ): Promise<{ rateCards: CarrierRateCardDto[]; evaluation: CarrierCostEvaluationResult | null }> {
    const searchParams: Record<string, string> = {};
    if (recipient) searchParams.recipient = recipient;
    if (channel) searchParams.channel = channel;
    return httpClient
      .get('carrier-rates', { searchParams })
      .json<{ rateCards: CarrierRateCardDto[]; evaluation: CarrierCostEvaluationResult | null }>();
  },

  async getQuotaStatus(plan = 'pro'): Promise<TenantQuotaDto> {
    return httpClient.get('quota', { searchParams: { plan } }).json<TenantQuotaDto>();
  },

  // --- Plugins Preferences ---
  async listTopics(tenantId: string, team: string): Promise<{ success: boolean; topics: SubscriptionTopicDto[] }> {
    return pluginClient
      .get('preferences/topics', { searchParams: { tenantId, team } })
      .json<{ success: boolean; topics: SubscriptionTopicDto[] }>();
  },

  async createTopic(data: {
    tenantId: string;
    team: string;
    key: string;
    name: string;
    description?: string;
    isMandatory?: boolean;
  }): Promise<{ success: boolean; topic: SubscriptionTopicDto }> {
    return pluginClient
      .post('preferences/topics', { json: data })
      .json<{ success: boolean; topic: SubscriptionTopicDto }>();
  },

  async getRecipientPreferences(
    tenantId: string,
    recipientId: string,
  ): Promise<{ success: boolean; preferences: RecipientPreferencesDto }> {
    return pluginClient
      .get(`preferences/${recipientId}`, { searchParams: { tenantId } })
      .json<{ success: boolean; preferences: RecipientPreferencesDto }>();
  },

  async checkPreference(data: {
    tenantId: string;
    recipientId: string;
    channel: string;
    topicKey?: string;
  }): Promise<{ success: boolean } & PreferenceCheckResult> {
    return pluginClient.post('preferences/check', { json: data }).json<{ success: boolean } & PreferenceCheckResult>();
  },

  // --- Plugins Inbox ---
  async getInboxFeed(
    tenantId: string,
    recipientId: string,
    options?: { unreadOnly?: boolean; page?: number; limit?: number },
  ): Promise<{ success: boolean } & InAppFeedResponse> {
    const searchParams: Record<string, string | number | boolean> = { tenantId, ...(options || {}) };
    return pluginClient.get(`inbox/${recipientId}`, { searchParams }).json<{ success: boolean } & InAppFeedResponse>();
  },

  async createInAppNotification(data: {
    tenantId: string;
    team: string;
    recipientId: string;
    title: string;
    body: string;
    ctaUrl?: string;
    category?: string;
  }): Promise<{ success: boolean; notification: InAppNotificationDto }> {
    return pluginClient.post('inbox', { json: data }).json<{ success: boolean; notification: InAppNotificationDto }>();
  },

  async markInAppRead(
    tenantId: string,
    recipientId: string,
    notificationIds: string[],
  ): Promise<{ success: boolean; updatedCount: number }> {
    return pluginClient
      .patch(`inbox/${recipientId}/read`, { json: { tenantId, notificationIds } })
      .json<{ success: boolean; updatedCount: number }>();
  },
};
