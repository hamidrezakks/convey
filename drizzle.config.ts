import { defineConfig } from 'drizzle-kit';
import { parseEnv } from './src/config/env';

const configEnv = parseEnv();

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: configEnv.DATABASE_URL,
  },
});
