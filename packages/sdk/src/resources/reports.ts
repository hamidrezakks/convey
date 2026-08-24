/**
 * @convey/sdk - Multi-Dimension Reporting & Analytics Resource Client
 * Query channel summaries, multi-team budget ledgers, campaign funnels, and CSV exports.
 */

import type { HttpClient } from '../http';
import type {
  CampaignDetailDto,
  CampaignsReportResponse,
  CategoriesReportResponse,
  ReportingOverviewResponse,
  ReportingQueryParams,
  RequestOptions,
  TeamsReportResponse,
} from '../types';

export class ReportsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieve aggregated omnichannel delivery metrics, open rates, costs, and hourly time-series.
   */
  async getOverview(params?: ReportingQueryParams, options?: RequestOptions): Promise<ReportingOverviewResponse> {
    return this.http.request<ReportingOverviewResponse>('/v1/admin/reports/overview', {
      method: 'GET',
      query: params as Record<string, string | number | boolean | undefined>,
      ...options,
    });
  }

  /**
   * Retrieve budget utilization, delivery rates, and metrics partitioned across tenant teams.
   */
  async getTeams(
    params?: Pick<ReportingQueryParams, 'startDate' | 'endDate' | 'teamId' | 'isSandbox'>,
    options?: RequestOptions,
  ): Promise<TeamsReportResponse> {
    return this.http.request<TeamsReportResponse>('/v1/admin/reports/teams', {
      method: 'GET',
      query: params as Record<string, string | number | boolean | undefined>,
      ...options,
    });
  }

  /**
   * Retrieve communication performance metrics segmented by message category.
   */
  async getCategories(
    params?: Pick<ReportingQueryParams, 'startDate' | 'endDate' | 'teamId' | 'category' | 'isSandbox'>,
    options?: RequestOptions,
  ): Promise<CategoriesReportResponse> {
    return this.http.request<CategoriesReportResponse>('/v1/admin/reports/categories', {
      method: 'GET',
      query: params as Record<string, string | number | boolean | undefined>,
      ...options,
    });
  }

  /**
   * Retrieve campaign performance metrics with pagination.
   */
  async getCampaigns(params?: ReportingQueryParams, options?: RequestOptions): Promise<CampaignsReportResponse> {
    return this.http.request<CampaignsReportResponse>('/v1/admin/reports/campaigns', {
      method: 'GET',
      query: params as Record<string, string | number | boolean | undefined>,
      ...options,
    });
  }

  /**
   * Retrieve detailed funnel analysis, channel breakdown, and hourly timeline for a specific campaign.
   */
  async getCampaignDetails(
    campaignId: string,
    params?: Pick<ReportingQueryParams, 'isSandbox'>,
    options?: RequestOptions,
  ): Promise<CampaignDetailDto> {
    return this.http.request<CampaignDetailDto>(`/v1/admin/reports/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'GET',
      query: params as Record<string, string | number | boolean | undefined>,
      ...options,
    });
  }

  /**
   * Export raw report data in CSV or JSON format.
   */
  async export(
    type: 'teams' | 'categories' | 'campaigns' | 'overview',
    format: 'csv' | 'json' = 'csv',
    params?: ReportingQueryParams,
    options?: RequestOptions,
  ): Promise<string> {
    return this.http.request<string>('/v1/admin/reports/export', {
      method: 'GET',
      query: {
        type,
        format,
        ...params,
      },
      responseType: 'text',
      ...options,
    });
  }
}
