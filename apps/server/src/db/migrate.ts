import { queryClient } from './index';
import { ensureMonthlyPartitions } from './partitions';

export async function migrate() {
  console.log('🚀 Running database setup and migrations...');

  await queryClient.unsafe(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      team TEXT NOT NULL DEFAULT 'default',
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      external_id TEXT,
      team TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'active',
      status TEXT NOT NULL DEFAULT 'active',
      metadata JSONB,
      paused_at TIMESTAMP WITH TIME ZONE,
      cancelled_at TIMESTAMP WITH TIME ZONE,
      archived_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS external_id TEXT;
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS metadata JSONB;
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      channel TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      credentials JSONB NOT NULL,
      config JSONB,
      priority INT NOT NULL DEFAULT 1,
      rate_limit_per_sec INT DEFAULT 100,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    ALTER TABLE providers ALTER COLUMN tenant_id DROP NOT NULL;
    ALTER TABLE providers ALTER COLUMN provider_id DROP NOT NULL;
    ALTER TABLE providers ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE providers ALTER COLUMN is_enabled DROP NOT NULL;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS weight INT NOT NULL DEFAULT 100;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS fallback_provider_id TEXT;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS credentials JSONB;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS config JSONB;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS rate_limit_per_sec INT DEFAULT 100;

    CREATE TABLE IF NOT EXISTS provider_routes (
      id TEXT PRIMARY KEY,
      team TEXT NOT NULL,
      category TEXT NOT NULL,
      country TEXT NOT NULL,
      channel TEXT NOT NULL,
      primary_provider_id TEXT NOT NULL,
      secondary_provider_id TEXT,
      priority INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rate_limit_policies (
      id TEXT PRIMARY KEY,
      team TEXT NOT NULL,
      category TEXT,
      country TEXT,
      channel TEXT,
      window_seconds INT NOT NULL DEFAULT 60,
      max_requests INT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS budget_policies (
      id TEXT PRIMARY KEY,
      team TEXT NOT NULL,
      monthly_budget_usd NUMERIC(12, 4) NOT NULL,
      hard_stop TEXT NOT NULL DEFAULT 'true',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS budget_usage (
      id TEXT PRIMARY KEY,
      policy_id TEXT NOT NULL,
      month TEXT NOT NULL,
      used_usd NUMERIC(12, 4) NOT NULL DEFAULT '0.0000',
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS budget_ledger (
      id TEXT NOT NULL,
      message_id TEXT NOT NULL DEFAULT '',
      team TEXT NOT NULL DEFAULT 'default',
      amount_usd NUMERIC(12, 4) NOT NULL DEFAULT '0.0000',
      channel TEXT NOT NULL DEFAULT 'email',
      provider_id TEXT NOT NULL DEFAULT 'ses',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at);

    ALTER TABLE budget_ledger ALTER COLUMN tenant_id DROP NOT NULL;
    ALTER TABLE budget_ledger ALTER COLUMN amount DROP NOT NULL;
    ALTER TABLE budget_ledger ADD COLUMN IF NOT EXISTS message_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE budget_ledger ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE budget_ledger ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(12, 4) NOT NULL DEFAULT '0.0000';
    ALTER TABLE budget_ledger ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';
    ALTER TABLE budget_ledger ADD COLUMN IF NOT EXISTS provider_id TEXT NOT NULL DEFAULT 'ses';

    CREATE TABLE IF NOT EXISTS suppressions (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL DEFAULT 'recipient',
      identifier_type TEXT NOT NULL DEFAULT 'email',
      identifier_hash TEXT NOT NULL DEFAULT '',
      team TEXT NOT NULL DEFAULT 'default',
      category TEXT,
      country TEXT,
      channel TEXT,
      reason TEXT NOT NULL,
      starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      ends_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    ALTER TABLE suppressions ALTER COLUMN tenant_id DROP NOT NULL;
    ALTER TABLE suppressions ALTER COLUMN recipient DROP NOT NULL;
    ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'recipient';
    ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS identifier_type TEXT NOT NULL DEFAULT 'email';
    ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS identifier_hash TEXT NOT NULL DEFAULT '';
    ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
    ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP WITH TIME ZONE;

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT NOT NULL,
      public_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      team TEXT NOT NULL,
      category TEXT NOT NULL,
      country TEXT NOT NULL,
      campaign_id TEXT,
      state TEXT NOT NULL DEFAULT 'accepted',
      priority TEXT NOT NULL DEFAULT 'normal',
      is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
      recipients JSONB NOT NULL,
      channels JSONB NOT NULL,
      fallback JSONB,
      metadata JSONB,
      scheduled_at TIMESTAMP WITH TIME ZONE,
      expires_at TIMESTAMP WITH TIME ZONE,
      cancelled_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at);

    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS message_attempts (
      id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      recipient_index INT NOT NULL DEFAULT 0,
      attempt_no INT NOT NULL,
      origin TEXT NOT NULL DEFAULT 'initial',
      state TEXT NOT NULL,
      provider_message_id TEXT,
      error_category TEXT,
      error_code TEXT,
      error_message TEXT,
      provider_metadata JSONB,
      queued_at TIMESTAMP WITH TIME ZONE,
      started_at TIMESTAMP WITH TIME ZONE,
      provider_accepted_at TIMESTAMP WITH TIME ZONE,
      delivered_at TIMESTAMP WITH TIME ZONE,
      opened_at TIMESTAMP WITH TIME ZONE,
      read_at TIMESTAMP WITH TIME ZONE,
      failed_at TIMESTAMP WITH TIME ZONE,
      latency_ms INT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at);

    CREATE TABLE IF NOT EXISTS message_events (
      id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      attempt_id TEXT,
      channel TEXT,
      provider_id TEXT,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      metadata JSONB,
      occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    ) PARTITION BY RANGE (occurred_at);

    ALTER TABLE message_events ALTER COLUMN channel DROP NOT NULL;
    ALTER TABLE message_events ALTER COLUMN provider_id DROP NOT NULL;

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      shard_id INT NOT NULL DEFAULT 0,
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending',
      available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      attempts INT NOT NULL DEFAULT 0,
      locked_at TIMESTAMP WITH TIME ZONE,
      processed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    ALTER TABLE outbox ADD COLUMN IF NOT EXISTS shard_id INT NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS report_hourly (
      id TEXT PRIMARY KEY,
      team TEXT NOT NULL,
      category TEXT NOT NULL,
      country TEXT NOT NULL,
      channel TEXT NOT NULL,
      hour TIMESTAMP WITH TIME ZONE NOT NULL,
      sent_count INT NOT NULL DEFAULT 0,
      delivered_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      opened_count INT NOT NULL DEFAULT 0,
      read_count INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      team TEXT NOT NULL,
      total_count INT NOT NULL,
      sent_count INT NOT NULL DEFAULT 0,
      delivered_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing',
      metadata JSONB,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      team TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events JSONB NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      status_code INT,
      response_time_ms INT,
      error TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

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

    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_msg_created ON message_attempts (message_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_events_msg_occurred ON message_events (message_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_messages_state_created ON messages (state, created_at);
    CREATE INDEX IF NOT EXISTS idx_outbox_processed_cutoff ON outbox (state, processed_at);

  `);

  await ensureMonthlyPartitions();
  console.log('✅ Migration & partition initialization complete!');
}

if (import.meta.main) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
