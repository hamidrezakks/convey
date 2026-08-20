import { index, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const messageEvents = pgTable(
  'message_events',
  {
    id: text('id').notNull(),
    messageId: text('message_id').notNull(),
    attemptId: text('attempt_id'),
    channel: text('channel'),
    providerId: text('provider_id'),
    type: text('type').notNull(), // message.accepted, attempt.started, delivery.delivered, fallback.triggered, policy.rate_limited
    source: text('source').notNull(), // api, outbox_relay, worker, webhook
    metadata: jsonb('metadata'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.occurredAt] }),
    index('idx_events_msg_occurred').on(table.messageId, table.occurredAt),
  ],
);

export type MessageEvent = typeof messageEvents.$inferSelect;
export type NewMessageEvent = typeof messageEvents.$inferInsert;
