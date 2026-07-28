import { and, eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '../../db';
import { messages } from '../../db/schema';
import { authMiddleware } from '../auth/auth.middleware';

export const sandboxController = new Elysia({ prefix: '/v1/sandbox' })
  .use(authMiddleware)
  .get(
    '/messages',
    {
      detail: {
        tags: ['Sandbox'],
        summary: 'List sandbox test mode dispatches',
      },
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
      detail: {
        tags: ['Sandbox'],
        summary: 'Clear sandbox test mode dispatches for team',
      },
    },
    async ({ auth }) => {
      const deleted = await db
        .delete(messages)
        .where(and(eq(messages.team, auth.team), eq(messages.isSandbox, true)))
        .returning();

      return {
        success: true,
        count: deleted.length,
      };
    },
  );
