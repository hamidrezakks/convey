import type { Channel, MessageStatus, SuppressionReason } from '@convey/shared';
import type { Elysia } from 'elysia';
import { AdminDocs } from '../../openapi';
import { jsonResponse } from '../messaging/messaging.controller';
import { fxEngine } from '../policies/fx-engine';
import { ReportingService } from '../reports/reporting.service';
import { ReportingDoctorService } from '../reports/reporting-doctor.service';

import { adminService } from './admin.service';

export function adminController(app: Elysia) {
  return app.group('/v1/admin', (app) =>
    app

      // Overview metrics
      .get(
        '/overview',
        { detail: AdminDocs.overview },
        async ({
          query,
          headers,
        }: {
          query?: Record<string, string | undefined>;
          headers?: Record<string, string | undefined>;
        }) => {
          const isSandbox =
            query?.isSandbox === 'true' ||
            headers?.['x-convey-sandbox'] === 'true' ||
            headers?.['x-convey-environment'] === 'sandbox'
              ? true
              : query?.isSandbox === 'false' || headers?.['x-convey-environment'] === 'production'
                ? false
                : undefined;
          const overview = await adminService.getOverview(isSandbox);
          return jsonResponse(overview, 200);
        },
      )

      // Real-time live telemetry snapshot
      .get(
        '/telemetry/live',
        { detail: AdminDocs.telemetryLive },
        async ({
          query,
          headers,
        }: {
          query?: Record<string, string | undefined>;
          headers?: Record<string, string | undefined>;
        }) => {
          const isSandbox =
            query?.isSandbox === 'true' ||
            headers?.['x-convey-sandbox'] === 'true' ||
            headers?.['x-convey-environment'] === 'sandbox'
              ? true
              : query?.isSandbox === 'false' || headers?.['x-convey-environment'] === 'production'
                ? false
                : undefined;
          const snapshot = await adminService.getLiveTelemetrySnapshot(isSandbox);
          return jsonResponse(snapshot, 200);
        },
      )

      // Messages explorer
      .get(
        '/messages',
        { detail: AdminDocs.messagesExplorer },
        async ({
          query,
          headers,
        }: {
          query?: Record<string, string | undefined>;
          headers?: Record<string, string | undefined>;
        }) => {
          const q = query || {};
          const isSandbox =
            q.isSandbox === 'true' ||
            headers?.['x-convey-sandbox'] === 'true' ||
            headers?.['x-convey-environment'] === 'sandbox'
              ? true
              : q.isSandbox === 'false' || headers?.['x-convey-environment'] === 'production'
                ? false
                : undefined;

          const result = await adminService.listMessages({
            page: q.page ? Number(q.page) : 1,
            limit: q.limit ? Number(q.limit) : 20,
            teamId: q.teamId,
            channel: q.channel as Channel | undefined,
            status: q.status as MessageStatus | undefined,
            search: q.search,
            isSandbox,
            startDate: q.startDate,
            endDate: q.endDate,
          });
          return jsonResponse(result, 200);
        },
      )

      // Message details & trace waterfall
      .get('/messages/:id', { detail: AdminDocs.messageDetails }, async ({ params }: { params: { id: string } }) => {
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

      // Audit logs
      .get(
        '/audit-logs',
        { detail: AdminDocs.auditLogs },
        async ({ query }: { query?: Record<string, string | undefined> }) => {
          const q = query || {};
          const result = await adminService.listAuditLogs({
            page: q.page ? Number(q.page) : 1,
            limit: q.limit ? Number(q.limit) : 50,
            tenantId: q.tenantId,
            team: q.team,
            action: q.action,
          });
          return jsonResponse(result, 200);
        },
      )

      // Provider matrix & circuit breaker cockpit
      .get('/providers', { detail: AdminDocs.providersList }, async () => {
        const providers = await adminService.listProviders();
        return jsonResponse(providers, 200);
      })

      // Circuit breaker manual override
      .post(
        '/providers/:providerId/circuit',
        { detail: AdminDocs.circuitOverride },
        async ({ params, body }: { params: { providerId: string }; body: unknown }) => {
          const b = (body || {}) as { action?: 'CLOSE' | 'FORCE_OPEN' | 'FORCE_HALF_OPEN'; rampPercentage?: number };
          const action = b.action || 'FORCE_HALF_OPEN';
          const rampPercentage = b.rampPercentage || 20;
          const res = await adminService.setProviderCircuitState(params.providerId, action, rampPercentage);
          return jsonResponse(res, 200);
        },
      )

      // Trigger synthetic canary probe
      .post(
        '/providers/:providerId/canary',
        { detail: AdminDocs.canaryProbe },
        async ({ params }: { params: { providerId: string } }) => {
          const res = await adminService.triggerCanaryProbe(params.providerId);
          return jsonResponse(res, 200);
        },
      )

      // Dead-Letter Queue (DLQ) & Replay Simulator
      .post('/dlq/replay', { detail: AdminDocs.dlqReplay }, async ({ body }: { body: unknown }) => {
        const b = (body || {}) as { dryRun?: boolean };
        const res = await adminService.replayDlq(b);
        return jsonResponse(res, 200);
      })

      // Suppressions
      .get(
        '/suppressions',
        { detail: AdminDocs.suppressionsList },
        async ({ query }: { query?: Record<string, string | undefined> }) => {
          const list = await adminService.listSuppressions(query?.search);
          return jsonResponse(list, 200);
        },
      )

      .post('/suppressions', { detail: AdminDocs.suppressionsAdd }, async ({ body }: { body: unknown }) => {
        const b = (body || {}) as { teamId?: string; recipient?: string; channel?: string; reason?: string };
        const res = await adminService.addSuppression({
          teamId: b.teamId || 'default_team',
          recipient: b.recipient || '',
          channel: (b.channel || 'EMAIL') as Channel,
          reason: (b.reason || 'MANUAL_BLOCK') as SuppressionReason,
        });
        return jsonResponse(res, 200);
      })

      .delete(
        '/suppressions/:id',
        { detail: AdminDocs.suppressionsDelete },
        async ({ params }: { params: { id: string } }) => {
          const res = await adminService.removeSuppression(params.id);
          return jsonResponse(res, 200);
        },
      )

      // Policies
      .get('/policies', { detail: AdminDocs.policiesList }, async () => {
        const policies = await adminService.listPolicies();
        return jsonResponse(policies, 200);
      })

      // Omnichannel composer sandbox test send
      .post(
        '/composer/send-test',
        { detail: AdminDocs.composerSendTest },
        async ({ body, headers }: { body: unknown; headers?: Record<string, string | undefined> }) => {
          const b = (body || {}) as {
            channel?: Channel;
            recipient?: string;
            payload?: Record<string, unknown>;
            teamId?: string;
            isSandbox?: boolean;
          };
          const isSandbox =
            typeof b.isSandbox === 'boolean'
              ? b.isSandbox
              : headers?.['x-convey-sandbox'] === 'true' || headers?.['x-convey-environment'] === 'sandbox';

          const res = await adminService.sendTestMessage({
            channel: b.channel || ('EMAIL' as Channel),
            recipient: b.recipient || '',
            payload: b.payload || {},
            teamId: b.teamId,
            isSandbox,
          });
          return jsonResponse(res, 200);
        },
      )

      // --- Provider Setup & Registration Studio Endpoints ---
      .get('/providers/catalog', { detail: AdminDocs.providersCatalog }, () => {
        const catalog = adminService.getProviderCatalog();
        return jsonResponse(catalog, 200);
      })

      .get('/providers/configured', { detail: AdminDocs.providersConfigured }, async () => {
        const configured = await adminService.getConfiguredProviders();
        return jsonResponse(configured, 200);
      })

      .post('/providers/register', { detail: AdminDocs.providersRegister }, async ({ body }: { body: unknown }) => {
        const b = (body || {}) as {
          providerId?: string;
          channel?: Channel;
          credentials?: Record<string, string>;
          baseCurrency?: string;
          unitCost?: number;
          config?: Record<string, unknown>;
          isPrimary?: boolean;
          priority?: number;
          weight?: number;
          fallbackProviderId?: string;
        };
        const res = await adminService.registerProvider({
          providerId: b.providerId || '',
          channel: b.channel || ('EMAIL' as Channel),
          credentials: b.credentials || {},
          baseCurrency: b.baseCurrency,
          unitCost: b.unitCost,
          config: b.config,
          isPrimary: b.isPrimary,
          priority: b.priority,
          weight: b.weight,
          fallbackProviderId: b.fallbackProviderId,
        });
        return jsonResponse(res, 200);
      })

      .delete(
        '/providers/configured/:id',
        { detail: AdminDocs.providersDeleteConfigured },
        async ({ params }: { params: { id: string } }) => {
          const res = await adminService.deleteConfiguredProvider(params.id);
          return jsonResponse(res, 200);
        },
      )

      .post(
        '/providers/test-connection',
        { detail: AdminDocs.providersTestConnection },
        async ({ body }: { body: unknown }) => {
          const b = (body || {}) as {
            providerId?: string;
            credentials?: Record<string, string>;
            config?: Record<string, unknown>;
          };
          const res = await adminService.testProviderConnection(b.providerId || '', b.credentials || {}, b.config);
          return jsonResponse(res, 200);
        },
      )

      .post('/providers/test-proxy', async ({ body }: { body: unknown }) => {
        const b = (body || {}) as { proxy?: import('../providers/core/transport').ProviderProxyConfig };
        if (!b.proxy) {
          return jsonResponse({ success: false, error: 'No proxy configuration provided' }, 400);
        }
        const res = await adminService.testProxyConnection(b.proxy);
        return jsonResponse(res, 200);
      })

      .post('/providers/seed-all', { detail: AdminDocs.providersSeedAll }, async () => {
        const res = await adminService.seedAllProviders();
        return jsonResponse(res, 200);
      })

      .get('/providers/env-export', { detail: AdminDocs.providersEnvExport }, () => {
        const exported = adminService.exportEnvVariables();
        return jsonResponse(exported, 200);
      })

      .get('/currencies', () => {
        const rates = fxEngine.getAllRates();
        return jsonResponse({ base: 'USD', timestamp: new Date().toISOString(), currencies: rates }, 200);
      })

      // --- Multi-Dimension Reporting & Analytics Endpoints ---
      .get(
        '/reports/overview',
        { detail: AdminDocs.reportsOverview },
        async ({
          query,
          headers,
        }: {
          query?: Record<string, string | undefined>;
          headers?: Record<string, string | undefined>;
        }) => {
          const isSandbox =
            query?.isSandbox === 'true' ||
            headers?.['x-convey-sandbox'] === 'true' ||
            headers?.['x-convey-environment'] === 'sandbox'
              ? true
              : query?.isSandbox === 'false' || headers?.['x-convey-environment'] === 'production'
                ? false
                : undefined;
          const report = await ReportingService.getReportingOverview({
            startDate: query?.startDate,
            endDate: query?.endDate,
            teamId: query?.teamId,
            category: query?.category,
            campaignId: query?.campaignId,
            isSandbox,
          });
          return jsonResponse(report, 200);
        },
      )

      .get(
        '/reports/teams',
        { detail: AdminDocs.reportsTeams },
        async ({
          query,
          headers,
        }: {
          query?: Record<string, string | undefined>;
          headers?: Record<string, string | undefined>;
        }) => {
          const isSandbox =
            query?.isSandbox === 'true' ||
            headers?.['x-convey-sandbox'] === 'true' ||
            headers?.['x-convey-environment'] === 'sandbox'
              ? true
              : query?.isSandbox === 'false' || headers?.['x-convey-environment'] === 'production'
                ? false
                : undefined;
          const report = await ReportingService.getTeamReports({
            startDate: query?.startDate,
            endDate: query?.endDate,
            teamId: query?.teamId,
            isSandbox,
          });
          return jsonResponse(report, 200);
        },
      )

      .get(
        '/reports/categories',
        { detail: AdminDocs.reportsCategories },
        async ({
          query,
          headers,
        }: {
          query?: Record<string, string | undefined>;
          headers?: Record<string, string | undefined>;
        }) => {
          const isSandbox =
            query?.isSandbox === 'true' ||
            headers?.['x-convey-sandbox'] === 'true' ||
            headers?.['x-convey-environment'] === 'sandbox'
              ? true
              : query?.isSandbox === 'false' || headers?.['x-convey-environment'] === 'production'
                ? false
                : undefined;
          const report = await ReportingService.getCategoryReports({
            startDate: query?.startDate,
            endDate: query?.endDate,
            teamId: query?.teamId,
            category: query?.category,
            isSandbox,
          });
          return jsonResponse(report, 200);
        },
      )

      .get(
        '/reports/campaigns',
        { detail: AdminDocs.reportsCampaigns },
        async ({
          query,
          headers,
        }: {
          query?: Record<string, string | undefined>;
          headers?: Record<string, string | undefined>;
        }) => {
          const isSandbox =
            query?.isSandbox === 'true' ||
            headers?.['x-convey-sandbox'] === 'true' ||
            headers?.['x-convey-environment'] === 'sandbox'
              ? true
              : query?.isSandbox === 'false' || headers?.['x-convey-environment'] === 'production'
                ? false
                : undefined;
          const report = await ReportingService.getCampaignReports({
            search: query?.search,
            teamId: query?.teamId,
            category: query?.category,
            campaignId: query?.campaignId,
            startDate: query?.startDate,
            endDate: query?.endDate,
            page: query?.page ? Number(query.page) : 1,
            limit: query?.limit ? Number(query.limit) : 20,
            isSandbox,
          });
          return jsonResponse(report, 200);
        },
      )

      .get(
        '/reports/campaigns/:campaignId',
        { detail: AdminDocs.reportsCampaignDetails },
        async ({
          params,
          query,
          headers,
        }: {
          params: { campaignId: string };
          query?: Record<string, string | undefined>;
          headers?: Record<string, string | undefined>;
        }) => {
          const isSandbox =
            query?.isSandbox === 'true' ||
            headers?.['x-convey-sandbox'] === 'true' ||
            headers?.['x-convey-environment'] === 'sandbox'
              ? true
              : query?.isSandbox === 'false' || headers?.['x-convey-environment'] === 'production'
                ? false
                : undefined;
          const details = await ReportingService.getCampaignDetails(params.campaignId, { isSandbox });
          if (!details) {
            return jsonResponse({ error: 'Campaign not found' }, 404);
          }
          return jsonResponse(details, 200);
        },
      )

      .get(
        '/reports/export',
        { detail: AdminDocs.reportsExport },
        async ({
          query,
          headers,
        }: {
          query?: Record<string, string | undefined>;
          headers?: Record<string, string | undefined>;
        }) => {
          const type = (query?.type || 'campaigns') as 'teams' | 'categories' | 'campaigns' | 'overview';
          const format = (query?.format || 'csv') as 'csv' | 'json';
          const isSandbox =
            query?.isSandbox === 'true' ||
            headers?.['x-convey-sandbox'] === 'true' ||
            headers?.['x-convey-environment'] === 'sandbox'
              ? true
              : query?.isSandbox === 'false' || headers?.['x-convey-environment'] === 'production'
                ? false
                : undefined;

          const exported = await ReportingService.exportReport(type, format, {
            startDate: query?.startDate,
            endDate: query?.endDate,
            teamId: query?.teamId,
            category: query?.category,
            campaignId: query?.campaignId,
            isSandbox,
          });

          const filename = `convey_report_${type}_${new Date().toISOString().slice(0, 10)}.${format}`;
          return new Response(exported.content, {
            status: 200,
            headers: {
              'Content-Type': exported.contentType,
              'Content-Disposition': `attachment; filename="${filename}"`,
            },
          });
        },
      )

      // Reporting Doctor & Reconciliation Engine
      .post(
        '/reports/reconcile',
        { detail: AdminDocs.reportsReconcile },
        async ({
          body,
        }: {
          body?: {
            startDate?: string;
            endDate?: string;
            teamId?: string;
            category?: string;
            campaignId?: string;
          };
        }) => {
          const result = await ReportingDoctorService.reconcile({
            startDate: body?.startDate ? new Date(body.startDate) : undefined,
            endDate: body?.endDate ? new Date(body.endDate) : undefined,
            teamId: body?.teamId,
            category: body?.category,
            campaignId: body?.campaignId,
          });
          return jsonResponse(result, 200);
        },
      )
      .post(
        '/reports/doctor',
        { detail: AdminDocs.reportsReconcile },
        async ({
          body,
        }: {
          body?: {
            startDate?: string;
            endDate?: string;
            teamId?: string;
            category?: string;
            campaignId?: string;
          };
        }) => {
          const result = await ReportingDoctorService.reconcile({
            startDate: body?.startDate ? new Date(body.startDate) : undefined,
            endDate: body?.endDate ? new Date(body.endDate) : undefined,
            teamId: body?.teamId,
            category: body?.category,
            campaignId: body?.campaignId,
          });
          return jsonResponse(result, 200);
        },
      ),
  );
}
