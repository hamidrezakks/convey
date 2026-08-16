import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const providers = pgTable('providers', {
  id: text('id').primaryKey(), // e.g. sendgrid, twilio, meta-whatsapp, apns, fcm
  displayName: text('display_name'),
  channel: text('channel').notNull(), // email, sms, whatsapp, telegram, slack, push, tool
  enabled: boolean('enabled').notNull().default(true),
  isPrimary: boolean('is_primary').notNull().default(true),
  priority: integer('priority').notNull().default(1),
  weight: integer('weight').notNull().default(100),
  fallbackProviderId: text('fallback_provider_id'),
  credentials: jsonb('credentials').notNull(), // Encrypted provider options/tokens
  config: jsonb('config'), // Feature configurations (e.g. WhatsApp 24h cost saver, email tracking, sms smart packing)
  rateLimitPerSec: integer('rate_limit_per_sec').default(100),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const providerRoutes = pgTable('provider_routes', {
  id: text('id').primaryKey(),
  team: text('team').notNull(),
  category: text('category').notNull(),
  country: text('country').notNull(),
  channel: text('channel').notNull(),
  primaryProviderId: text('primary_provider_id').notNull(),
  secondaryProviderId: text('secondary_provider_id'),
  priority: integer('priority').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type ProviderRoute = typeof providerRoutes.$inferSelect;
export type NewProviderRoute = typeof providerRoutes.$inferInsert;
