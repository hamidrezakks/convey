import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { queryClient } from './index';
import { ensureMonthlyPartitions } from './partitions';

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

  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file);
    const sqlContent = readFileSync(filePath, 'utf-8');

    const startTime = performance.now();
    try {
      await queryClient.unsafe(sqlContent);
      const elapsed = (performance.now() - startTime).toFixed(2);
      console.log(`  ✓ Applied migration ${file} (${elapsed}ms)`);
    } catch (err) {
      console.error(`  ✗ Failed to apply migration ${file}:`, err);
      throw err;
    }
  }

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
