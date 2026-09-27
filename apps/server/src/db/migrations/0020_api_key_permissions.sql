-- Existing keys retain tenant send access; no key is automatically promoted to platform admin.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'DEVELOPER';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'tenant';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS sandbox_only BOOLEAN NOT NULL DEFAULT FALSE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_permissions_check') THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_permissions_check CHECK (
      role IN ('ORG_ADMIN', 'DEVELOPER', 'SUPPORT_AGENT', 'AUDITOR') AND scope IN ('tenant', 'platform')
    );
  END IF;
END $$;
