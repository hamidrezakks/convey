import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql/postgres';
import { env } from '../config/env';
import * as schema from './schema';

export const queryClient = new SQL(env.DATABASE_URL, {
  max: env.DB_MAX_CONNECTIONS,
  idleTimeout: 30,
  connectTimeout: 10,
});

// biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM Bun-SQL driver config overload workaround
export const db = drizzle({ client: queryClient, schema } as any);
export type Database = typeof db;
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export { schema };
