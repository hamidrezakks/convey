import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const messageAttempts = pgTable(
  'message_attempts',
  {
    id: text('id').notNull(),
    messageId: text('message_id').notNull(),
    channel: text('channel').notNull(),
    providerId: text('provider_id').notNull(),
    recipientIndex: integer('recipient_index').default(0).notNull(),
    attemptNo: integer('attempt_no').notNull(),
    origin: text('origin').notNull(), // initial, retry, provider_failover, fallback
    state: text('state').notNull(), // queued, sending, provider_accepted, delivered, opened, read, failed
    providerMessageId: text('provider_message_id'), // INTERNAL ONLY
    errorCategory: text('error_category'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    providerMetadata: jsonb('provider_metadata'),
    queuedAt: timestamp('queued_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    providerAcceptedAt: timestamp('provider_accepted_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt] }),
    index('idx_attempts_msg_created').on(table.messageId, table.createdAt),
    index('idx_attempts_provider_msg').on(table.providerId, table.providerMessageId),
  ],
);

export type MessageAttempt = typeof messageAttempts.$inferSelect;
export type NewMessageAttempt = typeof messageAttempts.$inferInsert;
