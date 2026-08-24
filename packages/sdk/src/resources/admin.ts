/**
 * @convey/sdk - Admin Studio Resource Client
 * Real-time live telemetry, provider matrix, circuit breaker cockpit, canary probes, and audit logs.
 */

import type { HttpClient } from '../http';
import { AutoPaginator } from '../pagination';
import type {
  AuditLogDto,
  Channel,
  ListAuditLogsQuery,
  ListAuditLogsResponse,
  LiveTelemetrySnapshot,
  MessageDetailDto,
  MessageStatus,
  ProviderHealthDto,
  RegisterProviderRequest,
  RequestOptions,
  TestProviderConnectionRequest,
  TestProviderConnectionResult,
} from '../types';

export interface AdminListMessagesQuery {
  page?: number;
  limit?: number;
  teamId?: string;
  channel?: Channel;
  status?: MessageStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
  isSandbox?: boolean;
}

export interface AdminListMessagesResponse {
  messages: MessageDetailDto[];
  total: number;
  page: number;
  limit: number;
}

export class AdminResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieve high-level operational overview metrics and system status.
   */
  async getOverview(options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.request<Record<string, unknown>>('/v1/admin/overview', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Retrieve a real-time live telemetry snapshot including V8 heap saturation,
   * queue depths, active workers, p95 latency, and circuit breaker statuses.
   */
  async getLiveTelemetry(options?: RequestOptions): Promise<LiveTelemetrySnapshot> {
    return this.http.request<LiveTelemetrySnapshot>('/v1/admin/telemetry/live', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Query messages across all tenants and teams with multi-parameter filtering.
   */
  async listMessages(query?: AdminListMessagesQuery, options?: RequestOptions): Promise<AdminListMessagesResponse> {
    return this.http.request<AdminListMessagesResponse>('/v1/admin/messages', {
      method: 'GET',
      query: query as Record<string, string | number | boolean | undefined>,
      ...options,
    });
  }

  /**
   * Auto-paginating async iterator to stream messages across all tenants.
   */
  listMessagesAutoPaging(
    query?: Omit<AdminListMessagesQuery, 'page'>,
    options?: RequestOptions,
  ): AutoPaginator<MessageDetailDto> {
    const limit = query?.limit || 50;
    return new AutoPaginator<MessageDetailDto>(async (_offset, page) => {
      const res = await this.listMessages({ ...query, limit, page }, options);
      return {
        items: res.messages,
        hasMore: res.page * res.limit < res.total,
        nextPage: res.page + 1,
      };
    }, limit);
  }

  /**
   * Retrieve comprehensive message details and trace span waterfall.
   */
  async getMessageDetails(id: string, options?: RequestOptions): Promise<MessageDetailDto> {
    return this.http.request<MessageDetailDto>(`/v1/admin/messages/${encodeURIComponent(id)}`, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * List all providers with circuit breaker state, rolling success rate, and latency metrics.
   */
  async listProviders(options?: RequestOptions): Promise<ProviderHealthDto[]> {
    return this.http.request<ProviderHealthDto[]>('/v1/admin/providers', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Manually override a provider's circuit breaker state or trigger stepped ramp traffic.
   */
  async setCircuitState(
    providerId: string,
    action: 'CLOSE' | 'FORCE_OPEN' | 'FORCE_HALF_OPEN',
    rampPercentage = 20,
    options?: RequestOptions,
  ): Promise<{ success: boolean; state: string; rampPercentage: number }> {
    return this.http.request<{ success: boolean; state: string; rampPercentage: number }>(
      `/v1/admin/providers/${encodeURIComponent(providerId)}/circuit`,
      {
        method: 'POST',
        body: { action, rampPercentage },
        ...options,
      },
    );
  }

  /**
   * Trigger an active synthetic canary probe to verify provider health before restoring traffic.
   */
  async triggerCanary(
    providerId: string,
    options?: RequestOptions,
  ): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    return this.http.request<{ healthy: boolean; latencyMs: number; error?: string }>(
      `/v1/admin/providers/${encodeURIComponent(providerId)}/canary`,
      {
        method: 'POST',
        ...options,
      },
    );
  }

  /**
   * Retrieve the complete catalog of 88 turnkey communication providers and their credential specs.
   */
  async getProviderCatalog(options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.request<Record<string, unknown>>('/v1/admin/providers/catalog', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * List active configured provider integrations.
   */
  async listConfiguredProviders(options?: RequestOptions): Promise<Record<string, unknown>[]> {
    return this.http.request<Record<string, unknown>[]>('/v1/admin/providers/configured', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Dynamically register or update a provider integration.
   */
  async registerProvider(
    request: RegisterProviderRequest,
    options?: RequestOptions,
  ): Promise<{ success: boolean; provider: Record<string, unknown> }> {
    return this.http.request<{ success: boolean; provider: Record<string, unknown> }>('/v1/admin/providers/register', {
      method: 'POST',
      body: request,
      ...options,
    });
  }

  /**
   * Remove a configured provider integration.
   */
  async deleteConfiguredProvider(id: string, options?: RequestOptions): Promise<{ success: boolean }> {
    return this.http.request<{ success: boolean }>(`/v1/admin/providers/configured/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      ...options,
    });
  }

  /**
   * Test live credentials and connectivity for a provider.
   */
  async testProviderConnection(
    request: TestProviderConnectionRequest,
    options?: RequestOptions,
  ): Promise<TestProviderConnectionResult> {
    return this.http.request<TestProviderConnectionResult>('/v1/admin/providers/test-connection', {
      method: 'POST',
      body: request,
      ...options,
    });
  }

  /**
   * Query the tamper-evident SHA-256 administrative audit log ledger with pagination.
   */
  async listAuditLogs(query?: ListAuditLogsQuery, options?: RequestOptions): Promise<ListAuditLogsResponse> {
    return this.http.request<ListAuditLogsResponse>('/v1/admin/audit-logs', {
      method: 'GET',
      query: query as Record<string, string | number | boolean | undefined>,
      ...options,
    });
  }

  /**
   * Auto-paginating async iterator for administrative audit logs.
   */
  listAuditLogsAutoPaging(
    query?: Omit<ListAuditLogsQuery, 'page'>,
    options?: RequestOptions,
  ): AutoPaginator<AuditLogDto> {
    const limit = query?.limit || 50;
    return new AutoPaginator<AuditLogDto>(async (_offset, page) => {
      const res = await this.listAuditLogs({ ...query, limit, page }, options);
      return {
        items: res.items,
        hasMore: res.page * res.limit < res.total,
        nextPage: res.page + 1,
      };
    }, limit);
  }

  /**
   * List rate limit, token bucket, quiet hours, and budget policies.
   */
  async listPolicies(options?: RequestOptions): Promise<Record<string, unknown>[]> {
    return this.http.request<Record<string, unknown>[]>('/v1/admin/policies', {
      method: 'GET',
      ...options,
    });
  }
}
