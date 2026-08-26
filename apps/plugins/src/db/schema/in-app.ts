import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const inAppNotifications = pgTable('in_app_notifications', {
  id: text('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  team: text('team').notNull(),
  recipientId: text('recipient_id').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  ctaUrl: text('cta_url'),
  iconUrl: text('icon_url'),
  category: text('category').notNull().default('general'),
  data: jsonb('data').default({}),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  isArchived: boolean('is_archived').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type NewInAppNotification = typeof inAppNotifications.$inferInsert;
