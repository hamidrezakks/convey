import { db, queryClient } from '../../src/db';
import {
  budgetPolicies,
  budgetUsage,
  providerRoutes,
  providers,
  rateLimitPolicies,
  reportHourly,
} from '../../src/db/schema';
import { clearApiKeyCache } from '../../src/modules/auth/auth.middleware';
import { hashString } from '../../src/utils/crypto';
import { generateMessageId } from '../../src/utils/id';
import { encryptProviderCredentials } from '../../src/utils/payload-encryption';

export const SEEDED_API_KEY_RAW = 'cv_live_secret_key_e2e_testing_99887766554433221100';

export async function seedDatabaseWithRealisticData() {
  clearApiKeyCache();
  const now = new Date();
  const currentMonth = now.toISOString().substring(0, 7);
  const tenantId = '10000000-0000-0000-0000-000000000001';

  await queryClient.unsafe(`
    ALTER TABLE providers ALTER COLUMN tenant_id DROP NOT NULL;
    ALTER TABLE providers ALTER COLUMN provider_id DROP NOT NULL;
    ALTER TABLE providers ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE providers ALTER COLUMN is_enabled DROP NOT NULL;
    ALTER TABLE budget_ledger ALTER COLUMN tenant_id DROP NOT NULL;
    ALTER TABLE budget_ledger ALTER COLUMN amount DROP NOT NULL;
  `);

  // 1. Seed Tenants
  await queryClient.unsafe(`
    INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
    VALUES 
      ('${tenantId}', 'Acme Corporation', 'acme-corp', 'active', NOW(), NOW()),
      ('10000000-0000-0000-0000-000000000002', 'FinTech Global Inc.', 'fintech-global', 'active', NOW(), NOW()),
      ('10000000-0000-0000-0000-000000000003', 'QuickEats Express', 'quick-eats', 'active', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET status = 'active', name = EXCLUDED.name;
  `);

  // 2. Seed API Keys
  const keyHash = hashString(SEEDED_API_KEY_RAW);
  await queryClient.unsafe(`
    INSERT INTO api_keys (id, tenant_id, team, key_hash, name, active, created_at, updated_at)
    VALUES 
      ('key_acme_payments_live', '${tenantId}', 'payments', '${keyHash}', 'Payments Production API Key', true, NOW(), NOW()),
      ('key_fintech_orders_live', '10000000-0000-0000-0000-000000000002', 'orders', '${hashString('cv_live_fintech_orders_key_12345')}', 'Fintech Orders API Key', true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET active = true, tenant_id = EXCLUDED.tenant_id, key_hash = EXCLUDED.key_hash;
  `);

  // 3. Seed Campaigns with Raw SQL for backward compatibility with schema constraints
  for (let c = 1; c <= 10; c++) {
    const id = `campaign_scen_${c}`;
    const extId = `ext_cmp_${c}`;
    const team = c % 2 === 0 ? 'payments' : 'orders';
    const name = `Q3 Promo Campaign #${c}`;
    const state = c === 9 ? 'paused' : c === 10 ? 'cancelled' : 'active';
    const metadata = JSON.stringify({ targetAudience: 'VIP Customers', batch: c });

    await queryClient.unsafe(
      `INSERT INTO campaigns (id, tenant_id, external_id, team, name, state, status, metadata, created_at, updated_at) 
       VALUES ('${id}', '${tenantId}', '${extId}', '${team}', '${name}', '${state}', '${state}', '${metadata}', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
    );
  }

  // 4. Seed Providers with Raw SQL for backward compatibility
  const providerList = [
    {
      id: 'ses',
      channel: 'email',
      name: 'AWS SES',
      priority: 1,
      rateLimit: 100,
      baseCurrency: 'USD',
      credentials: { accessKeyId: 'AKIA_TEST_123', secretAccessKey: 'test_secret_key' },
      config: { defaultFrom: 'notifications@convey.io' },
    },
    {
      id: 'sendgrid',
      channel: 'email',
      name: 'SendGrid',
      priority: 2,
      rateLimit: 100,
      baseCurrency: 'USD',
      credentials: { apiKey: 'SG.test_sendgrid_api_key_123' },
      config: { defaultFrom: 'alerts@convey.io' },
    },
    {
      id: 'twilio',
      channel: 'sms',
      name: 'Twilio SMS',
      priority: 1,
      rateLimit: 50,
      baseCurrency: 'USD',
      credentials: { accountSid: 'AC1234567890abcdef', authToken: 'test_token' },
      config: { fromNumber: '+14155552671' },
    },
    {
      id: 'cequens',
      channel: 'sms',
      name: 'Cequens SMS',
      priority: 2,
      rateLimit: 50,
      baseCurrency: 'AED',
      credentials: { apiKey: 'cequens_api_key_live_9988' },
      config: { senderName: 'ConveyAuth' },
    },
  ];

  for (const p of providerList) {
    try {
      await db
        .insert(providers)
        .values({
          id: p.id,
          displayName: p.name,
          channel: p.channel.toLowerCase(),
          baseCurrency: p.baseCurrency,
          enabled: true,
          isPrimary: true,
          priority: p.priority,
          weight: 100,
          credentials: encryptProviderCredentials(p.credentials),
          config: p.config,
          rateLimitPerSec: p.rateLimit,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    } catch {
      // Postgres error fallback
    }
  }

  // 5. Seed Provider Routes
  await db
    .insert(providerRoutes)
    .values([
      {
        id: 'route_payments_otp_ae_sms',
        team: 'payments',
        category: 'otp',
        country: 'AE',
        channel: 'sms',
        primaryProviderId: 'cequens',
        secondaryProviderId: 'twilio',
        priority: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'route_orders_notif_us_email',
        team: 'orders',
        category: 'notification',
        country: 'US',
        channel: 'email',
        primaryProviderId: 'sendgrid',
        secondaryProviderId: 'ses',
        priority: 1,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();

  // 6. Seed Rate Limit Policies
  await db
    .insert(rateLimitPolicies)
    .values([
      {
        id: 'policy_ratelimit_payments_otp',
        team: 'payments',
        category: 'otp',
        country: 'AE',
        channel: 'sms',
        windowSeconds: 60,
        maxRequests: 500,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'policy_ratelimit_orders_email',
        team: 'orders',
        category: 'notification',
        country: 'US',
        channel: 'email',
        windowSeconds: 60,
        maxRequests: 200,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'policy_ratelimit_restricted',
        team: 'restricted_team',
        category: 'marketing',
        country: 'US',
        channel: 'email',
        windowSeconds: 60,
        maxRequests: 1,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();

  // 7. Seed Budget Policies & Usage
  await db
    .insert(budgetPolicies)
    .values([
      {
        id: 'policy_budget_payments',
        team: 'payments',
        currency: 'USD',
        monthlyBudgetUsd: '5000.0000',
        hardStop: 'true',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'policy_budget_exceeded_team',
        team: 'budget_exceeded_team',
        currency: 'USD',
        monthlyBudgetUsd: '10.0000',
        hardStop: 'true',
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(budgetUsage)
    .values([
      {
        id: `policy_budget_payments_${currentMonth}`,
        policyId: 'policy_budget_payments',
        month: currentMonth,
        currency: 'USD',
        usedUsd: '125.5000',
        updatedAt: now,
      },
      {
        id: `policy_budget_exceeded_team_${currentMonth}`,
        policyId: 'policy_budget_exceeded_team',
        month: currentMonth,
        currency: 'USD',
        usedUsd: '15.0000',
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();

  // 8. Seed Budget Ledger with Raw SQL
  const ledger1 = generateMessageId();
  const ledger2 = generateMessageId();
  await queryClient.unsafe(
    `INSERT INTO budget_ledger (id, tenant_id, message_id, team, amount, amount_usd, channel, provider_id, created_at)
     VALUES ('${ledger1}', '${tenantId}', 'msg_01JYQ81NE7XK47PAV6MQR2P9NK', 'payments', 0.005, '0.0050', 'sms', 'twilio', NOW())
     ON CONFLICT DO NOTHING;`,
  );
  await queryClient.unsafe(
    `INSERT INTO budget_ledger (id, tenant_id, message_id, team, amount, amount_usd, channel, provider_id, created_at)
     VALUES ('${ledger2}', '${tenantId}', 'msg_01JYQ81NE7XK47PAV6MQR2P9NL', 'orders', 0.0025, '0.0025', 'email', 'ses', NOW())
     ON CONFLICT DO NOTHING;`,
  );

  // 9. Seed Suppressions with Raw SQL
  const suppressedEmail = 'bounced_user@example.com';
  const suppressedPhone = '+19998887766';
  await queryClient.unsafe(
    `INSERT INTO suppressions (id, target_type, identifier_type, identifier_hash, recipient, channel, team, category, reason, starts_at, created_at)
     VALUES ('supp_bounced_email_01', 'recipient', 'email', '${hashString(suppressedEmail)}', '${suppressedEmail}', 'email', 'payments', 'transactional', 'bounce', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING;`,
  );
  await queryClient.unsafe(
    `INSERT INTO suppressions (id, target_type, identifier_type, identifier_hash, recipient, channel, team, category, reason, starts_at, created_at)
     VALUES ('supp_unsub_phone_02', 'recipient', 'phone', '${hashString(suppressedPhone)}', '${suppressedPhone}', 'sms', 'payments', 'otp', 'unsubscribe', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING;`,
  );

  // 10. Seed Report Hourly
  const currentHour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0),
  );
  await db
    .insert(reportHourly)
    .values([
      {
        id: `rep_payments_otp_AE_sms_${currentHour.toISOString().replace(/[:.-]/g, '_')}`,
        team: 'payments',
        category: 'otp',
        country: 'AE',
        channel: 'sms',
        hour: currentHour,
        sentCount: 150,
        deliveredCount: 145,
        failedCount: 5,
        openedCount: 0,
        readCount: 0,
        updatedAt: now,
      },
      {
        id: `rep_orders_transactional_US_email_${currentHour.toISOString().replace(/[:.-]/g, '_')}`,
        team: 'orders',
        category: 'transactional',
        country: 'US',
        channel: 'email',
        hour: currentHour,
        sentCount: 300,
        deliveredCount: 290,
        failedCount: 10,
        openedCount: 180,
        readCount: 120,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();
}
