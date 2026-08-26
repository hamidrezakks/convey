import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { generateTemplateId, generateUuidV7 } from '../../utils/id';

export const templates = pgTable('templates', {
  id: uuid('id')
    .$defaultFn(() => generateUuidV7())
    .primaryKey(),
  publicId: text('public_id')
    .$defaultFn(() => generateTemplateId())
    .notNull()
    .unique(),
  tenantId: uuid('tenant_id').notNull(),
  team: text('team').notNull(),
  environment: text('environment').notNull().default('production'),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull().default('transactional'), // transactional | marketing | alert
  defaultLocale: text('default_locale').notNull().default('en-US'),
  publishedVersionId: uuid('published_version_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const templateVersions = pgTable('template_versions', {
  id: uuid('id')
    .$defaultFn(() => generateUuidV7())
    .primaryKey(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => templates.id, { onDelete: 'cascade' }),
  version: text('version').notNull(), // e.g. "1.0.0"
  status: text('status').notNull().default('draft'), // draft | published | archived
  schema: jsonb('schema').notNull().default({}),
  channels: jsonb('channels').notNull(),
  translations: jsonb('translations').notNull().default({}),
  changeSummary: text('change_summary'),
  author: text('author').notNull().default('system'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const templatePartials = pgTable('template_partials', {
  id: uuid('id')
    .$defaultFn(() => generateUuidV7())
    .primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  team: text('team').notNull(),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateVersion = typeof templateVersions.$inferSelect;
export type NewTemplateVersion = typeof templateVersions.$inferInsert;
export type TemplatePartial = typeof templatePartials.$inferSelect;
export type NewTemplatePartial = typeof templatePartials.$inferInsert;
