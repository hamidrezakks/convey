import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .$defaultFn(() => 'default-tenant'),
  externalId: text('external_id'),

  team: text('team').notNull(),

  name: text('name').notNull(),
  state: text('state').notNull().default('active'), // active, paused, cancelled, archived
  status: text('status').notNull().default('active'),
  metadata: jsonb('metadata'),

  pausedAt: timestamp('paused_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
