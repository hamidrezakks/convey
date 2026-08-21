import { CommonHeaders, StandardResponseExamples, StandardSecurityRequirement } from './openapi.docs';

export const BatchesDocs = {
  createBatch: {
    tags: ['Batches'],
    summary: 'Initialize Atomic Batch Dispatch Context',
    description: 'Creates a high-throughput atomic batch dispatches tracking context with Redis counter caching.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/BatchCreateRequest' },
          examples: {
            standard_batch: {
              summary: 'Initialize Bulk Campaign',
              value: {
                totalCount: 10000,
                metadata: { campaignName: 'Q3 Product Announcement', tags: ['marketing', 'vip'] },
              },
            },
          },
        },
      },
    },
    responses: {
      '201': {
        description: 'Batch context successfully created',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/BatchResponse' },
            examples: {
              created: {
                summary: 'Batch Created',
                value: {
                  success: true,
                  batch: {
                    id: 'batch_01J0N88XYZ1122334455667788',
                    status: 'processing',
                    totalCount: 10000,
                    processedCount: 0,
                    successCount: 0,
                    failedCount: 0,
                    progressPercent: 0,
                  },
                },
              },
            },
          },
        },
      },
      '400': {
        description: 'Validation Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: { validation_error: StandardResponseExamples.bad_request_validation },
          },
        },
      },
    },
  },

  listBatches: {
    tags: ['Batches'],
    summary: 'List Batch Dispatches for Team',
    description: 'Retrieves all batch dispatches belonging to the authenticated tenant and team.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'List of active and historical team batches',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                batches: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
  },

  getBatch: {
    tags: ['Batches'],
    summary: 'Get Real-Time Batch Metrics & ETA Analytics',
    description: 'Fetches atomic Redis live stats, percentage completed, throughput msg/sec, and ETA.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Real-time batch stats and completion ETA',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/BatchResponse' },
          },
        },
      },
      '404': {
        description: 'Batch Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },

  pauseBatch: {
    tags: ['Batches'],
    summary: 'Pause Active Batch Dispatch Pipeline',
    description: 'Temporarily pauses an active batch dispatch pipeline.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Batch successfully paused',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/BatchResponse' },
          },
        },
      },
      '404': {
        description: 'Batch Not Found or Cannot Be Paused',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },

  resumeBatch: {
    tags: ['Batches'],
    summary: 'Resume Paused Batch Dispatch Pipeline',
    description: 'Resumes a previously paused batch dispatch pipeline.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Batch successfully resumed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/BatchResponse' },
          },
        },
      },
      '404': {
        description: 'Batch Not Found or Cannot Be Resumed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },

  cancelBatch: {
    tags: ['Batches'],
    summary: 'Cancel Batch Dispatch Pipeline',
    description: 'Cancels an active or paused batch dispatch pipeline.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Batch successfully cancelled',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/BatchResponse' },
          },
        },
      },
      '404': {
        description: 'Batch Not Found or Cannot Be Cancelled',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },
};
