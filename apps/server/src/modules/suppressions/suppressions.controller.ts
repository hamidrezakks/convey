import { Elysia, t } from 'elysia';
import { CommonHeaders, StandardResponseExamples, StandardSecurityRequirement } from '../../openapi/openapi.docs';
import { authMiddleware } from '../auth/auth.middleware';
import { SuppressionsService } from './suppressions.service';

export const suppressionsController = new Elysia({ prefix: '/v1/suppressions' })
  .use(authMiddleware)
  .post(
    '/bulk',
    {
      body: t.Object({
        items: t.Array(
          t.Object({
            identifier: t.String({ description: 'Normalized email or phone address' }),
            identifierType: t.Optional(
              t.String({ description: 'Identifier category (email, phone, whatsapp, push, user_id)' }),
            ),
            reason: t.String({
              description: 'Suppression reason code (e.g. HARD_BOUNCE, SPAM_COMPLAINT, UNSUBSCRIBE, MANUAL_BLOCK)',
            }),
            category: t.Optional(t.String()),
            country: t.Optional(t.String()),
            channel: t.Optional(t.String()),
            startsAt: t.Optional(t.String()),
            endsAt: t.Optional(t.String()),
          }),
        ),
      }),
      detail: {
        tags: ['Suppressions'],
        summary: 'Bulk Add Compliance Suppressions',
        description: 'Bulk inserts recipient suppression records to block future dispatches across specified channels.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              examples: {
                bulk_suppress: {
                  summary: 'Bulk Add Bounces & Unsubscribes',
                  value: {
                    items: [
                      {
                        identifier: 'bounced_user@example.com',
                        identifierType: 'email',
                        reason: 'HARD_BOUNCE',
                        channel: 'email',
                      },
                      { identifier: '+14155550199', identifierType: 'phone', reason: 'UNSUBSCRIBE', channel: 'sms' },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Bulk suppression creation summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 2 },
                    suppressions: { type: 'array', items: { $ref: '#/components/schemas/SuppressionRecord' } },
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
      const parsedItems = body.items.map((item) => ({
        ...item,
        startsAt: item.startsAt ? new Date(item.startsAt) : undefined,
        endsAt: item.endsAt ? new Date(item.endsAt) : undefined,
      }));

      const suppressions = await SuppressionsService.bulkAddSuppressions(auth.team, parsedItems);

      return {
        success: true,
        count: suppressions.length,
        suppressions,
      };
    },
  )
  .post(
    '/',
    {
      body: t.Object({
        identifier: t.String({ description: 'Normalized recipient address (email or E.164 phone)' }),
        identifierType: t.Optional(
          t.String({ description: 'Identifier category (email, phone, whatsapp, push, user_id)' }),
        ),
        reason: t.String({
          description: 'Suppression reason code (e.g. HARD_BOUNCE, SPAM_COMPLAINT, UNSUBSCRIBE, MANUAL_BLOCK)',
        }),
        category: t.Optional(t.String()),
        country: t.Optional(t.String()),
        channel: t.Optional(t.String()),
        startsAt: t.Optional(t.String()),
        endsAt: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Suppressions'],
        summary: 'Add Single Recipient Suppression',
        description:
          'Records an individual suppression entry to protect sender reputation and enforce GDPR/CAN-SPAM compliance.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              examples: {
                single_unsubscribe: {
                  summary: 'Add Unsubscribe Entry',
                  value: {
                    identifier: 'unsubscribed_customer@example.com',
                    identifierType: 'email',
                    reason: 'UNSUBSCRIBE',
                    channel: 'email',
                    category: 'marketing',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Suppression record successfully created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    suppression: { $ref: '#/components/schemas/SuppressionRecord' },
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
      const supp = await SuppressionsService.addSuppression({
        team: auth.team,
        identifier: body.identifier,
        identifierType: body.identifierType,
        reason: body.reason,
        category: body.category,
        country: body.country,
        channel: body.channel,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      });

      return {
        success: true,
        suppression: supp,
      };
    },
  )
  .get(
    '/',
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        channel: t.Optional(t.String()),
        category: t.Optional(t.String()),
        reason: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Suppressions'],
        summary: 'List Suppressions for Team',
        description: 'Queries active suppressions with multi-field search and pagination filters.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        parameters: [
          { name: 'channel', in: 'query', required: false, schema: { type: 'string', example: 'email' } },
          { name: 'reason', in: 'query', required: false, schema: { type: 'string', example: 'UNSUBSCRIBE' } },
          { name: 'search', in: 'query', required: false, schema: { type: 'string', example: 'user@example.com' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': {
            description: 'List of suppression records matching filter criteria',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer', example: 1 },
                    suppressions: { type: 'array', items: { $ref: '#/components/schemas/SuppressionRecord' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    async ({ query, auth }) => {
      const result = await SuppressionsService.listSuppressions({
        team: auth.team,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        offset: query.offset ? Number.parseInt(query.offset, 10) : undefined,
        channel: query.channel,
        category: query.category,
        reason: query.reason,
        search: query.search,
      });

      return result;
    },
  )
  .delete(
    '/:id',
    {
      params: t.Object({
        id: t.String({ description: 'Suppression record identifier' }),
      }),
      detail: {
        tags: ['Suppressions'],
        summary: 'Remove Suppression Record',
        description: 'Permanently removes a recipient suppression record to allow message delivery to resume.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        responses: {
          '200': {
            description: 'Suppression record successfully deleted',
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
            description: 'Suppression Record Not Found',
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
      const deleted = await SuppressionsService.deleteSuppression(auth.team, params.id);
      if (!deleted) {
        set.status = 404;
        return { error: 'Suppression record not found' };
      }
      return { success: true };
    },
  );
