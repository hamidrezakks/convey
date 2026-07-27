import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const suppressions = pgTable(
  'suppressions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    recipient: text('recipient'),
    targetType: text('target_type').notNull(), // recipient, sender
    identifierType: text('identifier_type').notNull(), // email, phone, whatsapp, fcm_token, apns_token
    identifierHash: text('identifier_hash').notNull(), // SHA-256 hash of normalized recipient
    team: text('team').notNull(),
    category: text('category'),
    country: text('country'),
    channel: text('channel').notNull().default('ALL'),
    reason: text('reason').notNull(), // bounce, spam_complaint, unsubscribe, manual
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_suppressions_hash').on(table.identifierHash),
    index('idx_suppressions_team').on(table.team, table.identifierHash),
  ],
);

export type Suppression = typeof suppressions.$inferSelect;
export type NewSuppression = typeof suppressions.$inferInsert;
