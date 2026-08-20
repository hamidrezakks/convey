import { Elysia, t } from 'elysia';
import { authMiddleware } from '../auth/auth.middleware';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';

export const webhookSubscriptionsController = new Elysia({ prefix: '/v1/webhook-subscriptions' })
  .use(authMiddleware)
  .post(
    '/',
    {
      body: t.Object({
        url: t.String({ format: 'uri' }),
        events: t.Array(t.String()),
        secret: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Webhooks'],
        summary: 'Create outgoing webhook subscription',
      },
    },
    async ({ body, auth }) => {
      const sub = await WebhookSubscriptionsService.createSubscription({
        tenantId: auth.tenantId,
        team: auth.team,
        url: body.url,
        events: body.events,
        secret: body.secret,
      });

      return {
        success: true,
        subscription: sub,
      };
    },
  )
  .get(
    '/',
    {
      detail: {
        tags: ['Webhooks'],
        summary: 'List outgoing webhook subscriptions',
      },
    },
    async ({ auth }) => {
      const subs = await WebhookSubscriptionsService.listSubscriptions(auth.tenantId, auth.team);
      return {
        subscriptions: subs,
      };
    },
  )
  .delete(
    '/:id',
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Webhooks'],
        summary: 'Delete webhook subscription',
      },
    },
    async ({ params, auth, set }) => {
      const deleted = await WebhookSubscriptionsService.deleteSubscription(auth.tenantId, auth.team, params.id);
      if (!deleted) {
        set.status = 404;
        return { error: 'Subscription not found' };
      }
      return { success: true };
    },
  )
  .post(
    '/:id/test',
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Webhooks'],
        summary: 'Send test ping to webhook subscription',
      },
    },
    async ({ auth }) => {
      await WebhookSubscriptionsService.triggerEventForTenant(auth.tenantId, auth.team, 'ping.test', {
        test: true,
        message: 'Convey Webhook Test Ping',
      });
      return {
        success: true,
        message: 'Test event queued for delivery',
      };
    },
  );
