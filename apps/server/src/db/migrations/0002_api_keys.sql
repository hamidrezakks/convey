-- Migration: 0002_api_keys
-- Canonical schema for api_keys

CREATE TABLE IF NOT EXISTS team_owners (
  team TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  UNIQUE (team, tenant_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  team TEXT NOT NULL DEFAULT 'default',
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'DEVELOPER',
  scope TEXT NOT NULL DEFAULT 'tenant',
  sandbox_only BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT api_keys_permissions_check CHECK (role IN ('ORG_ADMIN', 'DEVELOPER', 'SUPPORT_AGENT', 'AUDITOR') AND scope IN ('tenant', 'platform')),
  CONSTRAINT api_keys_team_owner_fk FOREIGN KEY (team, tenant_id) REFERENCES team_owners(team, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_team ON api_keys (tenant_id, team);
CREATE INDEX IF NOT EXISTS idx_api_keys_active_hash ON api_keys (key_hash) WHERE active = TRUE;

CREATE OR REPLACE FUNCTION enforce_api_key_team_owner() RETURNS trigger AS $$ BEGIN
  INSERT INTO team_owners (team, tenant_id) VALUES (NEW.team, NEW.tenant_id) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM team_owners WHERE team = NEW.team AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Team belongs to another tenant';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER api_key_team_owner BEFORE INSERT OR UPDATE OF team, tenant_id ON api_keys
FOR EACH ROW EXECUTE FUNCTION enforce_api_key_team_owner();
