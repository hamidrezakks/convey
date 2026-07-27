import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const reportHourly = pgTable('report_hourly', {
  id: text('id').primaryKey(), // team + category + country + channel + hour
  team: text('team').notNull(),
  category: text('category').notNull(),
  country: text('country').notNull(),
  channel: text('channel').notNull(),
  hour: timestamp('hour', { withTimezone: true }).notNull(),
  sentCount: integer('sent_count').notNull().default(0),
  deliveredCount: integer('delivered_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  openedCount: integer('opened_count').notNull().default(0),
  readCount: integer('read_count').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ReportHourly = typeof reportHourly.$inferSelect;
