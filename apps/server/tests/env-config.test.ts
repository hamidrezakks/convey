import { describe, expect, test } from 'bun:test';
import { DEFAULT_POSTGRES_DB, parseEnv, resolvePostgresConfig } from '../src/config/env';

describe('Environment Configuration - PostgreSQL Database Name Selection', () => {
  test('defaults POSTGRES_DB to db-convey when no env variables are passed', () => {
    const config = parseEnv({});
    expect(config.POSTGRES_DB).toBe(DEFAULT_POSTGRES_DB);
    expect(config.DATABASE_URL).toBe('postgres://user:password@localhost:5432/db-convey');
  });

  test('respects explicit POSTGRES_DB environment variable', () => {
    const config = parseEnv({ POSTGRES_DB: 'custom_convey_db' });
    expect(config.POSTGRES_DB).toBe('custom_convey_db');
    expect(config.DATABASE_URL).toBe('postgres://user:password@localhost:5432/custom_convey_db');
  });

  test('supports DB_NAME as fallback when POSTGRES_DB is not specified', () => {
    const config = parseEnv({ DB_NAME: 'fallback_convey_db' });
    expect(config.POSTGRES_DB).toBe('fallback_convey_db');
    expect(config.DATABASE_URL).toBe('postgres://user:password@localhost:5432/fallback_convey_db');
  });

  test('extracts POSTGRES_DB from DATABASE_URL if POSTGRES_DB is not explicitly passed', () => {
    const config = parseEnv({
      DATABASE_URL: 'postgres://admin:secret@pg.internal:5432/prod_messages_db',
    });
    expect(config.POSTGRES_DB).toBe('prod_messages_db');
    expect(config.DATABASE_URL).toBe('postgres://admin:secret@pg.internal:5432/prod_messages_db');
  });

  test('allows POSTGRES_DB to explicitly override database name inside DATABASE_URL', () => {
    const config = parseEnv({
      DATABASE_URL: 'postgres://admin:secret@pg.internal:5432/original_db',
      POSTGRES_DB: 'overridden_db',
    });
    expect(config.POSTGRES_DB).toBe('overridden_db');
    expect(config.DATABASE_URL).toBe('postgres://admin:secret@pg.internal:5432/overridden_db');
  });

  test('allows DB_NAME to explicitly override database name inside DATABASE_URL', () => {
    const config = parseEnv({
      DATABASE_URL: 'postgres://admin:secret@pg.internal:5432/original_db',
      DB_NAME: 'override_via_db_name',
    });
    expect(config.POSTGRES_DB).toBe('override_via_db_name');
    expect(config.DATABASE_URL).toBe('postgres://admin:secret@pg.internal:5432/override_via_db_name');
  });

  test('handles non-standard database connection strings gracefully in resolvePostgresConfig', () => {
    const nonStandardUrl = 'invalid-url-string-connection';
    const res = resolvePostgresConfig({ DATABASE_URL: nonStandardUrl, POSTGRES_DB: 'my_socket_db' });
    expect(res.postgresDb).toBe('my_socket_db');
    expect(res.databaseUrl).toBe(nonStandardUrl);
  });
});

test('production rejects missing, short and legacy default encryption keys', () => {
  for (const key of [undefined, 'short', 'default_secret_key_32_bytes_len_!']) {
    expect(() => parseEnv({ NODE_ENV: 'production', PAYLOAD_ENCRYPTION_KEY: key })).toThrow('PAYLOAD_ENCRYPTION_KEY');
  }
  expect(
    parseEnv({ NODE_ENV: 'production', PAYLOAD_ENCRYPTION_KEY: 'test-only-configured-key-of-at-least-32-characters' })
      .NODE_ENV,
  ).toBe('production');
});
