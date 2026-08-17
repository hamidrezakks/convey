import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { MessagePriority } from '../../modules/messaging/messaging.types';

export interface OutboxPayload {
  readonly publicId?: string;
  readonly priority?: MessagePriority | string;
  readonly shardIndex?: number;
  readonly [key: string]: unknown;
}

export const outbox = pgTable(
  'outbox',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id').notNull(),
    shardId: integer('shard_id').notNull().default(0),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<OutboxPayload>().notNull(),
    state: text('state').notNull().default('pending'), // pending, locked, processed, failed
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_outbox_state_available').on(table.state, table.availableAt),
    index('outbox_shard_state_avail_idx').on(table.shardId, table.state, table.availableAt),
    index('idx_outbox_state_processed').on(table.state, table.processedAt),
  ],
);

export type OutboxRecord = typeof outbox.$inferSelect;
export type NewOutboxRecord = typeof outbox.$inferInsert;
