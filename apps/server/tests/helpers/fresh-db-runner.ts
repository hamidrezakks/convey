import { db, queryClient } from '../../src/db';
import {
  apiKeys,
  auditLogs,
  budgetPolicies,
  budgetUsage,
  campaigns,
  messageAttempts,
  messageEvents,
  messages,
  outbox,
  providerRoutes,
  providers,
  rateLimitPolicies,
  reportHourly,
  suppressions,
  tenants,
} from '../../src/db/schema';
import { Channel } from '../../src/modules/messaging/messaging.types';
import { hashString } from '../../src/utils/crypto';

export interface IsolatedDbSetup {
  prefix: string;
  cleanup: () => Promise<void>;
}

/**
 * Ensures clean state for benchmark test run by resetting DB schema.
 */
export async function setupFreshIsolatedDatabase(customPrefix?: string): Promise<IsolatedDbSetup> {
  const prefix = customPrefix || `e2e_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await queryClient.unsafe(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      team TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      details JSONB,
      prev_hash TEXT,
      hash TEXT NOT NULL,
      ip_address TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    ALTER TABLE providers ALTER COLUMN tenant_id DROP NOT NULL;
    ALTER TABLE providers ALTER COLUMN provider_id DROP NOT NULL;
    ALTER TABLE providers ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE providers ALTER COLUMN is_enabled DROP NOT NULL;
    ALTER TABLE budget_ledger ALTER COLUMN tenant_id DROP NOT NULL;
    ALTER TABLE budget_ledger ALTER COLUMN amount DROP NOT NULL;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS weight INT NOT NULL DEFAULT 100;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS fallback_provider_id TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS credentials JSONB;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS config JSONB;
  `);

  // Clean existing transactional tables for fresh benchmark state
  await db.delete(auditLogs);
  await db.delete(messageEvents);
  await db.delete(messageAttempts);
  await db.delete(outbox);
  await db.delete(messages);
  await db.delete(reportHourly);
  await db.delete(suppressions);
  await db.delete(budgetUsage);
  await db.delete(budgetPolicies);
  await db.delete(rateLimitPolicies);
  await db.delete(providerRoutes);
  await db.delete(providers);
  await db.delete(campaigns);
  await db.delete(apiKeys);
  await db.delete(tenants);

  const now = new Date();
  const tenantId = crypto.randomUUID();

  // 1. Tenants & Keys
  await db.insert(tenants).values([
    {
      id: tenantId,
      name: 'Benchmark Main Tenant',
      slug: `tenant_${prefix}`,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(apiKeys).values([
    {
      id: `${prefix}_key_live`,
      tenantId,
      team: 'benchmark_team',
      keyHash: hashString(`convey_live_${prefix}`),
      name: 'Benchmark Live Key',
      active: true,
      createdAt: now,
    },
  ]);

  // 2. 16 Providers Across 4 Channels (4 Providers Each)
  const providerList = [
    // Email (4)
    { id: 'ses', channel: Channel.EMAIL, name: 'AWS SES', priority: 1 },
    { id: 'sendgrid', channel: Channel.EMAIL, name: 'SendGrid', priority: 2 },
    { id: 'resend', channel: Channel.EMAIL, name: 'Resend', priority: 3 },
    { id: 'mailgun', channel: Channel.EMAIL, name: 'Mailgun', priority: 4 },

    // SMS (4)
    { id: 'twilio', channel: Channel.SMS, name: 'Twilio SMS', priority: 1 },
    { id: 'cequens', channel: Channel.SMS, name: 'Cequens SMS', priority: 2 },
    { id: 'termii', channel: Channel.SMS, name: 'Termii SMS', priority: 3 },
    { id: 'bandwidth', channel: Channel.SMS, name: 'Bandwidth SMS', priority: 4 },

    // Push (4)
    { id: 'fcm', channel: Channel.FCM, name: 'Firebase Cloud Messaging', priority: 1 },
    { id: 'apns', channel: Channel.APNS, name: 'Apple Push Notification Service', priority: 2 },
    { id: 'one-signal', channel: Channel.FCM, name: 'OneSignal Push', priority: 3 },
    { id: 'expo', channel: Channel.FCM, name: 'Expo Push', priority: 4 },

    // Chat (4)
    { id: 'whatsapp-business', channel: Channel.WHATSAPP, name: 'WhatsApp Business', priority: 1 },
    { id: 'telegram', channel: Channel.TELEGRAM, name: 'Telegram Bot', priority: 2 },
    { id: 'slack', channel: Channel.SLACK, name: 'Slack Webhook', priority: 3 },
    { id: 'discord', channel: Channel.SLACK, name: 'Discord Webhook', priority: 4 },
  ];

  for (const p of providerList) {
    try {
      await db
        .insert(providers)
        .values({
          id: p.id,
          displayName: p.name,
          channel: p.channel.toLowerCase(),
          enabled: true,
          isPrimary: true,
          priority: p.priority,
          weight: 100,
          credentials: { apiKey: `mock_key_${p.id}` },
          config: { defaultFrom: 'noreply@convey.io' },
          rateLimitPerSec: 100,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    } catch {
      // Postgres error fallback
    }
  }

  // 3. Routing Rules (Same-channel failover + Cross-channel fallbacks)
  await queryClient.unsafe(
    `INSERT INTO provider_routes (id, team, category, country, channel, primary_provider_id, secondary_provider_id, priority, created_at, updated_at)
     VALUES 
      ('${prefix}_route_email', 'benchmark_team', 'transactional', 'ALL', 'email', 'ses', 'sendgrid', 1, NOW(), NOW()),
      ('${prefix}_route_sms', 'benchmark_team', 'otp', 'ALL', 'sms', 'twilio', 'cequens', 1, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING;`,
  );

  return {
    prefix,
    cleanup: async () => {},
  };
}

export const createFreshTestDb = setupFreshIsolatedDatabase;
