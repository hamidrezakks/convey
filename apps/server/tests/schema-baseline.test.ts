import { afterAll, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SQL } from 'bun';
import { env } from '../src/config/env';
import { queryClient } from '../src/db';
import { baselineFingerprint, initializeSchemaBaseline } from '../src/db/schema-baseline';

const schemas: string[] = [];
async function isolated() {
  if (env.NODE_ENV !== 'test' || !/test|hardening/.test(env.POSTGRES_DB))
    throw new Error('Disposable test database required');
  const schema = `baseline_${crypto.randomUUID().replaceAll('-', '')}`;
  await queryClient.unsafe(`CREATE SCHEMA ${schema}`);
  schemas.push(schema);
  return new SQL(env.DATABASE_URL, { connection: { search_path: schema }, max: 1 });
}
afterAll(async () => {
  for (const schema of schemas) await queryClient.unsafe(`DROP SCHEMA ${schema} CASCADE`);
});
const sources = [{ name: 'fixture.sql', sql: 'CREATE TABLE item (id text PRIMARY KEY)' }];

test('the canonical pre-release baseline contains no ALTER TABLE patches', () => {
  const dir = join(import.meta.dir, '../src/db/migrations');
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  expect(baselineFingerprint(files.map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') })))).toHaveLength(
    64,
  );
  expect(() => baselineFingerprint([{ name: 'patch.sql', sql: 'ALTER TABLE item ADD x int;' }])).toThrow(
    'define tables directly',
  );
});
test('fresh initialization is repeatable and rejects changed baselines without losing data', async () => {
  const client = await isolated();
  try {
    await Promise.all([initializeSchemaBaseline(client, sources), initializeSchemaBaseline(client, sources)]);
    await client`INSERT INTO item VALUES ('preserved')`;
    await initializeSchemaBaseline(client, sources);
    await expect(
      initializeSchemaBaseline(client, [{ name: 'changed.sql', sql: 'CREATE TABLE other(id text)' }]),
    ).rejects.toThrow('schema changed');
    expect((await client`SELECT id FROM item`)[0].id).toBe('preserved');
  } finally {
    await client.close();
  }
});
test('unmarked installations are rejected without modification', async () => {
  const client = await isolated();
  try {
    await client`CREATE TABLE existing (id text)`;
    await client`INSERT INTO existing VALUES ('preserved')`;
    await expect(initializeSchemaBaseline(client, sources)).rejects.toThrow('not empty');
    expect((await client`SELECT id FROM existing`)[0].id).toBe('preserved');
    expect((await client`SELECT to_regclass('item') AS name`)[0].name).toBeNull();
  } finally {
    await client.close();
  }
});
test('a failed baseline rolls back every table', async () => {
  const client = await isolated();
  try {
    await expect(
      initializeSchemaBaseline(client, [...sources, { name: 'broken.sql', sql: 'invalid SQL' }]),
    ).rejects.toThrow();
    expect((await client`SELECT to_regclass('item') AS name`)[0].name).toBeNull();
    await initializeSchemaBaseline(client, sources);
  } finally {
    await client.close();
  }
});
