import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql/postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/db-convey';

export const queryClient = new SQL(connectionString, {
  max: 10,
  idleTimeout: 30,
  connectTimeout: 10,
});

// biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM Bun-SQL driver config overload workaround
export const db = drizzle({ client: queryClient, schema } as any);

/**
 * Initializes database tables for plugins if they don't already exist.
 */
export async function initializePluginTables() {
  await queryClient.unsafe(`
    CREATE TABLE IF NOT EXISTS subscription_topics (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      team TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
      default_channels JSONB NOT NULL DEFAULT '["email"]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_subscription_topics_tenant_team_key UNIQUE (tenant_id, team, key)
    );

    CREATE INDEX IF NOT EXISTS idx_subscription_topics_tenant_team ON subscription_topics (tenant_id, team);

    CREATE TABLE IF NOT EXISTS recipient_preferences (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      team TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      channel_preferences JSONB NOT NULL DEFAULT '{"email":true,"sms":true,"push":true,"chat":true}'::jsonb,
      topic_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
      unsubscribe_token TEXT NOT NULL UNIQUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_recipient_preferences_tenant_recipient UNIQUE (tenant_id, recipient_id)
    );

    CREATE INDEX IF NOT EXISTS idx_recipient_preferences_recipient ON recipient_preferences (tenant_id, recipient_id);

    CREATE TABLE IF NOT EXISTS in_app_notifications (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL,
      team TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      cta_url TEXT,
      icon_url TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      data JSONB DEFAULT '{}'::jsonb,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      read_at TIMESTAMPTZ,
      is_archived BOOLEAN NOT NULL DEFAULT FALSE,
      archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_in_app_recipient ON in_app_notifications (tenant_id, recipient_id, is_read, is_archived);
  `);
}
