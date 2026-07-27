import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { BatchStatus } from '../../modules/messaging/messaging.types';

export const batches = pgTable(
  'batches',
  {
    id: text('id').primaryKey(), // batch_<ULID>
    tenantId: text('tenant_id').notNull(),
    team: text('team').notNull(),
    totalCount: integer('total_count').notNull(),
    sentCount: integer('sent_count').notNull().default(0),
    deliveredCount: integer('delivered_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    status: text('status').$type<BatchStatus>().notNull().default(BatchStatus.PROCESSING),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_batches_tenant_team_created').on(table.tenantId, table.team, table.createdAt),
    index('idx_batches_status_updated').on(table.status, table.updatedAt),
  ],
);

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;
