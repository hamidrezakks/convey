import { and, eq } from 'drizzle-orm';
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
      const sandboxMsgs = await db
        .select()
        .from(messages)
        .where(and(eq(messages.team, auth.team), eq(messages.isSandbox, true)))
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
      const result = await db
        .delete(messages)
        .where(and(eq(messages.team, auth.team), eq(messages.isSandbox, true)))
        .returning({ id: messages.id });

      return {
        success: true,
        count: result.length,
      };
    },
  );
