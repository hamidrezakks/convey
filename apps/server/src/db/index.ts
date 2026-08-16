import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { env } from '../config/env';
import * as schema from './schema';

export const queryClient = new SQL(env.DATABASE_URL, {
  max: env.DB_MAX_CONNECTIONS,
  idleTimeout: 30,
  connectTimeout: 10,
});

export const db = drizzle({ client: queryClient, schema });
export { schema };
