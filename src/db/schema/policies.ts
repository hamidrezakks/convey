import { integer, numeric, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const rateLimitPolicies = pgTable('rate_limit_policies', {
  id: text('id').primaryKey(),
  team: text('team').notNull(),
  category: text('category'),
  country: text('country'),
  channel: text('channel'),
  windowSeconds: integer('window_seconds').notNull().default(60),
  maxRequests: integer('max_requests').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const budgetPolicies = pgTable('budget_policies', {
  id: text('id').primaryKey(),
  team: text('team').notNull(),
  monthlyBudgetUsd: numeric('monthly_budget_usd', { precision: 12, scale: 4 }).notNull(),
  hardStop: text('hard_stop').notNull().default('true'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const budgetUsage = pgTable('budget_usage', {
  id: text('id').primaryKey(), // policy_id + month (YYYY-MM)
  policyId: text('policy_id').notNull(),
  month: text('month').notNull(), // YYYY-MM
  usedUsd: numeric('used_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const budgetLedger = pgTable(
  'budget_ledger',
  {
    id: text('id').notNull(),
    messageId: text('message_id').notNull(),
    team: text('team').notNull(),
    amountUsd: numeric('amount_usd', { precision: 12, scale: 4 }).notNull(),
    channel: text('channel').notNull(),
    providerId: text('provider_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id, table.createdAt] })],
);

export type RateLimitPolicy = typeof rateLimitPolicies.$inferSelect;
export type BudgetPolicy = typeof budgetPolicies.$inferSelect;
export type BudgetUsage = typeof budgetUsage.$inferSelect;
export type BudgetLedger = typeof budgetLedger.$inferSelect;
