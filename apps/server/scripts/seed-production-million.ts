import { createHash } from 'node:crypto';
import { COMPLETE_88_PROVIDER_CATALOG } from '@convey/shared';
import { queryClient } from '../src/db';
import { ensureMonthlyPartitions } from '../src/db/partitions';

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Super Senior / Staff-level Production Database Seeder
 * Populates 1,000,000 realistic messages, 88 provider configurations,
 * routing tables, policies, suppressions, cryptographic audit logs, and hourly rollups.
 */
export async function seedMillionProductionData() {
  console.log('🚀 ================================================================');
  console.log('   CONVEY ENTERPRISE DATABASE SEEDER (1,000,000 MESSAGES)');
  console.log('================================================================\n');

  const globalStart = performance.now();

  // 1. Ensure Partitions for past 3 months to next 6 months
  console.log('📦 Step 1: Ensuring range partitions (2026_05 to 2027_02)...');
  await ensureMonthlyPartitions(6, 3);

  // 2. Clean/Truncate existing data for a clean slate
  console.log('🧹 Step 2: Cleaning high-volume tables for pristine state...');
  await queryClient.unsafe(`
    TRUNCATE TABLE messages CASCADE;
    TRUNCATE TABLE message_attempts CASCADE;
    TRUNCATE TABLE message_events CASCADE;
    TRUNCATE TABLE outbox CASCADE;
    TRUNCATE TABLE budget_ledger CASCADE;
    TRUNCATE TABLE report_hourly CASCADE;
    TRUNCATE TABLE suppressions CASCADE;
    TRUNCATE TABLE audit_logs CASCADE;
    TRUNCATE TABLE webhook_deliveries CASCADE;
    TRUNCATE TABLE webhook_subscriptions CASCADE;
    TRUNCATE TABLE batches CASCADE;
    TRUNCATE TABLE campaigns CASCADE;
    TRUNCATE TABLE provider_routes CASCADE;
    TRUNCATE TABLE budget_usage CASCADE;
    TRUNCATE TABLE budget_policies CASCADE;
    TRUNCATE TABLE rate_limit_policies CASCADE;
    TRUNCATE TABLE providers CASCADE;
    TRUNCATE TABLE api_keys CASCADE;
    TRUNCATE TABLE tenants CASCADE;
  `);

  // 3. Seed 10 Enterprise Tenants & API Keys
  console.log('🏢 Step 3: Seeding Enterprise Tenants & API Keys...');
  const tenants = [
    { id: '10000000-0000-0000-0000-000000000001', name: 'Acme Corporation', slug: 'acme-corp' },
    { id: '10000000-0000-0000-0000-000000000002', name: 'FinTech Global Inc.', slug: 'fintech-global' },
    { id: '10000000-0000-0000-0000-000000000003', name: 'QuickEats Express Delivery', slug: 'quick-eats' },
    { id: '10000000-0000-0000-0000-000000000004', name: 'HealthFirst Telehealth', slug: 'health-first' },
    { id: '10000000-0000-0000-0000-000000000005', name: 'NovaPay Financial Services', slug: 'novapay' },
    { id: '10000000-0000-0000-0000-000000000006', name: 'CloudScale Infrastructure', slug: 'cloudscale' },
    { id: '10000000-0000-0000-0000-000000000007', name: 'ShopStream E-Commerce', slug: 'shopstream' },
    { id: '10000000-0000-0000-0000-000000000008', name: 'SafeGuard Security Systems', slug: 'safeguard' },
    { id: '10000000-0000-0000-0000-000000000009', name: 'GlobalLogistics Freight Hub', slug: 'globallogistics' },
    { id: '10000000-0000-0000-0000-000000000010', name: 'Nexar Media & Entertainment', slug: 'nexar' },
  ];

  for (const t of tenants) {
    await queryClient.unsafe(`
      INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
      VALUES ('${t.id}', '${t.name}', '${t.slug}', 'active', NOW() - INTERVAL '60 days', NOW())
    `);
  }

  // Seed API Keys
  const teams = [
    'team_auth',
    'team_billing',
    'team_marketing',
    'team_security',
    'team_logistics',
    'team_support',
    'team_fintech',
    'team_payments',
  ];
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const rawKey = `cv_live_${team}_key_99887766554433221100`;
    const hash = sha256(rawKey);
    await queryClient.unsafe(`
      INSERT INTO api_keys (id, tenant_id, team, key_hash, name, active, created_at, updated_at)
      VALUES ('key_${team}_prod', '${tenants[i % tenants.length].id}', '${team}', '${hash}', '${team.replace('_', ' ').toUpperCase()} Production API Key', true, NOW() - INTERVAL '45 days', NOW())
    `);
  }

  // 4. Seed Full 88 Turnkey Providers Catalog
  console.log(`🔌 Step 4: Seeding full 88-provider turnkey catalog with distinct credentials & configs...`);
  for (const item of COMPLETE_88_PROVIDER_CATALOG) {
    const creds: Record<string, string> = {};
    if (item.requiredEnvVars) {
      for (const envVar of item.requiredEnvVars) {
        creds[envVar.key] = envVar.isSecret
          ? `sec_${item.id}_${Math.random().toString(36).substring(2, 10)}`
          : envVar.defaultValue || `${item.id}-config`;
      }
    } else {
      creds.apiKey = `live_key_${item.id}_${Math.random().toString(36).substring(2, 10)}`;
    }

    const featureConfig = {
      email:
        item.channel === 'EMAIL'
          ? { openTracking: true, clickTracking: true, tlsPolicy: 'REQUIRE', dkimSelector: 'convey2026' }
          : undefined,
      sms:
        item.channel === 'SMS'
          ? { smartGsmPacking: true, alphanumericSenderId: true, dlrTimeoutSeconds: 30 }
          : undefined,
      whatsapp:
        item.channel === 'WHATSAPP'
          ? { costSaving24hSession: true, interactiveButtons: true, autoTemplateValidation: true }
          : undefined,
      push:
        item.channel === 'PUSH' ? { fcmHighPriority: true, apnsPushType: 'alert', badgeIncrement: true } : undefined,
      slack: item.channel === 'SLACK' ? { mrkdwn: true, unfurlLinks: false } : undefined,
    };

    await queryClient.unsafe(`
      INSERT INTO providers (id, display_name, channel, enabled, is_primary, priority, weight, credentials, config, rate_limit_per_sec, created_at, updated_at)
      VALUES (
        '${item.id}',
        '${item.displayName.replace(/'/g, "''")}',
        '${item.channel.toLowerCase()}',
        true,
        ${item.defaultPriority === 1},
        ${item.defaultPriority || 1},
        ${item.defaultWeight || 100},
        '${JSON.stringify(creds).replace(/'/g, "''")}'::jsonb,
        '${JSON.stringify(featureConfig).replace(/'/g, "''")}'::jsonb,
        ${item.channel === 'PUSH' ? 500 : item.channel === 'EMAIL' ? 300 : 100},
        NOW() - INTERVAL '40 days',
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // 5. Seed Provider Routes
  console.log('🗺️  Step 5: Seeding intelligent multi-channel routing rules...');
  const routes = [
    { team: 'team_auth', category: 'otp', country: 'US', channel: 'sms', primary: 'twilio', secondary: 'messagebird' },
    { team: 'team_auth', category: 'otp', country: 'GB', channel: 'sms', primary: 'messagebird', secondary: 'vonage' },
    { team: 'team_auth', category: 'otp', country: 'DE', channel: 'sms', primary: 'sinch', secondary: 'twilio' },
    { team: 'team_auth', category: 'otp', country: 'AE', channel: 'sms', primary: 'cequens', secondary: 'infobip' },
    {
      team: 'team_billing',
      category: 'transactional',
      country: 'US',
      channel: 'email',
      primary: 'ses',
      secondary: 'sendgrid',
    },
    {
      team: 'team_billing',
      category: 'transactional',
      country: 'GB',
      channel: 'email',
      primary: 'postmark',
      secondary: 'ses',
    },
    {
      team: 'team_billing',
      category: 'transactional',
      country: 'DE',
      channel: 'email',
      primary: 'mailgun',
      secondary: 'postmark',
    },
    {
      team: 'team_marketing',
      category: 'marketing',
      country: 'US',
      channel: 'email',
      primary: 'sendgrid',
      secondary: 'mailgun',
    },
    {
      team: 'team_marketing',
      category: 'marketing',
      country: 'US',
      channel: 'whatsapp',
      primary: 'meta-whatsapp',
      secondary: 'infobip-whatsapp',
    },
    {
      team: 'team_security',
      category: 'alert',
      country: 'US',
      channel: 'slack',
      primary: 'slack-bot',
      secondary: 'slack-webhook',
    },
    {
      team: 'team_logistics',
      category: 'transactional',
      country: 'US',
      channel: 'push',
      primary: 'fcm',
      secondary: 'apns',
    },
  ];

  for (let r = 0; r < routes.length; r++) {
    const route = routes[r];
    await queryClient.unsafe(`
      INSERT INTO provider_routes (id, team, category, country, channel, primary_provider_id, secondary_provider_id, priority, created_at, updated_at)
      VALUES ('route_${r + 1}', '${route.team}', '${route.category}', '${route.country}', '${route.channel}', '${route.primary}', '${route.secondary}', 1, NOW() - INTERVAL '35 days', NOW())
    `);
  }

  // 6. Seed Policies & Budgets
  console.log('⚖️  Step 6: Seeding DRR rate limit policies and monthly budgets...');
  for (const team of teams) {
    const budget = team === 'team_marketing' ? 35000 : team === 'team_billing' ? 20000 : 10000;
    const maxReqs = team === 'team_auth' ? 2000 : 1000;

    await queryClient.unsafe(`
      INSERT INTO rate_limit_policies (id, team, window_seconds, max_requests, created_at, updated_at)
      VALUES ('pol_rate_${team}', '${team}', 60, ${maxReqs}, NOW() - INTERVAL '40 days', NOW());

      INSERT INTO budget_policies (id, team, monthly_budget_usd, hard_stop, created_at, updated_at)
      VALUES ('pol_budget_${team}', '${team}', ${budget}.0000, 'true', NOW() - INTERVAL '40 days', NOW());

      INSERT INTO budget_usage (id, policy_id, month, used_usd, updated_at)
      VALUES 
        ('use_${team}_2026_07', 'pol_budget_${team}', '2026-07', ${(budget * 0.82).toFixed(4)}, NOW() - INTERVAL '15 days'),
        ('use_${team}_2026_08', 'pol_budget_${team}', '2026-08', ${(budget * 0.64).toFixed(4)}, NOW());
    `);
  }

  // 7. Seed Suppressions (500+ realistic opt-outs and bounces)
  console.log('🚫 Step 7: Seeding 500+ realistic recipient suppressions...');
  const suppressionReasons = [
    'BOUNCE_5XX',
    'SPAM_COMPLAINT',
    'USER_UNSUBSCRIBE_STOP',
    'CARRIER_BLOCKED',
    'MANUAL_ADMIN_BLOCK',
  ];
  for (let s = 1; s <= 500; s++) {
    const isEmail = s % 2 === 0;
    const reason = suppressionReasons[s % suppressionReasons.length];
    const team = teams[s % teams.length];
    const rawTarget = isEmail ? `bounced_user_${s}@domain${s % 20}.com` : `+1415555${String(s).padStart(4, '0')}`;
    const hash = sha256(rawTarget.toLowerCase().trim());

    await queryClient.unsafe(`
      INSERT INTO suppressions (id, target_type, identifier_type, identifier_hash, team, channel, reason, starts_at, created_at)
      VALUES ('sup_${s}', 'recipient', '${isEmail ? 'email' : 'phone'}', '${hash}', '${team}', '${isEmail ? 'email' : 'sms'}', '${reason}', NOW() - INTERVAL '${s % 30} days', NOW() - INTERVAL '${s % 30} days')
    `);
  }

  // 8. Seed Cryptographic Audit Ledger
  console.log('🔒 Step 8: Seeding cryptographic SHA-256 chained audit logs...');
  let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const auditActions = [
    'PROVIDER_REGISTERED',
    'ROUTE_UPDATED',
    'POLICY_CREATED',
    'SUPPRESSION_ADDED',
    'DLQ_REPLAY_EXECUTED',
    'CIRCUIT_BREAKER_RESET',
  ];
  for (let a = 1; a <= 150; a++) {
    const action = auditActions[a % auditActions.length];
    const team = teams[a % teams.length];
    const actorId = `usr_admin_${(a % 5) + 1}`;
    const details = JSON.stringify({ auditIndex: a, reason: 'Automated policy enforcement / manual override' });
    const currentHash = sha256(`${prevHash}:${action}:${team}:${actorId}:${a}`);

    await queryClient.unsafe(`
      INSERT INTO audit_logs (id, tenant_id, team, actor_id, actor_role, action, resource_type, resource_id, details, prev_hash, hash, ip_address, created_at)
      VALUES (
        'aud_${a}',
        '${tenants[a % tenants.length].id}',
        '${team}',
        '${actorId}',
        'SUPER_ADMIN',
        '${action}',
        'POLICY',
        'res_${a}',
        '${details}'::jsonb,
        '${prevHash}',
        '${currentHash}',
        '192.168.1.${(a % 250) + 1}',
        NOW() - INTERVAL '${35 - Math.floor(a / 5)} days' + INTERVAL '${a % 24} hours'
      )
    `);
    prevHash = currentHash;
  }

  // 9. High-Performance Bulk Generation of 1,000,000 Messages
  console.log('\n⚡ Step 9: Bulk generating 1,000,000 realistic messages across July 15 – August 19, 2026...');
  const totalMessages = 1_000_000;
  const batchSize = 50_000;
  const totalBatches = totalMessages / batchSize;

  for (let b = 0; b < totalBatches; b++) {
    const batchStart = performance.now();
    const offset = b * batchSize;

    // PostgreSQL generate_series with mathematical time distribution and UUIDv7 construction
    await queryClient.unsafe(`
      INSERT INTO messages (
        id,
        public_id,
        user_id,
        team,
        category,
        country,
        state,
        priority,
        is_sandbox,
        recipients,
        channels,
        metadata,
        created_at,
        updated_at
      )
      SELECT
        -- Internal ID
        'int_' || lpad(( ${offset} + s.i )::text, 8, '0'),

        -- Public ID formatted as msg_<UUIDv7> where high 48-bits encode message creation timestamp
        'msg_' ||
        lpad(to_hex((EXTRACT(EPOCH FROM msg_time) * 1000)::bigint), 12, '0') ||
        '-7000-' ||
        lpad(to_hex((s.i % 4095) + 1), 4, '0') ||
        '-' ||
        substr(md5(( ${offset} + s.i )::text), 1, 12),

        -- User ID
        'usr_' || ((s.i % 25000) + 1),

        -- Team
        CASE (s.i % 8)
          WHEN 0 THEN 'team_auth'
          WHEN 1 THEN 'team_billing'
          WHEN 2 THEN 'team_marketing'
          WHEN 3 THEN 'team_security'
          WHEN 4 THEN 'team_logistics'
          WHEN 5 THEN 'team_support'
          WHEN 6 THEN 'team_fintech'
          ELSE 'team_payments'
        END,

        -- Category
        CASE (s.i % 6)
          WHEN 0 THEN 'transactional'
          WHEN 1 THEN 'otp'
          WHEN 2 THEN 'alert'
          WHEN 3 THEN 'marketing'
          WHEN 4 THEN 'system'
          ELSE 'notification'
        END,

        -- Country
        CASE (s.i % 8)
          WHEN 0 THEN 'US'
          WHEN 1 THEN 'GB'
          WHEN 2 THEN 'DE'
          WHEN 3 THEN 'FR'
          WHEN 4 THEN 'AE'
          WHEN 5 THEN 'SG'
          WHEN 6 THEN 'JP'
          ELSE 'BR'
        END,

        -- State (94.2% delivered, 3.1% failed, 1.5% queued, 1.2% suppressed)
        CASE
          WHEN (s.i % 1000) < 942 THEN 'delivered'
          WHEN (s.i % 1000) < 973 THEN 'failed'
          WHEN (s.i % 1000) < 988 THEN 'queued'
          ELSE 'suppressed'
        END,

        -- Priority
        CASE (s.i % 20)
          WHEN 0 THEN 'critical'
          WHEN 1 THEN 'high'
          WHEN 2 THEN 'high'
          WHEN 3 THEN 'high'
          WHEN 19 THEN 'bulk'
          ELSE 'normal'
        END,

        -- Sandbox ratio: 92% prod, 8% sandbox
        (s.i % 100 < 8),

        -- Recipients JSONB
        CASE (s.i % 6)
          WHEN 0 THEN jsonb_build_object('email', 'customer_' || (s.i % 50000) || '@acme-domain.com')
          WHEN 1 THEN jsonb_build_object('phone', '+1415555' || lpad((s.i % 10000)::text, 4, '0'))
          WHEN 2 THEN jsonb_build_object('whatsapp', '+1415555' || lpad((s.i % 10000)::text, 4, '0'))
          WHEN 3 THEN jsonb_build_object('fcmTokens', jsonb_build_array('fcm_token_' || (s.i % 20000)))
          WHEN 4 THEN jsonb_build_object('slack', jsonb_build_object('channelId', 'C0' || lpad((s.i % 999)::text, 7, '0')))
          ELSE jsonb_build_object('email', 'user_' || (s.i % 50000) || '@gmail.com')
        END,

        -- Channels JSONB
        CASE (s.i % 6)
          WHEN 0 THEN jsonb_build_array(jsonb_build_object('channel', 'email', 'content', jsonb_build_object('subject', 'Your Security & Account Verification Code', 'body', 'Hello, your verification code is 482910.')))
          WHEN 1 THEN jsonb_build_array(jsonb_build_object('channel', 'sms', 'content', jsonb_build_object('text', 'Convey Alert: Your OTP is 591248. Valid for 10m.')))
          WHEN 2 THEN jsonb_build_array(jsonb_build_object('channel', 'whatsapp', 'content', jsonb_build_object('templateName', 'order_status_update', 'text', 'Your package #TRK-9812 has shipped.')))
          WHEN 3 THEN jsonb_build_array(jsonb_build_object('channel', 'push', 'content', jsonb_build_object('title', 'New Account Notification', 'body', 'You received a new transaction receipt.')))
          WHEN 4 THEN jsonb_build_array(jsonb_build_object('channel', 'slack', 'content', jsonb_build_object('text', ':white_check_mark: Automated deployment succeeded in production.')))
          ELSE jsonb_build_array(jsonb_build_object('channel', 'email', 'content', jsonb_build_object('subject', 'Monthly Financial Statement', 'body', 'Your monthly account invoice is ready.')))
        END,

        -- Metadata
        jsonb_build_object('costUsd', (s.i % 100) * 0.00015 + 0.0002, 'simulatedLatencyMs', 25 + (s.i % 120)),

        -- Created at timestamp spanning past 35 days with sinusoidal diurnal curve
        msg_time,
        msg_time
      FROM (
        SELECT
          i,
          (
            NOW() - INTERVAL '35 days'
            + ( (${offset} + i)::numeric / ${totalMessages}::numeric * INTERVAL '35 days' )
            + ( sin( ( (${offset} + i) % 24 )::numeric / 24.0 * 2.0 * 3.14159265 ) * INTERVAL '2 hours' )
          ) AS msg_time
        FROM generate_series(1, ${batchSize}) AS i
      ) AS s;
    `);

    const batchElapsed = (performance.now() - batchStart).toFixed(1);
    const progressPercent = (((b + 1) / totalBatches) * 100).toFixed(0);
    console.log(
      `  ✓ Inserted Batch [${(offset + batchSize).toLocaleString()}/${totalMessages.toLocaleString()}] (${progressPercent}%) in ${batchElapsed}ms`,
    );
  }

  // 10. Seed Representative Message Attempts & Events
  console.log('\n📊 Step 10: Generating representative delivery attempts and waterfall trace events...');
  await queryClient.unsafe(`
    -- Attempts for a sample of 25,000 messages
    INSERT INTO message_attempts (
      id,
      message_id,
      channel,
      provider_id,
      recipient_index,
      attempt_no,
      origin,
      state,
      provider_message_id,
      error_category,
      error_code,
      error_message,
      latency_ms,
      created_at,
      updated_at
    )
    SELECT
      'att_' || m.public_id,
      m.public_id,
      (m.channels->0->>'channel')::text,
      CASE (m.channels->0->>'channel')
        WHEN 'email' THEN 'ses'
        WHEN 'sms' THEN 'twilio'
        WHEN 'whatsapp' THEN 'meta-whatsapp'
        WHEN 'push' THEN 'fcm'
        WHEN 'slack' THEN 'slack'
        ELSE 'ses'
      END,
      0,
      1,
      'initial',
      m.state,
      'pmsg_' || substr(md5(m.public_id), 1, 16),
      CASE WHEN m.state = 'failed' THEN 'PROVIDER_5XX' ELSE NULL END,
      CASE WHEN m.state = 'failed' THEN '550 5.1.1 User unknown' ELSE NULL END,
      CASE WHEN m.state = 'failed' THEN 'Mailbox unavailable or invalid destination' ELSE NULL END,
      35 + (length(m.public_id) % 80),
      m.created_at,
      m.created_at
    FROM messages m
    LIMIT 25000;

    -- Timeline events for 25,000 messages
    INSERT INTO message_events (
      id,
      message_id,
      type,
      source,
      channel,
      provider_id,
      occurred_at,
      created_at
    )
    SELECT
      'ev_in_' || m.public_id,
      m.public_id,
      'message.accepted',
      'api',
      (m.channels->0->>'channel')::text,
      'system',
      m.created_at,
      m.created_at
    FROM messages m
    LIMIT 25000;

    INSERT INTO message_events (
      id,
      message_id,
      type,
      source,
      channel,
      provider_id,
      occurred_at,
      created_at
    )
    SELECT
      'ev_out_' || m.public_id,
      m.public_id,
      CASE WHEN m.state = 'failed' THEN 'delivery.failed' ELSE 'delivery.delivered' END,
      'worker',
      (m.channels->0->>'channel')::text,
      CASE (m.channels->0->>'channel')
        WHEN 'email' THEN 'ses'
        WHEN 'sms' THEN 'twilio'
        WHEN 'whatsapp' THEN 'meta-whatsapp'
        ELSE 'fcm'
      END,
      m.created_at + INTERVAL '45 milliseconds',
      m.created_at + INTERVAL '45 milliseconds'
    FROM messages m
    LIMIT 25000;
  `);

  // 11. Seed Pre-Aggregated Hourly Reports
  console.log('📈 Step 11: Generating 840+ hourly performance aggregates across 35 days...');
  await queryClient.unsafe(`
    INSERT INTO report_hourly (
      id,
      team,
      category,
      country,
      channel,
      hour,
      sent_count,
      delivered_count,
      failed_count,
      opened_count,
      read_count,
      updated_at
    )
    SELECT
      'rep_' || team || '_' || (channels->0->>'channel')::text || '_' || country || '_' || category || '_' || to_char(date_trunc('hour', created_at), 'YYYYMMDDHH24'),
      team,
      category,
      country,
      (channels->0->>'channel')::text,
      date_trunc('hour', created_at),
      count(*),
      count(*) FILTER (WHERE state = 'delivered'),
      count(*) FILTER (WHERE state = 'failed'),
      (count(*) FILTER (WHERE state = 'delivered') * 0.38)::int,
      (count(*) FILTER (WHERE state = 'delivered') * 0.22)::int,
      NOW()
    FROM messages
    GROUP BY team, category, country, (channels->0->>'channel'), date_trunc('hour', created_at)
    ON CONFLICT (id) DO NOTHING;
  `);

  const totalTimeSeconds = ((performance.now() - globalStart) / 1000).toFixed(2);
  console.log('\n================================================================');
  console.log(`🎉 SUCCESS: 1,000,000 Messages & Full Ecosystem Seeded in ${totalTimeSeconds}s!`);
  console.log('================================================================\n');
}

if (import.meta.main) {
  seedMillionProductionData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeder failed:', err);
      process.exit(1);
    });
}
