import { Elysia, t } from 'elysia';
import { WebhookSubscriptionsDocs } from '../../openapi';
import { authMiddleware } from '../auth/auth.middleware';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';

export const webhookSubscriptionsController = new Elysia({ prefix: '/v1/webhook-subscriptions' })
  .use(authMiddleware)
  .post(
    '/',
    {
      body: t.Object({
        url: t.String({ format: 'uri', description: 'HTTPS webhook callback target URL' }),
        events: t.Array(t.String(), { description: 'Subscribed event types array' }),
        secret: t.Optional(t.String({ description: 'Optional HMAC-SHA256 signing secret' })),
      }),
      detail: WebhookSubscriptionsDocs.createSubscription,
    },
    async ({ body, auth }) => {
      const subscription = await WebhookSubscriptionsService.createSubscription({
        tenantId: auth.tenantId,
        team: auth.team,
        url: body.url,
        events: body.events,
        secret: body.secret,
      });

      return {
        success: true,
        subscription,
      };
    },
  )
  .get(
    '/',
    {
      detail: WebhookSubscriptionsDocs.listSubscriptions,
    },
    async ({ auth }) => {
      const subscriptions = await WebhookSubscriptionsService.listSubscriptions(auth.tenantId, auth.team);
      return {
        subscriptions,
      };
    },
  )
  .delete(
    '/:id',
    {
      params: t.Object({
        id: t.String({ description: 'Webhook subscription identifier' }),
      }),
      detail: WebhookSubscriptionsDocs.deleteSubscription,
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
        id: t.String({ description: 'Webhook subscription identifier' }),
      }),
      detail: WebhookSubscriptionsDocs.testSubscription,
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
