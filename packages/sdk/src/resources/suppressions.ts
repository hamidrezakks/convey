/**
 * @convey/sdk - Suppressions Resource Client
 * Manage bounce, complaint, unsubscribe, and manual recipient suppression rules with auto-pagination.
 */

import type { HttpClient } from '../http';
import { AutoPaginator } from '../pagination';
import type {
  AddSuppressionRequest,
  BulkAddSuppressionsRequest,
  ListSuppressionsQuery,
  ListSuppressionsResponse,
  RequestOptions,
  SuppressionDto,
} from '../types';

export class SuppressionsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Add a single recipient to the suppression ledger.
   */
  async add(
    request: AddSuppressionRequest,
    options?: RequestOptions,
  ): Promise<{ success: boolean; suppression: SuppressionDto }> {
    const payload: Record<string, unknown> = {
      ...request,
      identifier: request.identifier || request.recipient,
      reason: request.reason || 'MANUAL_BLOCK',
    };
    delete payload.recipient;
    return this.http.request<{ success: boolean; suppression: SuppressionDto }>('/v1/suppressions', {
      method: 'POST',
      body: payload,
      ...options,
    });
  }

  /**
   * Bulk register recipient suppression records.
   */
  async addBulk(
    items: AddSuppressionRequest[] | BulkAddSuppressionsRequest,
    options?: RequestOptions,
  ): Promise<{ success: boolean; count: number; suppressions: SuppressionDto[] }> {
    const payload = Array.isArray(items) ? { items } : items;
    return this.http.request<{ success: boolean; count: number; suppressions: SuppressionDto[] }>(
      '/v1/suppressions/bulk',
      {
        method: 'POST',
        body: payload,
        ...options,
      },
    );
  }

  /**
   * Query suppressions with search, filter, and pagination parameters.
   */
  async list(query?: ListSuppressionsQuery, options?: RequestOptions): Promise<ListSuppressionsResponse> {
    const queryParams: Record<string, string | number | undefined> = {};
    if (query?.limit !== undefined) queryParams.limit = query.limit;
    if (query?.offset !== undefined) queryParams.offset = query.offset;
    if (query?.channel) queryParams.channel = String(query.channel);
    if (query?.category) queryParams.category = query.category;
    if (query?.reason) queryParams.reason = String(query.reason);
    if (query?.search) queryParams.search = query.search;

    const res = await this.http.request<{
      suppressions?: SuppressionDto[];
      items?: SuppressionDto[];
      total?: number;
      limit?: number;
      offset?: number;
    }>('/v1/suppressions', {
      method: 'GET',
      query: queryParams,
      ...options,
    });

    const items = res.suppressions || res.items || [];
    return {
      items,
      total: res.total ?? items.length,
      limit: res.limit ?? (query?.limit || 50),
      offset: res.offset ?? (query?.offset || 0),
    };
  }

  /**
   * Auto-paginating async iterator to stream through suppression records effortlessly.
   */
  listAutoPaging(
    query?: Omit<ListSuppressionsQuery, 'offset'>,
    options?: RequestOptions,
  ): AutoPaginator<SuppressionDto> {
    const limit = query?.limit || 50;
    return new AutoPaginator<SuppressionDto>(async (offset) => {
      const page = await this.list({ ...query, limit, offset }, options);
      return {
        items: page.items,
        hasMore: page.offset + page.items.length < page.total,
        nextOffset: page.offset + page.items.length,
      };
    }, limit);
  }

  /**
   * Delete / unblock a suppression record by its unique identifier.
   */
  async delete(id: string, options?: RequestOptions): Promise<{ success: boolean }> {
    return this.http.request<{ success: boolean }>(`/v1/suppressions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      ...options,
    });
  }
}
