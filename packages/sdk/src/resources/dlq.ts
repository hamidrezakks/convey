/**
 * @convey/sdk - Dead-Letter Queue (DLQ) Resource Client
 * Inspect failed messages, execute batch replays, and run mutated simulation dry-runs.
 */

import type { HttpClient } from '../http';
import { AutoPaginator } from '../pagination';
import type {
  DlqMutatedReplayRequest,
  DlqMutatedReplayResult,
  DlqReplayRequest,
  DlqReplayResult,
  ListDlqQuery,
  ListDlqResponse,
  MessageDetailDto,
  RequestOptions,
} from '../types';

export class DlqResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Query failed messages in the Dead-Letter Queue with pagination.
   */
  async list(query?: ListDlqQuery, options?: RequestOptions): Promise<ListDlqResponse> {
    const queryParams: Record<string, string | number | undefined> = {};
    if (query?.team) queryParams.team = query.team;
    if (query?.limit !== undefined) queryParams.limit = query.limit;
    if (query?.offset !== undefined) queryParams.offset = query.offset;

    const res = await this.http.request<{
      items?: MessageDetailDto[];
      messages?: MessageDetailDto[];
      total?: number;
      limit?: number;
      offset?: number;
    }>('/v1/dlq', {
      method: 'GET',
      query: queryParams,
      ...options,
    });

    const items = res.items || res.messages || [];
    return {
      items,
      total: res.total ?? items.length,
      limit: res.limit ?? (query?.limit || 50),
      offset: res.offset ?? (query?.offset || 0),
    };
  }

  /**
   * Auto-paginating async iterator for Dead-Letter Queue messages.
   */
  listAutoPaging(query?: Omit<ListDlqQuery, 'offset'>, options?: RequestOptions): AutoPaginator<MessageDetailDto> {
    const limit = query?.limit || 50;
    return new AutoPaginator<MessageDetailDto>(async (offset) => {
      const page = await this.list({ ...query, limit, offset }, options);
      return {
        items: page.items,
        hasMore: page.offset + page.items.length < page.total,
        nextOffset: page.offset + page.items.length,
      };
    }, limit);
  }

  /**
   * Replay failed messages through the outbox delivery pipeline.
   */
  async replay(request: DlqReplayRequest | string[], options?: RequestOptions): Promise<DlqReplayResult> {
    const payload = Array.isArray(request) ? { messageIds: request } : request;
    return this.http.request<DlqReplayResult>('/v1/dlq/replay', {
      method: 'POST',
      body: payload,
      ...options,
    });
  }

  /**
   * Run a dry-run simulation or execute a mutated DLQ replay with adjusted concurrency and backoff.
   */
  async replayMutated(request: DlqMutatedReplayRequest, options?: RequestOptions): Promise<DlqMutatedReplayResult> {
    return this.http.request<DlqMutatedReplayResult>('/v1/dlq/replay-mutated', {
      method: 'POST',
      body: request,
      ...options,
    });
  }
}
