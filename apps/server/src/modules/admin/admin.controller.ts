import type { Channel, MessageStatus, SuppressionReason } from '@convey/shared';
import type { Elysia } from 'elysia';
import { jsonResponse } from '../messaging/messaging.controller';
import { adminService } from './admin.service';

export function adminController(app: Elysia) {
  return app.group('/v1/admin', (app) =>
    app
      // Overview metrics
      .get('/overview', async () => {
        const overview = await adminService.getOverview();
        return jsonResponse(overview, 200);
      })

      // Real-time live telemetry snapshot
      .get('/telemetry/live', async () => {
        const snapshot = await adminService.getLiveTelemetrySnapshot();
        return jsonResponse(snapshot, 200);
      })

      // Messages explorer
      .get('/messages', async ({ query }: { query?: Record<string, string | undefined> }) => {
        const q = query || {};
        const result = await adminService.listMessages({
          page: q.page ? Number(q.page) : 1,
          limit: q.limit ? Number(q.limit) : 20,
          teamId: q.teamId,
          channel: q.channel as Channel | undefined,
          status: q.status as MessageStatus | undefined,
          search: q.search,
          startDate: q.startDate,
          endDate: q.endDate,
        });
        return jsonResponse(result, 200);
      })

      // Message details & trace waterfall
      .get('/messages/:id', async ({ params }: { params: { id: string } }) => {
        try {
          const details = await adminService.getMessageDetails(params.id);
          if (!details) {
            return jsonResponse({ error: 'Message not found' }, 404);
          }
          return jsonResponse(details, 200);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          return jsonResponse({ error: errMsg }, 500);
        }
      })

      // Provider matrix & circuit breaker cockpit
      .get('/providers', async () => {
        const providers = await adminService.listProviders();
        return jsonResponse(providers, 200);
      })

      // Circuit breaker manual override
      .post(
        '/providers/:providerId/circuit',
        async ({
          params,
          body,
        }: {
          params: { providerId: string };
          body: { action?: 'CLOSE' | 'FORCE_OPEN' | 'FORCE_HALF_OPEN'; rampPercentage?: number };
        }) => {
          const action = body?.action || 'FORCE_HALF_OPEN';
          const rampPercentage = body?.rampPercentage || 20;
          const res = await adminService.setProviderCircuitState(params.providerId, action, rampPercentage);
          return jsonResponse(res, 200);
        },
      )

      // Trigger synthetic canary probe
      .post('/providers/:providerId/canary', async ({ params }: { params: { providerId: string } }) => {
        const res = await adminService.triggerCanaryProbe(params.providerId);
        return jsonResponse(res, 200);
      })

      // Dead-Letter Queue (DLQ) & Replay Simulator
      .post('/dlq/replay', async ({ body }: { body: { dryRun?: boolean } }) => {
        const res = await adminService.replayDlq(body || {});
        return jsonResponse(res, 200);
      })

      // Suppressions
      .get('/suppressions', async ({ query }: { query?: Record<string, string | undefined> }) => {
        const list = await adminService.listSuppressions(query?.search);
        return jsonResponse(list, 200);
      })

      .post(
        '/suppressions',
        async ({
          body,
        }: {
          body: { teamId?: string; recipient: string; channel?: string; reason?: string };
        }) => {
          const res = await adminService.addSuppression({
            teamId: body.teamId || 'default_team',
            recipient: body.recipient,
            channel: (body.channel || 'EMAIL') as Channel,
            reason: (body.reason || 'MANUAL_BLOCK') as SuppressionReason,
          });
          return jsonResponse(res, 200);
        },
      )

      .delete('/suppressions/:id', async ({ params }: { params: { id: string } }) => {
        const res = await adminService.removeSuppression(params.id);
        return jsonResponse(res, 200);
      })

      // Policies
      .get('/policies', async () => {
        const policies = await adminService.listPolicies();
        return jsonResponse(policies, 200);
      })

      // Omnichannel composer sandbox test send
      .post(
        '/composer/send-test',
        async ({
          body,
        }: {
          body: { channel: Channel; recipient: string; payload: Record<string, unknown>; teamId?: string };
        }) => {
          const res = await adminService.sendTestMessage(body || {});
          return jsonResponse(res, 200);
        },
      )

      // --- Provider Setup & Registration Studio Endpoints ---
      .get('/providers/catalog', () => {
        const catalog = adminService.getProviderCatalog();
        return jsonResponse(catalog, 200);
      })

      .get('/providers/configured', async () => {
        const configured = await adminService.getConfiguredProviders();
        return jsonResponse(configured, 200);
      })

      .post(
        '/providers/register',
        async ({
          body,
        }: {
          body: {
            providerId: string;
            channel: Channel;
            credentials: Record<string, string>;
            config?: Record<string, unknown>;
            isPrimary?: boolean;
            priority?: number;
            weight?: number;
            fallbackProviderId?: string;
          };
        }) => {
          const res = await adminService.registerProvider(body);
          return jsonResponse(res, 200);
        },
      )

      .delete('/providers/configured/:id', async ({ params }: { params: { id: string } }) => {
        const res = await adminService.deleteConfiguredProvider(params.id);
        return jsonResponse(res, 200);
      })

      .post(
        '/providers/test-connection',
        async ({
          body,
        }: {
          body: { providerId: string; credentials: Record<string, string> };
        }) => {
          const res = adminService.testProviderConnection(body.providerId, body.credentials || {});
          return jsonResponse(res, 200);
        },
      )

      .post('/providers/seed-all', async () => {
        const res = await adminService.seedAllProviders();
        return jsonResponse(res, 200);
      })

      .get('/providers/env-export', () => {
        const exported = adminService.exportEnvVariables();
        return jsonResponse(exported, 200);
      }),
  );
}
