import type { InAppFeedResponse, InAppNotificationDto } from '@convey/shared';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { inAppNotifications } from '../../db/schema/in-app';
import { SseBroadcaster } from './sse-broadcaster';

export class InboxService {
  /**
   * Creates a new in-app notification and broadcasts it to active SSE streams.
   */
  static async createNotification(params: {
    tenantId: string;
    team: string;
    recipientId: string;
    title: string;
    body: string;
    ctaUrl?: string;
    iconUrl?: string;
    category?: string;
    data?: Record<string, unknown>;
  }): Promise<InAppNotificationDto> {
    const { tenantId, team, recipientId, title, body, ctaUrl, iconUrl, category = 'general', data = {} } = params;

    const id = `notif_${Bun.randomUUIDv7()}`;
    const now = new Date();

    await db.insert(inAppNotifications).values({
      id,
      tenantId,
      team,
      recipientId,
      title,
      body,
      ctaUrl,
      iconUrl,
      category,
      data,
      isRead: false,
      isArchived: false,
      createdAt: now,
    });

    const dto: InAppNotificationDto = {
      id,
      tenantId,
      team,
      recipientId,
      title,
      body,
      ctaUrl,
      iconUrl,
      category,
      data,
      isRead: false,
      isArchived: false,
      createdAt: now.toISOString(),
    };

    // Broadcast in real-time
    await SseBroadcaster.broadcastNotification(tenantId, recipientId, {
      type: 'notification.created',
      notification: dto,
    });

    return dto;
  }

  /**
   * Retrieves paginated inbox feed for a subscriber with unread count.
   */
  static async getFeed(params: {
    tenantId: string;
    recipientId: string;
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<InAppFeedResponse> {
    const { tenantId, recipientId, page = 1, limit = 20, unreadOnly = false } = params;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(inAppNotifications.tenantId, tenantId),
      eq(inAppNotifications.recipientId, recipientId),
      eq(inAppNotifications.isArchived, false),
    ];

    if (unreadOnly) {
      conditions.push(eq(inAppNotifications.isRead, false));
    }

    const items = await db
      .select()
      .from(inAppNotifications)
      .where(and(...conditions))
      .orderBy(desc(inAppNotifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Unread count
    const [unreadCountRow] = await db
      .select({ count: count() })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.tenantId, tenantId),
          eq(inAppNotifications.recipientId, recipientId),
          eq(inAppNotifications.isRead, false),
          eq(inAppNotifications.isArchived, false),
        ),
      );

    const [totalCountRow] = await db
      .select({ count: count() })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.tenantId, tenantId),
          eq(inAppNotifications.recipientId, recipientId),
          eq(inAppNotifications.isArchived, false),
        ),
      );

    return {
      unreadCount: Number(unreadCountRow?.count || 0),
      totalCount: Number(totalCountRow?.count || 0),
      items: items.map((i) => ({
        id: i.id,
        tenantId: i.tenantId,
        team: i.team,
        recipientId: i.recipientId,
        title: i.title,
        body: i.body,
        ctaUrl: i.ctaUrl || undefined,
        iconUrl: i.iconUrl || undefined,
        category: i.category,
        data: (i.data as Record<string, unknown>) || {},
        isRead: i.isRead,
        readAt: i.readAt ? i.readAt.toISOString() : undefined,
        isArchived: i.isArchived,
        archivedAt: i.archivedAt ? i.archivedAt.toISOString() : undefined,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Marks specified notifications as read.
   */
  static async markAsRead(
    tenantId: string,
    recipientId: string,
    notificationIds: string[],
  ): Promise<{ updatedCount: number }> {
    if (!notificationIds || notificationIds.length === 0) {
      return { updatedCount: 0 };
    }

    const now = new Date();
    await db
      .update(inAppNotifications)
      .set({ isRead: true, readAt: now })
      .where(
        and(
          eq(inAppNotifications.tenantId, tenantId),
          eq(inAppNotifications.recipientId, recipientId),
          inArray(inAppNotifications.id, notificationIds),
        ),
      );

    return { updatedCount: notificationIds.length };
  }

  /**
   * Marks all notifications as read for a recipient.
   */
  static async markAllAsRead(tenantId: string, recipientId: string): Promise<{ success: boolean }> {
    const now = new Date();
    await db
      .update(inAppNotifications)
      .set({ isRead: true, readAt: now })
      .where(
        and(
          eq(inAppNotifications.tenantId, tenantId),
          eq(inAppNotifications.recipientId, recipientId),
          eq(inAppNotifications.isRead, false),
        ),
      );

    return { success: true };
  }

  /**
   * Archives notifications.
   */
  static async archiveNotifications(
    tenantId: string,
    recipientId: string,
    notificationIds: string[],
  ): Promise<{ archivedCount: number }> {
    if (!notificationIds || notificationIds.length === 0) {
      return { archivedCount: 0 };
    }

    const now = new Date();
    await db
      .update(inAppNotifications)
      .set({ isArchived: true, archivedAt: now })
      .where(
        and(
          eq(inAppNotifications.tenantId, tenantId),
          eq(inAppNotifications.recipientId, recipientId),
          inArray(inAppNotifications.id, notificationIds),
        ),
      );

    return { archivedCount: notificationIds.length };
  }
}
