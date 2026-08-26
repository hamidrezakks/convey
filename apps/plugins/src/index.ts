import { cors } from '@elysia/cors';
import { Elysia } from 'elysia';
import { initializePluginTables } from './db';
import { inboxController } from './modules/inbox/inbox.controller';
import { preferencesController } from './modules/preferences/preferences.controller';

const port = Number(process.env.PLUGINS_PORT || 3001);

export const pluginsApp = new Elysia()
  .use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'traceparent'],
    }),
  )
  .get('/health', () => ({
    status: 'ok',
    service: '@convey/plugins',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }))
  .use(preferencesController)
  .use(inboxController);

if (process.env.NODE_ENV !== 'test' && import.meta.main) {
  initializePluginTables()
    .then(() => {
      pluginsApp.listen({ port, hostname: '0.0.0.0' });
      console.log(`🧩 Convey Plugins Service running at http://localhost:${port}`);
    })
    .catch((err) => {
      console.error('Fatal error during Plugins Service startup:', err);
      process.exit(1);
    });
}
