import type {
  Channel,
  CreateTemplateRequest,
  CreateTemplateVersionRequest,
  RenderTemplateRequest,
  RenderTemplateResponse,
  TemplateCategory,
  TemplateChannelConfig,
  TemplateDto,
  TemplatePartialDto,
  TemplateVersionDto,
} from '@convey/shared';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { templatePartials, templates, templateVersions } from '../../db/schema/templates';
import { generateTemplateId, generateUuidV7 } from '../../utils/id';
import { TemplateEngine } from '../messaging/template-engine';
import { I18nResolver } from './i18n-resolver';
import { MjmlCompiler } from './mjml-compiler';

export class TemplatesService {
  /**
   * Creates a new template catalog item and optional initial version.
   */
  static async createTemplate(params: {
    tenantId: string;
    team: string;
    environment?: string;
    request: CreateTemplateRequest;
    author?: string;
  }): Promise<TemplateDto> {
    const { tenantId, team, environment = 'production', request, author = 'system' } = params;

    // Check slug uniqueness within tenant and team
    const existing = await db
      .select()
      .from(templates)
      .where(and(eq(templates.tenantId, tenantId), eq(templates.team, team), eq(templates.slug, request.slug)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Template with slug "${request.slug}" already exists for team ${team}`);
    }

    const templateId = generateUuidV7();
    const publicId = generateTemplateId();
    let publishedVersionId: string | undefined;

    // 1. Insert base template record
    await db.insert(templates).values({
      id: templateId,
      publicId,
      tenantId,
      team,
      environment,
      slug: request.slug,
      name: request.name,
      description: request.description,
      category: request.category || 'transactional',
      defaultLocale: request.defaultLocale || 'en-US',
    });

    // 2. Insert initial version if provided
    let initialVersionDto: TemplateVersionDto | undefined;
    if (request.initialVersion) {
      const versionId = generateUuidV7();
      await db.insert(templateVersions).values({
        id: versionId,
        templateId,
        version: request.initialVersion.version,
        status: 'published',
        schema: request.initialVersion.schema || {},
        channels: request.initialVersion.channels,
        translations: request.initialVersion.translations || {},
        changeSummary: request.initialVersion.changeSummary || 'Initial version',
        author,
      });

      publishedVersionId = versionId;
      await db.update(templates).set({ publishedVersionId, updatedAt: new Date() }).where(eq(templates.id, templateId));

      initialVersionDto = {
        id: versionId,
        templateId,
        version: request.initialVersion.version,
        status: 'published',
        schema: request.initialVersion.schema || {},
        channels: request.initialVersion.channels,
        translations: request.initialVersion.translations || {},
        changeSummary: request.initialVersion.changeSummary || 'Initial version',
        author,
        createdAt: new Date().toISOString(),
      };
    }

    return {
      id: templateId,
      publicId,
      tenantId,
      team,
      environment,
      slug: request.slug,
      name: request.name,
      description: request.description,
      category: (request.category || 'transactional') as TemplateCategory,
      defaultLocale: request.defaultLocale || 'en-US',
      publishedVersionId,
      publishedVersion: initialVersionDto,
      versionsCount: initialVersionDto ? 1 : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Lists templates for a tenant and team.
   */
  static async listTemplates(tenantId: string, team: string, environment = 'production'): Promise<TemplateDto[]> {
    const list = await db
      .select()
      .from(templates)
      .where(and(eq(templates.tenantId, tenantId), eq(templates.team, team), eq(templates.environment, environment)))
      .orderBy(desc(templates.createdAt));

    const result: TemplateDto[] = [];

    for (const tpl of list) {
      let publishedVersion: TemplateVersionDto | undefined;
      if (tpl.publishedVersionId) {
        const [v] = await db
          .select()
          .from(templateVersions)
          .where(eq(templateVersions.id, tpl.publishedVersionId))
          .limit(1);

        if (v) {
          publishedVersion = {
            id: v.id,
            templateId: v.templateId,
            version: v.version,
            status: v.status as 'published',
            schema: (v.schema as Record<string, unknown>) || {},
            channels: v.channels as TemplateChannelConfig,
            translations: (v.translations as Record<string, Partial<TemplateChannelConfig>>) || {},
            changeSummary: v.changeSummary || undefined,
            author: v.author,
            createdAt: v.createdAt.toISOString(),
          };
        }
      }

      result.push({
        id: tpl.id,
        publicId: tpl.publicId,
        tenantId: tpl.tenantId,
        team: tpl.team,
        environment: tpl.environment,
        slug: tpl.slug,
        name: tpl.name,
        description: tpl.description || undefined,
        category: tpl.category as TemplateCategory,
        defaultLocale: tpl.defaultLocale,
        publishedVersionId: tpl.publishedVersionId || undefined,
        publishedVersion,
        createdAt: tpl.createdAt.toISOString(),
        updatedAt: tpl.updatedAt.toISOString(),
      });
    }

    return result;
  }

  /**
   * Retrieves template details including all versions.
   */
  static async getTemplateBySlug(
    tenantId: string,
    team: string,
    slug: string,
  ): Promise<{ template: TemplateDto; versions: TemplateVersionDto[] } | null> {
    const [tpl] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.tenantId, tenantId), eq(templates.team, team), eq(templates.slug, slug)))
      .limit(1);

    if (!tpl) return null;

    const versionsList = await db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.templateId, tpl.id))
      .orderBy(desc(templateVersions.createdAt));

    const versions: TemplateVersionDto[] = versionsList.map((v) => ({
      id: v.id,
      templateId: v.templateId,
      version: v.version,
      status: v.status as 'draft' | 'published' | 'archived',
      schema: (v.schema as Record<string, unknown>) || {},
      channels: v.channels as TemplateChannelConfig,
      translations: (v.translations as Record<string, Partial<TemplateChannelConfig>>) || {},
      changeSummary: v.changeSummary || undefined,
      author: v.author,
      createdAt: v.createdAt.toISOString(),
    }));

    const publishedVersion = versions.find((v) => v.id === tpl.publishedVersionId);

    const templateDto: TemplateDto = {
      id: tpl.id,
      publicId: tpl.publicId,
      tenantId: tpl.tenantId,
      team: tpl.team,
      environment: tpl.environment,
      slug: tpl.slug,
      name: tpl.name,
      description: tpl.description || undefined,
      category: tpl.category as TemplateCategory,
      defaultLocale: tpl.defaultLocale,
      publishedVersionId: tpl.publishedVersionId || undefined,
      publishedVersion,
      versionsCount: versions.length,
      createdAt: tpl.createdAt.toISOString(),
      updatedAt: tpl.updatedAt.toISOString(),
    };

    return { template: templateDto, versions };
  }

  /**
   * Creates a new version for an existing template.
   */
  static async createVersion(params: {
    tenantId: string;
    team: string;
    slug: string;
    request: CreateTemplateVersionRequest;
    author?: string;
  }): Promise<TemplateVersionDto> {
    const { tenantId, team, slug, request, author = 'system' } = params;

    const [tpl] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.tenantId, tenantId), eq(templates.team, team), eq(templates.slug, slug)))
      .limit(1);

    if (!tpl) {
      throw new Error(`Template "${slug}" not found`);
    }

    const versionId = generateUuidV7();
    const status = request.publishImmediately ? 'published' : 'draft';

    await db.insert(templateVersions).values({
      id: versionId,
      templateId: tpl.id,
      version: request.version,
      status,
      schema: request.schema || {},
      channels: request.channels,
      translations: request.translations || {},
      changeSummary: request.changeSummary || undefined,
      author,
    });

    if (request.publishImmediately) {
      await db
        .update(templates)
        .set({ publishedVersionId: versionId, updatedAt: new Date() })
        .where(eq(templates.id, tpl.id));
    }

    return {
      id: versionId,
      templateId: tpl.id,
      version: request.version,
      status,
      schema: request.schema || {},
      channels: request.channels,
      translations: request.translations || {},
      changeSummary: request.changeSummary,
      author,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Publishes a specific version of a template.
   */
  static async publishVersion(
    tenantId: string,
    team: string,
    slug: string,
    version: string,
  ): Promise<TemplateDto> {
    const details = await TemplatesService.getTemplateBySlug(tenantId, team, slug);
    if (!details) {
      throw new Error(`Template "${slug}" not found`);
    }

    const targetVersion = details.versions.find((v) => v.version === version);
    if (!targetVersion) {
      throw new Error(`Version "${version}" of template "${slug}" not found`);
    }

    await db.update(templateVersions).set({ status: 'published' }).where(eq(templateVersions.id, targetVersion.id));

    await db
      .update(templates)
      .set({ publishedVersionId: targetVersion.id, updatedAt: new Date() })
      .where(eq(templates.id, details.template.id));

    return {
      ...details.template,
      publishedVersionId: targetVersion.id,
      publishedVersion: { ...targetVersion, status: 'published' },
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Injects registered partials (e.g. `{{> brand_header }}`) into template content.
   */
  static async injectPartials(
    tenantId: string,
    team: string,
    content: string,
  ): Promise<{ content: string; resolvedPartials: string[] }> {
    if (!content?.includes('{{>')) {
      return { content, resolvedPartials: [] };
    }

    const partialsList = await db
      .select()
      .from(templatePartials)
      .where(and(eq(templatePartials.tenantId, tenantId), eq(templatePartials.team, team)));

    const partialsMap = new Map<string, string>();
    for (const p of partialsList) {
      partialsMap.set(p.name.trim(), p.content);
    }

    const resolvedPartials: string[] = [];
    const PARTIAL_REGEX = /{{>\s*([a-zA-Z0-9_-]+)\s*}}/g;

    const replaced = content.replace(PARTIAL_REGEX, (_match, partialName) => {
      const name = String(partialName).trim();
      const partialContent = partialsMap.get(name);
      if (partialContent !== undefined) {
        resolvedPartials.push(name);
        return partialContent;
      }
      return '';
    });

    return { content: replaced, resolvedPartials };
  }

  /**
   * Compiles and renders a template with variables, partials, i18n locale fallback, and MJML.
   */
  static async renderTemplate(params: {
    tenantId: string;
    team: string;
    request: RenderTemplateRequest;
  }): Promise<RenderTemplateResponse> {
    const { tenantId, team, request } = params;
    let baseConfig: TemplateChannelConfig | undefined = request.templateSpec;
    let defaultLocale = 'en-US';
    let translations: Record<string, Partial<TemplateChannelConfig>> = {};

    // 1. Fetch template from catalog if slug is provided
    if (request.templateSlug) {
      const details = await TemplatesService.getTemplateBySlug(tenantId, team, request.templateSlug);
      if (!details) {
        throw new Error(`Template "${request.templateSlug}" not found`);
      }

      defaultLocale = details.template.defaultLocale;

      let versionToUse = details.template.publishedVersion;
      if (request.version) {
        versionToUse = details.versions.find((v) => v.version === request.version);
        if (!versionToUse) {
          throw new Error(`Version "${request.version}" not found for template "${request.templateSlug}"`);
        }
      }

      if (!versionToUse) {
        throw new Error(`No published version found for template "${request.templateSlug}"`);
      }

      baseConfig = versionToUse.channels;
      translations = versionToUse.translations || {};
    }

    if (!baseConfig) {
      throw new Error('No template channel configuration provided or resolved');
    }

    // 2. Resolve localized channel configuration
    const { resolvedConfig, matchedLocale } = I18nResolver.resolveLocalizedChannelConfig(
      baseConfig,
      translations,
      request.locale,
      defaultLocale,
    );

    const channel = request.channel as Channel;
    const channelSpec = resolvedConfig[channel as keyof TemplateChannelConfig];

    if (!channelSpec) {
      throw new Error(`Template has no configuration for channel "${channel}"`);
    }

    const context: Record<string, unknown> = {
      ...(request.variables || {}),
      recipient: request.recipient || {},
    };

    let subject: string | undefined;
    let body: string | undefined;
    let html: string | undefined;
    let text: string | undefined;
    const allResolvedPartials: string[] = [];

    // 3. Render according to channel
    if (channel === 'email' && 'subject' in channelSpec) {
      const emailSpec = channelSpec as { subject: string; html?: string; text?: string; mjml?: string };
      const rawSubject = emailSpec.subject || '';
      subject = TemplateEngine.compile(rawSubject, context);

      let rawHtml = emailSpec.html || '';
      if (emailSpec.mjml) {
        // Compile MJML first, then template interpolation
        const compiledMjml = MjmlCompiler.compile(emailSpec.mjml, { title: subject });
        rawHtml = compiledMjml;
      }

      // Inject partials
      const partialResult = await TemplatesService.injectPartials(tenantId, team, rawHtml);
      allResolvedPartials.push(...partialResult.resolvedPartials);

      html = TemplateEngine.compile(partialResult.content, context);
      if (!html.includes('<!DOCTYPE html>')) {
        html = TemplateEngine.wrapHtmlEmail(html, subject);
      }

      if (emailSpec.text) {
        const textPartialResult = await TemplatesService.injectPartials(tenantId, team, emailSpec.text);
        text = TemplateEngine.compile(textPartialResult.content, context);
      }
    } else if (channel === 'sms' && 'body' in channelSpec) {
      const smsSpec = channelSpec as { body: string };
      const partialResult = await TemplatesService.injectPartials(tenantId, team, smsSpec.body);
      allResolvedPartials.push(...partialResult.resolvedPartials);
      body = TemplateEngine.compile(partialResult.content, context);
    } else if (channel === 'push' && 'title' in channelSpec) {
      const pushSpec = channelSpec as { title: string; body: string };
      subject = TemplateEngine.compile(pushSpec.title, context);
      const partialResult = await TemplatesService.injectPartials(tenantId, team, pushSpec.body);
      allResolvedPartials.push(...partialResult.resolvedPartials);
      body = TemplateEngine.compile(partialResult.content, context);
    } else if (channel === 'chat' && 'body' in channelSpec) {
      const chatSpec = channelSpec as { body: string };
      const partialResult = await TemplatesService.injectPartials(tenantId, team, chatSpec.body);
      allResolvedPartials.push(...partialResult.resolvedPartials);
      body = TemplateEngine.compile(partialResult.content, context);
    } else if (channel === 'whatsapp') {
      const waSpec = channelSpec as { body?: string; templateName?: string; parameters?: string[] };
      if (waSpec.body) {
        const partialResult = await TemplatesService.injectPartials(tenantId, team, waSpec.body);
        allResolvedPartials.push(...partialResult.resolvedPartials);
        body = TemplateEngine.compile(partialResult.content, context);
      } else {
        body = waSpec.templateName;
      }
    }

    return {
      channel,
      subject,
      body,
      html,
      text,
      localeUsed: matchedLocale,
      resolvedPartials: Array.from(new Set(allResolvedPartials)),
    };
  }

  /**
   * Partials Management.
   */
  static async createOrUpdatePartial(params: {
    tenantId: string;
    team: string;
    name: string;
    content: string;
  }): Promise<TemplatePartialDto> {
    const { tenantId, team, name, content } = params;

    const [existing] = await db
      .select()
      .from(templatePartials)
      .where(
        and(eq(templatePartials.tenantId, tenantId), eq(templatePartials.team, team), eq(templatePartials.name, name)),
      )
      .limit(1);

    if (existing) {
      await db
        .update(templatePartials)
        .set({ content, updatedAt: new Date() })
        .where(eq(templatePartials.id, existing.id));

      return {
        id: existing.id,
        tenantId,
        team,
        name,
        content,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const id = generateUuidV7();
    await db.insert(templatePartials).values({
      id,
      tenantId,
      team,
      name,
      content,
    });

    return {
      id,
      tenantId,
      team,
      name,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  static async listPartials(tenantId: string, team: string): Promise<TemplatePartialDto[]> {
    const list = await db
      .select()
      .from(templatePartials)
      .where(and(eq(templatePartials.tenantId, tenantId), eq(templatePartials.team, team)))
      .orderBy(desc(templatePartials.createdAt));

    return list.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      team: p.team,
      name: p.name,
      content: p.content,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }
}
