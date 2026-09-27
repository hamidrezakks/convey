-- Team IDs are global routing identifiers, not tenant-local display names.
BEGIN;
CREATE TABLE IF NOT EXISTS team_owners (
  team TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  UNIQUE (team, tenant_id)
);
DO $$ BEGIN
  IF EXISTS (SELECT team FROM api_keys GROUP BY team HAVING COUNT(DISTINCT tenant_id) > 1) THEN
    RAISE EXCEPTION 'Ambiguous team ownership: assign distinct team IDs before migrating';
  END IF;
END $$;
INSERT INTO team_owners (team, tenant_id) SELECT DISTINCT team, tenant_id FROM api_keys ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION enforce_api_key_team_owner() RETURNS trigger AS $$ BEGIN
  INSERT INTO team_owners (team, tenant_id) VALUES (NEW.team, NEW.tenant_id) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM team_owners WHERE team = NEW.team AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Team belongs to another tenant';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS api_key_team_owner ON api_keys;
CREATE TRIGGER api_key_team_owner BEFORE INSERT OR UPDATE OF team, tenant_id ON api_keys
FOR EACH ROW EXECUTE FUNCTION enforce_api_key_team_owner();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_team_owner_fk') THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_team_owner_fk FOREIGN KEY (team, tenant_id) REFERENCES team_owners(team, tenant_id);
  END IF;
END $$;
COMMIT;
