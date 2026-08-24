/**
 * @convey/sdk - Sandbox Resource Client
 * Inspect and reset messages sent during simulated zero-cost sandbox testing.
 */

import type { HttpClient } from '../http';
import type {
  ClearSandboxMessagesResponse,
  ListSandboxMessagesResponse,
  RequestOptions,
} from '../types';

export class SandboxResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all simulated messages dispatched in sandbox mode within the last 30 days.
   */
  async listMessages(options?: RequestOptions): Promise<ListSandboxMessagesResponse> {
    return this.http.request<ListSandboxMessagesResponse>('/v1/sandbox/messages', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Clear all simulated sandbox messages for the authenticated team.
   */
  async clearMessages(options?: RequestOptions): Promise<ClearSandboxMessagesResponse> {
    return this.http.request<ClearSandboxMessagesResponse>('/v1/sandbox/messages', {
      method: 'DELETE',
      ...options,
    });
  }
}
