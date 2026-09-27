import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { queryClient } from './index';
import { ensureMonthlyPartitions } from './partitions';
import { initializeSchemaBaseline } from './schema-baseline';

/**
 * Runs canonical per-table database migrations and configures table partitions.
 */
export async function migrate() {
  console.log('🚀 Running canonical per-table database migrations...');

  const migrationsDir = join(import.meta.dirname, 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  console.log(`📁 Found ${migrationFiles.length} canonical migration files in ${migrationsDir}`);

  await initializeSchemaBaseline(
    queryClient,
    migrationFiles.map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), 'utf8') })),
  );

  console.log('🔧 Ensuring monthly range partitions (past 3 months to next 6 months)...');
  await ensureMonthlyPartitions(6, 3);

  console.log('✅ Canonical per-table migration & partition initialization complete!');
}

if (import.meta.main) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
