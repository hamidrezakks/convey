import type { Channel } from '@convey/shared';
import { Elysia, t } from 'elysia';
import { pluginAuth } from '../../auth';
import { PreferencesService } from './preferences.service';

export const preferencesController = new Elysia({ prefix: '/api/v1/plugins/preferences' })
  .use(pluginAuth)
  .post(
    '/topics',
    {
      body: t.Object({
        tenantId: t.String(),
        team: t.String(),
        key: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        isMandatory: t.Optional(t.Boolean({ default: false })),
        defaultChannels: t.Optional(t.Array(t.String())),
      }),
    },
    async ({ body, set }) => {
      try {
        const topic = await PreferencesService.createOrUpdateTopic({
          tenantId: body.tenantId,
          team: body.team,
          key: body.key,
          name: body.name,
          description: body.description,
          isMandatory: body.isMandatory,
          defaultChannels: body.defaultChannels as Channel[],
        });

        set.status = 201;
        return { success: true, topic };
      } catch (err: unknown) {
        set.status = 400;
        return { success: false, error: (err as Error).message };
      }
    },
  )
  .get(
    '/topics',
    {
      query: t.Object({
        tenantId: t.String(),
        team: t.String(),
      }),
    },
    async ({ query }) => {
      const topics = await PreferencesService.listTopics(query.tenantId, query.team);
      return { success: true, topics };
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
      }),
    },
    async ({ pluginIdentity, params, query, set }) => {
      const pref = await PreferencesService.getPreferences(
        query.tenantId,
        params.recipientId,
        (pluginIdentity as { team: string }).team,
      );
      if (!pref) {
        set.status = 404;
        return { success: false, error: 'Recipient preferences not found' };
      }
      return { success: true, preferences: pref };
    },
  )
  .put(
    '/:recipientId',
    {
      params: t.Object({
        recipientId: t.String(),
      }),
      body: t.Object({
        tenantId: t.String(),
        team: t.String(),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        timezone: t.Optional(t.String()),
        quietHoursStart: t.Optional(t.String()),
        quietHoursEnd: t.Optional(t.String()),
        channelPreferences: t.Optional(t.Record(t.String(), t.Boolean())),
        topicPreferences: t.Optional(t.Record(t.String(), t.Boolean())),
      }),
    },
    async ({ params, body }) => {
      const updated = await PreferencesService.upsertPreferences({
        tenantId: body.tenantId,
        team: body.team,
        recipientId: params.recipientId,
        email: body.email,
        phone: body.phone,
        timezone: body.timezone,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
        channelPreferences: body.channelPreferences as Record<Channel, boolean>,
        topicPreferences: body.topicPreferences,
      });

      return { success: true, preferences: updated };
    },
  )
  .post(
    '/check',
    {
      body: t.Object({
        tenantId: t.String(),
        recipientId: t.String(),
        channel: t.String(),
        topicKey: t.Optional(t.String()),
      }),
    },
    async ({ pluginIdentity, body }) => {
      const result = await PreferencesService.checkDispatchAllowed({
        tenantId: body.tenantId,
        recipientId: body.recipientId,
        team: (pluginIdentity as { team: string }).team,
        channel: body.channel as Channel,
        topicKey: body.topicKey,
      });

      return { success: true, ...result };
    },
  )
  .post(
    '/unsubscribe',
    {
      body: t.Object({
        token: t.String(),
        topicKey: t.Optional(t.String()),
      }),
    },
    async ({ body, set }) => {
      try {
        const result = await PreferencesService.handleUnsubscribe(body.token, body.topicKey);
        return result;
      } catch (err: unknown) {
        set.status = 400;
        return { success: false, error: (err as Error).message };
      }
    },
  )
  .get(
    '/unsubscribe',
    {
      query: t.Object({
        token: t.String(),
        topicKey: t.Optional(t.String()),
      }),
    },
    async ({ query, set }) => {
      try {
        const result = await PreferencesService.handleUnsubscribe(query.token, query.topicKey);
        return result;
      } catch (err: unknown) {
        set.status = 400;
        return { success: false, error: (err as Error).message };
      }
    },
  );
