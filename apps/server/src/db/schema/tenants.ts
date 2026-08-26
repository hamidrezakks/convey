import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { generateUuidV7 } from '../../utils/id';

export const tenants = pgTable('tenants', {
  id: uuid('id')
    .$defaultFn(() => generateUuidV7())
    .primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: uuid('id')
    .$defaultFn(() => generateUuidV7())
    .primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  tier: text('tier').notNull().default('PRO'), // FREE | PRO | ENTERPRISE
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable('projects', {
  id: uuid('id')
    .$defaultFn(() => generateUuidV7())
    .primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const environments = pgTable('environments', {
  id: uuid('id')
    .$defaultFn(() => generateUuidV7())
    .primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull().default('production'), // development | staging | production
  apiKeyPrefix: text('api_key_prefix').notNull().default('convey_live_'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id')
    .$defaultFn(() => generateUuidV7())
    .primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('developer'), // owner | admin | developer | content | auditor
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Environment = typeof environments.$inferSelect;
export type UserRoleRecord = typeof userRoles.$inferSelect;
