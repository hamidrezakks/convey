import { and, eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '../../db';
import { messages } from '../../db/schema';
import {
  CommonHeaders,
  StandardSecurityRequirement,
} from '../../openapi/openapi.docs';
import { authMiddleware } from '../auth/auth.middleware';

export const sandboxController = new Elysia({ prefix: '/v1/sandbox' })
  .use(authMiddleware)
  .get(
    '/messages',
    {
      detail: {
        tags: ['Sandbox'],
        summary: 'List Sandbox Mock Dispatches for Team',
        description: 'Queries simulated sandbox test mode dispatches stored in the database for integration test validation.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        responses: {
          '200': {
            description: 'List of sandbox test messages',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    messages: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
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
        summary: 'Purge Sandbox Mock Dispatches for Team',
        description: 'Clears all sandbox simulation records for the authenticated tenant team.',
        security: StandardSecurityRequirement,
        headers: CommonHeaders,
        responses: {
          '200': {
            description: 'Purge result confirmation with count of deleted messages',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 12 },
                  },
                },
              },
            },
          },
        },
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
