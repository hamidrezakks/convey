import { z } from 'zod';

export const DEFAULT_POSTGRES_DB = 'db-convey';
export const DEFAULT_POSTGRES_URL_TEMPLATE = 'postgres://user:password@localhost:5432';

/**
 * Resolves effective PostgreSQL database name and connection URL based on environment inputs.
 * Precedence:
 * 1. Explicit `POSTGRES_DB` environment variable overrides database name.
 * 2. If `DATABASE_URL` is set without explicit DB name override, database name is extracted from the URL pathname.
 * 3. Fallbacks to `DEFAULT_POSTGRES_DB` ('db-convey').
 */
export function resolvePostgresConfig(rawEnv: Record<string, string | undefined>): {
  postgresDb: string;
  databaseUrl: string;
} {
  const explicitDb = rawEnv.POSTGRES_DB;
  const rawUrl = rawEnv.DATABASE_URL;

  if (!rawUrl) {
    const postgresDb = explicitDb || DEFAULT_POSTGRES_DB;
    return {
      postgresDb,
      databaseUrl: `${DEFAULT_POSTGRES_URL_TEMPLATE}/${postgresDb}`,
    };
  }

  try {
    const url = new URL(rawUrl);
    if (explicitDb) {
      url.pathname = `/${explicitDb}`;
      return {
        postgresDb: explicitDb,
        databaseUrl: url.toString(),
      };
    }

    const extractedDb = url.pathname.replace(/^\//, '');
    const postgresDb = extractedDb || DEFAULT_POSTGRES_DB;
    return {
      postgresDb,
      databaseUrl: rawUrl,
    };
  } catch {
    // Return rawUrl as-is for non-standard connection strings (e.g. Unix socket paths)
    return {
      postgresDb: explicitDb || DEFAULT_POSTGRES_DB,
      databaseUrl: rawUrl,
    };
  }
}

export const envSchema = z.object({
  PAYLOAD_ENCRYPTION_KEY: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  POSTGRES_DB: z.string().min(1).default(DEFAULT_POSTGRES_DB),
  DATABASE_URL: z.string().min(1).default(`${DEFAULT_POSTGRES_URL_TEMPLATE}/${DEFAULT_POSTGRES_DB}`),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: z.string().default('convey'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  BULLMQ_SCHEDULING_HORIZON_SECONDS: z.coerce.number().default(1800),
  DB_MAX_CONNECTIONS: z.coerce.number().default(20),
  CONVEY_REQUIRE_AUTH: z
    .preprocess((v) => (v === undefined ? true : v), z.enum(['true', 'false']).or(z.boolean()))
    .transform((v) => v === true || v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(rawEnv: Record<string, string | undefined> = process.env): Env {
  const { postgresDb, databaseUrl } = resolvePostgresConfig(rawEnv);

  const envToParse = {
    ...rawEnv,
    POSTGRES_DB: postgresDb,
    DATABASE_URL: databaseUrl,
  };

  const result = envSchema.safeParse(envToParse);
  if (!result.success) {
    const formattedErrors = JSON.stringify(result.error.format(), null, 2);
    console.error(`❌ Invalid environment configuration:\n${formattedErrors}`);
    throw new Error('Invalid environment configuration');
  }

  if (result.data.NODE_ENV === 'production' && !result.data.CONVEY_REQUIRE_AUTH) {
    throw new Error('CONVEY_REQUIRE_AUTH cannot be disabled in production');
  }
  if (
    result.data.NODE_ENV === 'production' &&
    (!result.data.PAYLOAD_ENCRYPTION_KEY ||
      result.data.PAYLOAD_ENCRYPTION_KEY.length < 32 ||
      result.data.PAYLOAD_ENCRYPTION_KEY === 'default_secret_key_32_bytes_len_!')
  ) {
    throw new Error('Production requires a unique PAYLOAD_ENCRYPTION_KEY of at least 32 characters');
  }
  return result.data;
}

export const env = parseEnv();
