import { CommonHeaders, StandardSecurityRequirement } from './openapi.docs';

export const SandboxDocs = {
  listMessages: {
    tags: ['Sandbox'],
    summary: 'List Sandbox Mock Dispatches for Team',
    description:
      'Queries simulated sandbox test mode dispatches stored in the database for integration test validation.',
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

  deleteMessages: {
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
};
