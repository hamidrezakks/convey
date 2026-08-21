import { Elysia, t } from 'elysia';
import { SuppressionsDocs } from '../../openapi';
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
      detail: SuppressionsDocs.bulkAddSuppressions,
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
      detail: SuppressionsDocs.addSuppression,
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
      detail: SuppressionsDocs.listSuppressions,
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
      detail: SuppressionsDocs.deleteSuppression,
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
