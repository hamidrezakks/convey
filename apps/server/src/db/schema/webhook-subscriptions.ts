import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const webhookSubscriptions = pgTable(
  'webhook_subscriptions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    team: text('team').notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(), // HMAC secret
    events: jsonb('events').$type<string[]>().notNull(), // e.g. ['message.delivered', 'message.failed', 'message.opened', 'message.bounced']
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_webhook_subs_tenant_team').on(table.tenantId, table.team, table.active)],
);

export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
