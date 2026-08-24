/**
 * @convey/sdk - Batches Resource Client
 * Campaign dispatch batches, state progression, and lifecycle controls (pause/resume/cancel).
 */

import type { HttpClient } from '../http';
import type {
  BatchActionResponse,
  BatchDto,
  CreateBatchRequest,
  CreateBatchResponse,
  ListBatchesResponse,
  RequestOptions,
} from '../types';

export class BatchesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new campaign batch dispatch container.
   */
  async create(request: CreateBatchRequest, options?: RequestOptions): Promise<CreateBatchResponse> {
    return this.http.request<CreateBatchResponse>('/v1/batches', {
      method: 'POST',
      body: request,
      ...options,
    });
  }

  /**
   * List all campaign batches for the authenticated tenant team.
   */
  async list(options?: RequestOptions): Promise<ListBatchesResponse> {
    return this.http.request<ListBatchesResponse>('/v1/batches', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Retrieve status, progress counters, and metadata for a specific batch.
   */
  async get(batchId: string, options?: RequestOptions): Promise<{ success: boolean; batch: BatchDto }> {
    return this.http.request<{ success: boolean; batch: BatchDto }>(`/v1/batches/${encodeURIComponent(batchId)}`, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Pause active dispatching of an in-flight batch.
   */
  async pause(batchId: string, options?: RequestOptions): Promise<BatchActionResponse> {
    return this.http.request<BatchActionResponse>(`/v1/batches/${encodeURIComponent(batchId)}/pause`, {
      method: 'POST',
      ...options,
    });
  }

  /**
   * Resume dispatching of a previously paused batch.
   */
  async resume(batchId: string, options?: RequestOptions): Promise<BatchActionResponse> {
    return this.http.request<BatchActionResponse>(`/v1/batches/${encodeURIComponent(batchId)}/resume`, {
      method: 'POST',
      ...options,
    });
  }

  /**
   * Cancel execution of an active or paused batch.
   */
  async cancel(batchId: string, options?: RequestOptions): Promise<BatchActionResponse> {
    return this.http.request<BatchActionResponse>(`/v1/batches/${encodeURIComponent(batchId)}/cancel`, {
      method: 'POST',
      ...options,
    });
  }
}
