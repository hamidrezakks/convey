import { and, eq, gte, lte } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '../../db';
import { messages } from '../../db/schema';
import { SandboxDocs } from '../../openapi';
import { authMiddleware } from '../auth/auth.middleware';

export const sandboxController = new Elysia({ prefix: '/v1/sandbox' })
  .use(authMiddleware)
  .get(
    '/messages',
    {
      detail: SandboxDocs.listMessages,
    },
    async ({ auth }) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400 * 1000);
      const sandboxMsgs = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.team, auth.team),
            eq(messages.isSandbox, true),
            gte(messages.createdAt, thirtyDaysAgo),
            lte(messages.createdAt, now),
          ),
        )
        .limit(100);

      return {
        messages: sandboxMsgs,
      };
    },
  )
  .delete(
    '/messages',
    {
      detail: SandboxDocs.deleteMessages,
    },
    async ({ auth }) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400 * 1000);
      const result = await db
        .delete(messages)
        .where(
          and(
            eq(messages.team, auth.team),
            eq(messages.isSandbox, true),
            gte(messages.createdAt, thirtyDaysAgo),
            lte(messages.createdAt, now),
          ),
        )
        .returning({ id: messages.id });

      return {
        success: true,
        count: result.length,
      };
    },
  );
