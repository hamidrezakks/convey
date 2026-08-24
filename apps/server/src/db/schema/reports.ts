import { index, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const reportHourly = pgTable(
  'report_hourly',
  {
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
    costUsd: numeric('cost_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_report_hourly_team_hour').on(table.team, table.hour),
    index('idx_report_hourly_category_hour').on(table.category, table.hour),
    index('idx_report_hourly_hour').on(table.hour),
  ],
);

export const reportCampaignHourly = pgTable(
  'report_campaign_hourly',
  {
    id: text('id').primaryKey(), // cmp + campaignId + channel + hour
    campaignId: text('campaign_id').notNull(),
    team: text('team').notNull(),
    category: text('category').notNull(),
    channel: text('channel').notNull(),
    hour: timestamp('hour', { withTimezone: true }).notNull(),
    sentCount: integer('sent_count').notNull().default(0),
    deliveredCount: integer('delivered_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    openedCount: integer('opened_count').notNull().default(0),
    readCount: integer('read_count').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_report_camp_hourly_camp_hour').on(table.campaignId, table.hour),
    index('idx_report_camp_hourly_team_hour').on(table.team, table.hour),
    index('idx_report_camp_hourly_hour').on(table.hour),
  ],
);

export type ReportHourly = typeof reportHourly.$inferSelect;
export type ReportCampaignHourly = typeof reportCampaignHourly.$inferSelect;
