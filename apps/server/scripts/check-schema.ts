import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { baselineFingerprint } from '../src/db/schema-baseline';

const serverRoot = join(import.meta.dir, '..');
const canonical = join(serverRoot, 'src/db/migrations');
const sources = readdirSync(canonical)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(join(canonical, name), 'utf8') }));
if (existsSync(join(serverRoot, 'drizzle')))
  throw new Error(
    'Pre-release schema has one source: edit canonical CREATE definitions, not generated upgrade history',
  );
const fingerprint = baselineFingerprint(sources);
const plugins = readFileSync(join(serverRoot, '../plugins/src/db/index.ts'), 'utf8');
if (/\bALTER\s+TABLE\b/i.test(plugins))
  throw new Error('Plugin schema must declare current constraints in CREATE TABLE');
console.log(`Validated ${sources.length} canonical schema files and plugin definitions (${fingerprint.slice(0, 12)})`);
