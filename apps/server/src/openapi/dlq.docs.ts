import { CommonHeaders, StandardResponseExamples, StandardSecurityRequirement } from './openapi.docs';

export const DlqDocs = {
  listFailedMessages: {
    tags: ['Dead Letter Queue (DLQ)'],
    summary: 'List DLQ Failed Messages',
    description:
      'Queries dead-lettered message records with error classifications, failure categories, and attempt counts.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    parameters: [
      {
        name: 'team',
        in: 'query',
        required: false,
        description: 'Filter by tenant team',
        schema: { type: 'string', example: 'payments' },
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        description: 'Number of records (max 200)',
        schema: { type: 'integer', default: 50, example: 50 },
      },
      {
        name: 'offset',
        in: 'query',
        required: false,
        description: 'Pagination offset',
        schema: { type: 'integer', default: 0, example: 0 },
      },
    ],
    responses: {
      '200': {
        description: 'DLQ failed message records',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                total: { type: 'integer', example: 1 },
                messages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      messageId: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
                      team: { type: 'string', example: 'payments' },
                      userId: { type: 'string', example: 'usr_99182' },
                      failedAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:00.000Z' },
                      lastError: {
                        type: 'object',
                        properties: {
                          code: { type: 'string', example: 'PROVIDER_TIMEOUT' },
                          category: { type: 'string', example: 'transient' },
                          message: { type: 'string', example: 'Gateway timeout waiting for upstream vendor' },
                          providerId: { type: 'string', example: 'twilio' },
                          attemptNo: { type: 'integer', example: 3 },
                        },
                      },
                    },
                  },
                },
              },
            },
            examples: {
              dlq_list: {
                summary: 'DLQ Query Results',
                value: {
                  total: 1,
                  messages: [
                    {
                      messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3',
                      team: 'payments',
                      userId: 'usr_99182',
                      failedAt: '2026-08-21T10:00:00.000Z',
                      lastError: {
                        code: 'PROVIDER_TIMEOUT',
                        category: 'transient',
                        message: 'Gateway timeout waiting for upstream vendor',
                        providerId: 'twilio',
                        attemptNo: 3,
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid Query Parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: { validation_error: StandardResponseExamples.bad_request_validation },
          },
        },
      },
    },
  },

  replayFailedMessages: {
    tags: ['Dead Letter Queue (DLQ)'],
    summary: 'Replay Failed Messages from DLQ',
    description:
      'Resets dead-lettered message statuses to `accepted` and atomically re-enqueues them into the transactional outbox pipeline.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: true,
      description: 'Array of public ULID message identifiers to replay',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/DlqReplayRequest' },
          examples: {
            replay_request: {
              summary: 'Batch Replay Request',
              value: { messageIds: ['msg_01J0N7C0W7X2R6S8V9Q9B1E4G3'] },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Replay execution summary',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                replayedCount: { type: 'integer', example: 1 },
                replayedIds: { type: 'array', items: { type: 'string' }, example: ['msg_01J0N7C0W7X2R6S8V9Q9B1E4G3'] },
              },
            },
            examples: {
              replay_success: {
                summary: 'Replayed Messages',
                value: { replayedCount: 1, replayedIds: ['msg_01J0N7C0W7X2R6S8V9Q9B1E4G3'] },
              },
            },
          },
        },
      },
      '400': {
        description: 'Empty or invalid messageIds array',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: { validation_error: StandardResponseExamples.bad_request_validation },
          },
        },
      },
    },
  },

  replayMutatedMessages: {
    tags: ['Dead Letter Queue (DLQ)'],
    summary: 'Mutated DLQ Replay with Payload Overrides',
    description:
      'Replays failed messages with dynamic mutation overrides (e.g. corrected recipient address or alternative provider routing).',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: true,
      description: 'Mutated replay payload with message IDs and patch specifications',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/DlqMutatedReplayRequest' },
          examples: {
            mutated_replay: {
              summary: 'Mutated Replay with Recipient Patch',
              value: {
                messageIds: ['msg_01J0N7C0W7X2R6S8V9Q9B1E4G3'],
                mutations: {
                  recipients: { phone: '+971509998877' },
                  metadata: { replayedBy: 'devops_eng_01' },
                },
                dryRun: false,
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Mutated replay result summary',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                replayedCount: { type: 'integer', example: 1 },
                replayedIds: { type: 'array', items: { type: 'string' } },
                dryRun: { type: 'boolean', example: false },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid Mutated Replay Payload',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: { validation_error: StandardResponseExamples.bad_request_validation },
          },
        },
      },
    },
  },
};
