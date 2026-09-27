import { createHash } from 'node:crypto';
import type { SQL } from 'bun';

export interface SchemaSource {
  name: string;
  sql: string;
}

export function baselineFingerprint(sources: SchemaSource[]): string {
  if (!sources.length) throw new Error('Canonical schema is empty');
  for (const source of sources) {
    const statements = source.sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/\bALTER\s+TABLE\b/i.test(statements)) {
      throw new Error(`Pre-release schema must define tables directly: ${source.name}`);
    }
  }
  return createHash('sha256').update(JSON.stringify(sources)).digest('hex');
}

/** Initialize only an empty schema, or accept the exact same baseline. Never upgrade or erase data. */
export async function initializeSchemaBaseline(client: SQL, sources: SchemaSource[]): Promise<void> {
  const fingerprint = baselineFingerprint(sources);
  await client.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(current_schema(), 24002))`;
    const [marker] = await tx`SELECT to_regclass(format('%I.convey_schema_baseline', current_schema())) AS name`;
    if (marker.name) {
      const [current] = await tx`SELECT fingerprint FROM convey_schema_baseline WHERE id = 1`;
      if (current?.fingerprint !== fingerprint) {
        throw new Error(
          'Pre-release schema changed. Recreate the disposable development/test database explicitly; in-place upgrades are not supported before the first release.',
        );
      }
      return;
    }
    const [existing] = await tx`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = current_schema()`;
    if (existing.count > 0) {
      throw new Error(
        'Database is not empty and has no current schema baseline. Use a fresh database; no pre-release data upgrade is provided.',
      );
    }
    for (const source of sources) await tx.unsafe(source.sql);
    await tx`CREATE TABLE convey_schema_baseline (id integer PRIMARY KEY CHECK (id = 1), fingerprint text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await tx`INSERT INTO convey_schema_baseline (id, fingerprint) VALUES (1, ${fingerprint})`;
  });
}
