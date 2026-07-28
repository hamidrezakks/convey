import { Elysia, t } from 'elysia';
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
        summary: 'Initialize batch dispatch context',
        description: 'Creates a high-throughput atomic batch dispatches tracking context with Redis counter caching.',
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
        summary: 'List batch dispatches for team',
        description: 'Retrieves all batch dispatches belonging to the authenticated tenant and team.',
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
        summary: 'Get real-time batch metrics and ETA analytics',
        description: 'Fetches atomic Redis live stats, percentage completed, throughput msg/sec, and ETA.',
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
        summary: 'Pause active batch dispatch',
        description: 'Temporarily pauses an active batch dispatch pipeline.',
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
        summary: 'Resume paused batch dispatch',
        description: 'Resumes a previously paused batch dispatch pipeline.',
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
        summary: 'Cancel batch dispatch',
        description: 'Cancels an active or paused batch dispatch pipeline.',
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
