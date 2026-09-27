import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const teamOwners = pgTable('team_owners', {
  team: text('team').primaryKey(),
  tenantId: text('tenant_id').notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  team: text('team').notNull(),
  keyHash: text('key_hash').notNull().unique(), // SHA-256 hash of API key
  name: text('name').notNull(),
  role: text('role').notNull().default('DEVELOPER'),
  scope: text('scope').notNull().default('tenant'),
  sandboxOnly: boolean('sandbox_only').notNull().default(false),
  active: boolean('active').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
