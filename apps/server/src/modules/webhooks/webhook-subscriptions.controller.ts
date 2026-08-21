import { Elysia, t } from 'elysia';
import {
  CommonHeaders,
  StandardResponseExamples,
  StandardSecurityRequirement,
} from '../../openapi/openapi.docs';
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
      detail: {
        tags: ['Webhooks'],
        summary: 'Create Outgoing Customer Webhook Subscription',
        description: 'Subscribes an external endpoint to real-time message delivery lifecycle events signed with HMAC-SHA256.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              examples: {
                subscription: {
                  summary: 'Webhook Subscription Configuration',
                  value: {
                    url: 'https://api.merchant.com/webhooks/convey',
                    events: ['message.delivered', 'message.failed', 'message.opened', 'message.read'],
                    secret: 'whsec_981273918273918273',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Webhook subscription created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    subscription: { $ref: '#/components/schemas/WebhookSubscription' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: { validation_error: StandardResponseExamples.bad_request_validation },
              },
            },
          },
        },
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
        summary: 'List Outgoing Webhook Subscriptions for Team',
        description: 'Retrieves all active customer webhook endpoints configured for the authenticated tenant team.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        responses: {
          '200': {
            description: 'List of active webhook subscriptions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    subscriptions: { type: 'array', items: { $ref: '#/components/schemas/WebhookSubscription' } },
                  },
                },
              },
            },
          },
        },
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
        id: t.String({ description: 'Webhook subscription identifier' }),
      }),
      detail: {
        tags: ['Webhooks'],
        summary: 'Delete Webhook Subscription',
        description: 'Permanently removes a webhook subscription endpoint.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        responses: {
          '200': {
            description: 'Subscription successfully removed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Subscription Not Found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: { not_found: StandardResponseExamples.not_found },
              },
            },
          },
        },
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
        id: t.String({ description: 'Webhook subscription identifier' }),
      }),
      detail: {
        tags: ['Webhooks'],
        summary: 'Send Test Ping to Webhook Subscription',
        description: 'Dispatches a synthetic `ping.test` event payload to verify client endpoint connectivity and HMAC signature calculation.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        responses: {
          '200': {
            description: 'Test ping queued for dispatch',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Test event queued for delivery' },
                  },
                },
              },
            },
          },
        },
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
