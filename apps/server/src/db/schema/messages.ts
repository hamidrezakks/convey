import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import type { ChannelRequest, Recipients } from '../../modules/messaging/messaging.types';

export const messages = pgTable(
  'messages',
  {
    id: text('id').notNull(),
    publicId: text('public_id').notNull(),
    userId: text('user_id').notNull(),
    team: text('team').notNull(),
    category: text('category').notNull(),
    country: varchar('country', { length: 2 }).notNull(),
    campaignId: text('campaign_id'),
    state: text('state').notNull().default('accepted'),
    priority: text('priority').notNull().default('normal'),
    isSandbox: boolean('is_sandbox').notNull().default(false),
    recipients: jsonb('recipients').$type<Recipients>().notNull(),
    channels: jsonb('channels').$type<ChannelRequest[]>().notNull(),
    fallback: jsonb('fallback').$type<Record<string, unknown>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt] }),
    index('idx_messages_public_id_created').on(table.publicId, table.createdAt),
    index('idx_messages_team_created').on(table.team, table.createdAt),
    index('idx_messages_state_created').on(table.state, table.createdAt),
    index('idx_messages_state_scheduled').on(table.state, table.scheduledAt),
    index('idx_messages_sandbox').on(table.team, table.isSandbox, table.createdAt),
  ],
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
