import { Elysia, t } from 'elysia';
import { BatchesDocs } from '../../openapi';
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
      detail: BatchesDocs.createBatch,
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
      detail: BatchesDocs.listBatches,
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
        batchId: t.String({ description: 'Public batch identifier (`batch_<ULID>`)' }),
      }),
      detail: BatchesDocs.getBatch,
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
        batchId: t.String({ description: 'Public batch identifier (`batch_<ULID>`)' }),
      }),
      detail: BatchesDocs.pauseBatch,
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
        batchId: t.String({ description: 'Public batch identifier (`batch_<ULID>`)' }),
      }),
      detail: BatchesDocs.resumeBatch,
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
        batchId: t.String({ description: 'Public batch identifier (`batch_<ULID>`)' }),
      }),
      detail: BatchesDocs.cancelBatch,
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
