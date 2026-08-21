import type { Channel, MessageStatus, SuppressionReason } from '@convey/shared';
import type { Elysia } from 'elysia';
import {
  CommonHeaders,
  StandardResponseExamples,
  StandardSecurityRequirement,
} from '../../openapi/openapi.docs';
import { jsonResponse } from '../messaging/messaging.controller';
import { adminService } from './admin.service';

export function adminController(app: Elysia) {
  return app.group('/v1/admin', (app) =>
    app
      // Overview metrics
      .get(
        '/overview',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Get Platform System Overview KPIs',
            description: 'Retrieves 24-hour total volume, delivery success rates, channel breakdown, and p95 latency percentiles.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': {
                description: 'System overview summary and KPIs',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        metrics: { type: 'object' },
                        timeseries: { type: 'array', items: { type: 'object' } },
                        channelDistribution: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Get Real-Time Engine Telemetry Snapshot',
            description: 'Fetches real-time V8 heap memory usage, event-loop lag, active BullMQ queue depths, and worker counts.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': {
                description: 'Live engine telemetry metrics',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        heapUsedMb: { type: 'number', example: 84.5 },
                        eventLoopLagMs: { type: 'number', example: 1.2 },
                        queues: { type: 'object' },
                        trafficGovernor: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Messages Explorer Query',
            description: 'Search and inspect message records across teams, channels, states, date ranges, and full-text keywords.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            parameters: [
              { name: 'teamId', in: 'query', required: false, schema: { type: 'string', example: 'payments' } },
              { name: 'channel', in: 'query', required: false, schema: { type: 'string', example: 'sms' } },
              { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'delivered' } },
              { name: 'search', in: 'query', required: false, schema: { type: 'string', example: 'ORD-10928' } },
              { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
              { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 20 } },
            ],
            responses: {
              '200': {
                description: 'Paginated message records',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 20 },
                        total: { type: 'integer', example: 150 },
                        messages: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
      .get(
        '/messages/:id',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Get Message Details & Execution Waterfall',
            description: 'Retrieves complete message record, attempts history, and W3C distributed trace execution spans.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            parameters: [
              { name: 'id', in: 'path', required: true, description: 'Message public ULID ID', schema: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' } },
            ],
            responses: {
              '200': {
                description: 'Message details and trace waterfall',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        message: { type: 'object' },
                        attempts: { type: 'array', items: { type: 'object' } },
                        trace: { $ref: '#/components/schemas/DeliveryTraceResponse' },
                      },
                    },
                  },
                },
              },
              '404': { description: 'Message not found' },
            },
          },
        },
        async ({ params }: { params: { id: string } }) => {
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
        },
      )

      // Audit logs
      .get(
        '/audit-logs',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'List Immutable Administrative Audit Logs',
            description: 'Queries immutable security and operational audit trail records.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': {
                description: 'Audit log entries',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 25 },
                        logs: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
      .get(
        '/providers',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'List Provider Matrix & Circuit Breaker Cockpit',
            description: 'Lists all 80+ supported providers with live circuit breaker states, failure counts, and latency scores.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': {
                description: 'Provider matrix with circuit breaker states',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        providers: { type: 'array', items: { type: 'object' } },
                        circuitBreakers: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async () => {
          const providers = await adminService.listProviders();
          return jsonResponse(providers, 200);
        },
      )

      // Circuit breaker manual override
      .post(
        '/providers/:providerId/circuit',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Manual Provider Circuit Breaker Override',
            description: 'Manually force-closes, force-opens, or half-opens a provider circuit breaker with traffic ramp throttling.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            parameters: [
              { name: 'providerId', in: 'path', required: true, schema: { type: 'string', example: 'twilio' } },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      action: { type: 'string', enum: ['CLOSE', 'FORCE_OPEN', 'FORCE_HALF_OPEN'], example: 'FORCE_HALF_OPEN' },
                      rampPercentage: { type: 'number', example: 20 },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Circuit breaker state successfully updated' },
            },
          },
        },
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
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Trigger Synthetic Provider Canary Probe',
            description: 'Executes an immediate background synthetic probe to evaluate provider upstream health and latency.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            parameters: [
              { name: 'providerId', in: 'path', required: true, schema: { type: 'string', example: 'twilio' } },
            ],
            responses: {
              '200': { description: 'Canary probe result summary' },
            },
          },
        },
        async ({ params }: { params: { providerId: string } }) => {
          const res = await adminService.triggerCanaryProbe(params.providerId);
          return jsonResponse(res, 200);
        },
      )

      // Dead-Letter Queue (DLQ) & Replay Simulator
      .post(
        '/dlq/replay',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Admin DLQ Replay Simulator',
            description: 'Executes or simulates (dry-run) replaying failed messages from the DLQ.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            requestBody: {
              required: false,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      dryRun: { type: 'boolean', default: false, example: true },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'DLQ replay summary' },
            },
          },
        },
        async ({ body }: { body: unknown }) => {
          const b = (body || {}) as { dryRun?: boolean };
          const res = await adminService.replayDlq(b);
          return jsonResponse(res, 200);
        },
      )

      // Suppressions
      .get(
        '/suppressions',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Admin List Suppressions',
            description: 'List all global and team-specific suppression records.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': { description: 'Suppression records list' },
            },
          },
        },
        async ({ query }: { query?: Record<string, string | undefined> }) => {
          const list = await adminService.listSuppressions(query?.search);
          return jsonResponse(list, 200);
        },
      )

      .post(
        '/suppressions',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Admin Add Manual Suppression',
            description: 'Manually blocks a recipient from receiving dispatches.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      teamId: { type: 'string', example: 'payments' },
                      recipient: { type: 'string', example: 'blocked_user@example.com' },
                      channel: { type: 'string', example: 'EMAIL' },
                      reason: { type: 'string', example: 'MANUAL_BLOCK' },
                    },
                    required: ['recipient'],
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Suppression created' },
            },
          },
        },
        async ({ body }: { body: unknown }) => {
          const b = (body || {}) as { teamId?: string; recipient?: string; channel?: string; reason?: string };
          const res = await adminService.addSuppression({
            teamId: b.teamId || 'default_team',
            recipient: b.recipient || '',
            channel: (b.channel || 'EMAIL') as Channel,
            reason: (b.reason || 'MANUAL_BLOCK') as SuppressionReason,
          });
          return jsonResponse(res, 200);
        },
      )

      .delete(
        '/suppressions/:id',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Admin Delete Suppression',
            description: 'Deletes a suppression record.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'supp_123' } },
            ],
            responses: {
              '200': { description: 'Suppression deleted' },
            },
          },
        },
        async ({ params }: { params: { id: string } }) => {
          const res = await adminService.removeSuppression(params.id);
          return jsonResponse(res, 200);
        },
      )

      // Policies
      .get(
        '/policies',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'List Rate-Limiting & Budget Policies',
            description: 'Retrieves all rate-limiting, budget caps, and multi-tenant quotas.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': { description: 'Active policy rules' },
            },
          },
        },
        async () => {
          const policies = await adminService.listPolicies();
          return jsonResponse(policies, 200);
        },
      )

      // Omnichannel composer sandbox test send
      .post(
        '/composer/send-test',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Omnichannel Composer Live Test Send',
            description: 'Dispatches a test message from the Mission Control composer sandbox.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': { description: 'Test message dispatch result' },
            },
          },
        },
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
      .get(
        '/providers/catalog',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Get Master 80+ Provider Catalog',
            description: 'Retrieves metadata, required environment variables, supported channels, and schemas for all 80+ supported providers.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': { description: 'Complete provider catalog list' },
            },
          },
        },
        () => {
          const catalog = adminService.getProviderCatalog();
          return jsonResponse(catalog, 200);
        },
      )

      .get(
        '/providers/configured',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'List Configured Provider Credentials',
            description: 'Lists all active configured providers from database and in-memory cache.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': { description: 'List of configured provider records' },
            },
          },
        },
        async () => {
          const configured = await adminService.getConfiguredProviders();
          return jsonResponse(configured, 200);
        },
      )

      .post(
        '/providers/register',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Register or Update Provider Configuration',
            description:
              'Registers new provider credentials and configuration in PostgreSQL with instant Redis PubSub zero-downtime hot-reloading.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      providerId: { type: 'string', example: 'twilio' },
                      channel: { type: 'string', example: 'sms' },
                      credentials: { type: 'object', example: { accountSid: 'ACxxx', authToken: 'authxxx', from: '+14155550100' } },
                      isPrimary: { type: 'boolean', example: true },
                      priority: { type: 'integer', example: 1 },
                      weight: { type: 'integer', example: 100 },
                    },
                    required: ['providerId', 'channel', 'credentials'],
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Provider successfully registered and hot-reloaded' },
            },
          },
        },
        async ({ body }: { body: unknown }) => {
          const b = (body || {}) as {
            providerId?: string;
            channel?: Channel;
            credentials?: Record<string, string>;
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
            config: b.config,
            isPrimary: b.isPrimary,
            priority: b.priority,
            weight: b.weight,
            fallbackProviderId: b.fallbackProviderId,
          });
          return jsonResponse(res, 200);
        },
      )

      .delete(
        '/providers/configured/:id',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Delete Configured Provider',
            description: 'Removes a configured provider record.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'prov_config_123' } },
            ],
            responses: {
              '200': { description: 'Provider configuration deleted' },
            },
          },
        },
        async ({ params }: { params: { id: string } }) => {
          const res = await adminService.deleteConfiguredProvider(params.id);
          return jsonResponse(res, 200);
        },
      )

      .post(
        '/providers/test-connection',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Test Provider Credentials Connection',
            description: 'Validates API keys and credentials directly against upstream vendor endpoint.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      providerId: { type: 'string', example: 'twilio' },
                      credentials: { type: 'object', example: { accountSid: 'ACxxx', authToken: 'authxxx' } },
                    },
                    required: ['providerId', 'credentials'],
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Connection test result' },
            },
          },
        },
        async ({ body }: { body: unknown }) => {
          const b = (body || {}) as { providerId?: string; credentials?: Record<string, string> };
          const res = adminService.testProviderConnection(b.providerId || '', b.credentials || {});
          return jsonResponse(res, 200);
        },
      )

      .post(
        '/providers/seed-all',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Seed All 80+ Providers with Test Config',
            description: 'Pre-populates all 80+ supported providers with local mock credentials.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': { description: 'All providers seeded' },
            },
          },
        },
        async () => {
          const res = await adminService.seedAllProviders();
          return jsonResponse(res, 200);
        },
      )

      .get(
        '/providers/env-export',
        {
          detail: {
            tags: ['Admin & Mission Control'],
            summary: 'Export Provider Environment Variables',
            description: 'Exports sample .env formatted environment variable templates for all providers.',
            security: StandardSecurityRequirement,
            headers: CommonHeaders,
            responses: {
              '200': { description: 'Exported environment variables' },
            },
          },
        },
        () => {
          const exported = adminService.exportEnvVariables();
          return jsonResponse(exported, 200);
        },
      ),
  );
}
