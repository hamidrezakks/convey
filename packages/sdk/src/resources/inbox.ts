import type { HttpClient } from '../http';
import type { InAppFeedResponse, InAppNotificationDto, RequestOptions } from '../types';

export class InboxResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create an in-app notification.
   */
  async create(
    data: {
      tenantId: string;
      team: string;
      recipientId: string;
      title: string;
      body: string;
      ctaUrl?: string;
      iconUrl?: string;
      category?: string;
      data?: Record<string, unknown>;
    },
    options?: RequestOptions,
  ): Promise<{ success: boolean; notification: InAppNotificationDto }> {
    return this.http.request<{ success: boolean; notification: InAppNotificationDto }>('/api/v1/plugins/inbox', {
      method: 'POST',
      body: data,
      ...options,
    });
  }

  /**
   * Get in-app feed with unread count.
   */
  async getFeed(
    tenantId: string,
    recipientId: string,
    params?: { unreadOnly?: boolean; page?: number; limit?: number },
    options?: RequestOptions,
  ): Promise<{ success: boolean } & InAppFeedResponse> {
    const query: Record<string, string | number | boolean> = {
      tenantId,
      ...(params || {}),
    };
    return this.http.request<{ success: boolean } & InAppFeedResponse>(
      `/api/v1/plugins/inbox/${encodeURIComponent(recipientId)}`,
      {
        method: 'GET',
        query,
        ...options,
      },
    );
  }

  /**
   * Mark notifications as read.
   */
  async markRead(
    tenantId: string,
    recipientId: string,
    notificationIds: string[],
    options?: RequestOptions,
  ): Promise<{ success: boolean; updatedCount: number }> {
    return this.http.request<{ success: boolean; updatedCount: number }>(
      `/api/v1/plugins/inbox/${encodeURIComponent(recipientId)}/read`,
      {
        method: 'PATCH',
        body: { tenantId, notificationIds },
        ...options,
      },
    );
  }

  /**
   * Mark all notifications as read.
   */
  async markAllRead(tenantId: string, recipientId: string, options?: RequestOptions): Promise<{ success: boolean }> {
    return this.http.request<{ success: boolean }>(
      `/api/v1/plugins/inbox/${encodeURIComponent(recipientId)}/read-all`,
      {
        method: 'PATCH',
        body: { tenantId },
        ...options,
      },
    );
  }

  /**
   * Archive notifications.
   */
  async archive(
    tenantId: string,
    recipientId: string,
    notificationIds: string[],
    options?: RequestOptions,
  ): Promise<{ success: boolean; archivedCount: number }> {
    return this.http.request<{ success: boolean; archivedCount: number }>(
      `/api/v1/plugins/inbox/${encodeURIComponent(recipientId)}/archive`,
      {
        method: 'PATCH',
        body: { tenantId, notificationIds },
        ...options,
      },
    );
  }
}
