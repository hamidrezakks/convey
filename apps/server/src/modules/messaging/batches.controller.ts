import { Elysia, t } from 'elysia';
import {
  CommonHeaders,
  StandardResponseExamples,
  StandardSecurityRequirement,
} from '../../openapi/openapi.docs';
import { authMiddleware } from '../auth/auth.middleware';
import { BatchesService } from './batches.service';

export const batchesController = new Elysia({ prefix: '/v1/batches' })
  .use(authMiddleware)
  .post(
    '/',
    {
      body: t.Object({
        totalCount: t.Number({ minimum: 1, description: 'Total number of items in bulk dispatch' }),
        metadata: t.Optional(t.Record(t.String(), t.Unknown(), { description: 'Custom batch metadata and labels' })),
      }),
      detail: {
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
    },
    async ({ body, auth, set }) => {
      const batch = await BatchesService.createBatch({
        tenantId: auth.tenantId,
        team: auth.team,
        totalCount: body.totalCount,
        metadata: body.metadata,
      });

      set.status = 201;
      return {
        success: true,
        batch,
      };
    },
  )
  .get(
    '/',
    {
      detail: {
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
    },
    async ({ auth }) => {
      const list = await BatchesService.listBatches(auth.tenantId, auth.team);
      return {
        success: true,
        batches: list,
      };
    },
  )
  .get(
    '/:batchId',
    {
      params: t.Object({
        batchId: t.String({ description: 'Opaque batch identifier (batch_<ULID>)' }),
      }),
      detail: {
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
    },
    async ({ params, auth, set }) => {
      const batch = await BatchesService.getBatch(auth.tenantId, auth.team, params.batchId);
      if (!batch) {
        set.status = 404;
        return { success: false, error: 'Batch not found' };
      }
      return { success: true, batch };
    },
  )
  .post(
    '/:batchId/pause',
    {
      params: t.Object({
        batchId: t.String({ description: 'Opaque batch identifier (batch_<ULID>)' }),
      }),
      detail: {
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
    },
    async ({ params, auth, set }) => {
      const updated = await BatchesService.pauseBatch(auth.tenantId, auth.team, params.batchId);
      if (!updated) {
        set.status = 404;
        return { success: false, error: 'Batch not found or cannot be paused' };
      }
      return { success: true, batch: updated };
    },
  )
  .post(
    '/:batchId/resume',
    {
      params: t.Object({
        batchId: t.String({ description: 'Opaque batch identifier (batch_<ULID>)' }),
      }),
      detail: {
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
    },
    async ({ params, auth, set }) => {
      const updated = await BatchesService.resumeBatch(auth.tenantId, auth.team, params.batchId);
      if (!updated) {
        set.status = 404;
        return { success: false, error: 'Batch not found or cannot be resumed' };
      }
      return { success: true, batch: updated };
    },
  )
  .post(
    '/:batchId/cancel',
    {
      params: t.Object({
        batchId: t.String({ description: 'Opaque batch identifier (batch_<ULID>)' }),
      }),
      detail: {
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
    },
    async ({ params, auth, set }) => {
      const updated = await BatchesService.cancelBatch(auth.tenantId, auth.team, params.batchId);
      if (!updated) {
        set.status = 404;
        return { success: false, error: 'Batch not found or cannot be cancelled' };
      }
      return { success: true, batch: updated };
    },
  );
