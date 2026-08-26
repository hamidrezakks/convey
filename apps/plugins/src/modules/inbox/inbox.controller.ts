import { Elysia, t } from 'elysia';
import { InboxService } from './inbox.service';

export const inboxController = new Elysia({ prefix: '/api/v1/plugins/inbox' })
  .post(
    '/',
    {
      body: t.Object({
        tenantId: t.String(),
        team: t.String(),
        recipientId: t.String(),
        title: t.String(),
        body: t.String(),
        ctaUrl: t.Optional(t.String()),
        iconUrl: t.Optional(t.String()),
        category: t.Optional(t.String()),
        data: t.Optional(t.Record(t.String(), t.Any())),
      }),
    },
    async ({ body, set }) => {
      try {
        const notification = await InboxService.createNotification(body);
        set.status = 201;
        return { success: true, notification };
      } catch (err: unknown) {
        set.status = 400;
        return { success: false, error: (err as Error).message };
      }
    },
  )
  .get(
    '/:recipientId',
    {
      params: t.Object({
        recipientId: t.String(),
      }),
      query: t.Object({
        tenantId: t.String(),
        page: t.Optional(t.Numeric({ default: 1 })),
        limit: t.Optional(t.Numeric({ default: 20 })),
        unreadOnly: t.Optional(t.Boolean({ default: false })),
      }),
    },
    async ({ params, query }) => {
      const feed = await InboxService.getFeed({
        tenantId: query.tenantId,
        recipientId: params.recipientId,
        page: query.page,
        limit: query.limit,
        unreadOnly: query.unreadOnly,
      });

      return { success: true, ...feed };
    },
  )
  .patch(
    '/:recipientId/read',
    {
      params: t.Object({
        recipientId: t.String(),
      }),
      body: t.Object({
        tenantId: t.String(),
        notificationIds: t.Array(t.String()),
      }),
    },
    async ({ params, body }) => {
      const result = await InboxService.markAsRead(body.tenantId, params.recipientId, body.notificationIds);

      return { success: true, ...result };
    },
  )
  .patch(
    '/:recipientId/read-all',
    {
      params: t.Object({
        recipientId: t.String(),
      }),
      body: t.Object({
        tenantId: t.String(),
      }),
    },
    async ({ params, body }) => {
      const result = await InboxService.markAllAsRead(body.tenantId, params.recipientId);
      return result;
    },
  )
  .patch(
    '/:recipientId/archive',
    {
      params: t.Object({
        recipientId: t.String(),
      }),
      body: t.Object({
        tenantId: t.String(),
        notificationIds: t.Array(t.String()),
      }),
    },
    async ({ params, body }) => {
      const result = await InboxService.archiveNotifications(body.tenantId, params.recipientId, body.notificationIds);

      return { success: true, ...result };
    },
  )
  .get(
    '/:recipientId/feed',
    {
      params: t.Object({
        recipientId: t.String(),
      }),
      query: t.Object({
        tenantId: t.String(),
      }),
    },
    async ({ params, query }) => {
      const initialFeed = await InboxService.getFeed({
        tenantId: query.tenantId,
        recipientId: params.recipientId,
        limit: 10,
      });

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();

          // Connected event
          controller.enqueue(
            encoder.encode(`event: connected\ndata: ${JSON.stringify({ unreadCount: initialFeed.unreadCount })}\n\n`),
          );

          // Initial items
          for (const item of initialFeed.items) {
            controller.enqueue(encoder.encode(`event: notification\ndata: ${JSON.stringify(item)}\n\n`));
          }

          const interval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`));
            } catch {
              clearInterval(interval);
            }
          }, 10000);
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    },
  );
