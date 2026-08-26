import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const subscriptionTopics = pgTable('subscription_topics', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  team: text('team').notNull(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isMandatory: boolean('is_mandatory').notNull().default(false),
  defaultChannels: jsonb('default_channels').notNull().default(['email']),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recipientPreferences = pgTable('recipient_preferences', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  team: text('team').notNull(),
  recipientId: text('recipient_id').notNull(),
  email: text('email'),
  phone: text('phone'),
  timezone: text('timezone').notNull().default('UTC'),
  quietHoursStart: text('quiet_hours_start'),
  quietHoursEnd: text('quiet_hours_end'),
  channelPreferences: jsonb('channel_preferences').notNull().default({
    email: true,
    sms: true,
    push: true,
    chat: true,
  }),
  topicPreferences: jsonb('topic_preferences').notNull().default({}),
  unsubscribeToken: text('unsubscribe_token').notNull().unique(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SubscriptionTopic = typeof subscriptionTopics.$inferSelect;
export type NewSubscriptionTopic = typeof subscriptionTopics.$inferInsert;
export type RecipientPreference = typeof recipientPreferences.$inferSelect;
export type NewRecipientPreference = typeof recipientPreferences.$inferInsert;
