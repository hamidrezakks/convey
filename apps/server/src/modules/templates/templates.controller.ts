import type { CreateTemplateRequest, CreateTemplateVersionRequest, RenderTemplateRequest } from '@convey/shared';
import { Elysia, t } from 'elysia';
import { authMiddleware } from '../auth/auth.middleware';
import { TemplatesService } from './templates.service';

export const templatesController = new Elysia({ prefix: '/v1/templates' })
  .use(authMiddleware)
  .post(
    '/',
    {
      body: t.Object({
        slug: t.String({ description: 'Unique template slug identifier (e.g. order_shipped)' }),
        name: t.String({ description: 'Display name of the template' }),
        description: t.Optional(t.String()),
        category: t.Optional(t.Union([t.Literal('transactional'), t.Literal('marketing'), t.Literal('alert')])),
        defaultLocale: t.Optional(t.String({ default: 'en-US' })),
        initialVersion: t.Optional(
          t.Object({
            version: t.String({ description: 'Semantic version (e.g. 1.0.0)' }),
            channels: t.Record(t.String(), t.Any()),
            schema: t.Optional(t.Record(t.String(), t.Any())),
            translations: t.Optional(t.Record(t.String(), t.Any())),
            changeSummary: t.Optional(t.String()),
          }),
        ),
      }),
    },
    async ({ body, auth, set }) => {
      try {
        const template = await TemplatesService.createTemplate({
          tenantId: auth.tenantId,
          team: auth.team,
          request: body as unknown as CreateTemplateRequest,
          author: auth.team,
        });

        set.status = 201;
        return { success: true, template };
      } catch (err: unknown) {
        set.status = 400;
        return { success: false, error: (err as Error).message };
      }
    },
  )
  .get(
    '/',
    {
      query: t.Object({
        environment: t.Optional(t.String({ default: 'production' })),
      }),
    },
    async ({ query, auth }) => {
      const templates = await TemplatesService.listTemplates(
        auth.tenantId,
        auth.team,
        query.environment || 'production',
      );
      return { success: true, templates };
    },
  )
  .get(
    '/:slug',
    {
      params: t.Object({
        slug: t.String({ description: 'Template slug identifier' }),
      }),
    },
    async ({ params, auth, set }) => {
      const details = await TemplatesService.getTemplateBySlug(auth.tenantId, auth.team, params.slug);

      if (!details) {
        set.status = 404;
        return { success: false, error: `Template "${params.slug}" not found` };
      }

      return { success: true, ...details };
    },
  )
  .post(
    '/:slug/versions',
    {
      params: t.Object({
        slug: t.String({ description: 'Template slug identifier' }),
      }),
      body: t.Object({
        version: t.String({ description: 'Semantic version (e.g. 1.1.0)' }),
        channels: t.Record(t.String(), t.Any()),
        schema: t.Optional(t.Record(t.String(), t.Any())),
        translations: t.Optional(t.Record(t.String(), t.Any())),
        changeSummary: t.Optional(t.String()),
        publishImmediately: t.Optional(t.Boolean({ default: false })),
      }),
    },
    async ({ params, body, auth, set }) => {
      try {
        const version = await TemplatesService.createVersion({
          tenantId: auth.tenantId,
          team: auth.team,
          slug: params.slug,
          request: body as unknown as CreateTemplateVersionRequest,
          author: auth.team,
        });

        set.status = 201;
        return { success: true, version };
      } catch (err: unknown) {
        set.status = 400;
        return { success: false, error: (err as Error).message };
      }
    },
  )
  .post(
    '/:slug/publish',
    {
      params: t.Object({
        slug: t.String({ description: 'Template slug identifier' }),
      }),
      body: t.Object({
        version: t.String({ description: 'Target version to publish (e.g. 1.1.0)' }),
      }),
    },
    async ({ params, body, auth, set }) => {
      try {
        const template = await TemplatesService.publishVersion(auth.tenantId, auth.team, params.slug, body.version);
        return { success: true, template };
      } catch (err: unknown) {
        set.status = 400;
        return { success: false, error: (err as Error).message };
      }
    },
  )
  .post(
    '/render',
    {
      body: t.Object({
        templateSlug: t.Optional(t.String()),
        version: t.Optional(t.String()),
        templateSpec: t.Optional(t.Record(t.String(), t.Any())),
        channel: t.String(),
        variables: t.Optional(t.Record(t.String(), t.Any())),
        locale: t.Optional(t.String()),
        recipient: t.Optional(t.Record(t.String(), t.Any())),
      }),
    },
    async ({ body, auth, set }) => {
      try {
        const rendered = await TemplatesService.renderTemplate({
          tenantId: auth.tenantId,
          team: auth.team,
          request: body as unknown as RenderTemplateRequest,
        });

        return { success: true, rendered };
      } catch (err: unknown) {
        set.status = 400;
        return { success: false, error: (err as Error).message };
      }
    },
  )
  .post(
    '/partials',
    {
      body: t.Object({
        name: t.String({ description: 'Partial name (e.g. brand_footer)' }),
        content: t.String({ description: 'Partial template content' }),
      }),
    },
    async ({ body, auth, set }) => {
      try {
        const partial = await TemplatesService.createOrUpdatePartial({
          tenantId: auth.tenantId,
          team: auth.team,
          name: body.name,
          content: body.content,
        });

        set.status = 201;
        return { success: true, partial };
      } catch (err: unknown) {
        set.status = 400;
        return { success: false, error: (err as Error).message };
      }
    },
  )
  .get('/partials', async ({ auth }) => {
    const partials = await TemplatesService.listPartials(auth.tenantId, auth.team);
    return { success: true, partials };
  });
