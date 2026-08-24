import { describe, expect, it } from 'bun:test';
import { BatchState, Channel, Convey, MessageStatus, SuppressionReason } from '../src';

describe('SDK Resource Modules Unit Tests', () => {
  function createMockClient(handler: (path: string, method: string, body?: unknown, query?: unknown) => unknown) {
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(input.toString());
      const path = url.pathname;
      const method = init?.method || 'GET';
      let body: unknown;
      if (init?.body) {
        try {
          body = JSON.parse(init.body as string);
        } catch {
          body = init.body;
        }
      }
      const query = Object.fromEntries(url.searchParams.entries());
      const responseData = handler(path, method, body, query);

      if (typeof responseData === 'string') {
        return new Response(responseData, { status: 200 });
      }

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    return new Convey({ apiKey: 'sk_live_test', fetch: mockFetch as unknown as typeof fetch });
  }

  // --- Messages Resource ---
  describe('MessagesResource', () => {
    it('handles send, sendBulk, get, timeline, trace, preview', async () => {
      const client = createMockClient((path, method, _body) => {
        if (path === '/v1/messages' && method === 'POST') {
          return { success: true, publicId: 'msg_01', status: 'ACCEPTED' };
        }
        if (path === '/v1/messages/bulk' && method === 'POST') {
          return { total: 2, items: [{ publicId: 'msg_01' }, { publicId: 'msg_02' }] };
        }
        if (path === '/v1/messages/msg_01' && method === 'GET') {
          return { publicId: 'msg_01', status: 'DELIVERED', costUsd: 0.001 };
        }
        if (path === '/v1/messages/msg_01/timeline' && method === 'GET') {
          return { messageId: 'msg_01', timeline: [{ status: 'DELIVERED', latencyMs: 12 }] };
        }
        if (path === '/v1/messages/msg_01/trace' && method === 'GET') {
          return { messageId: 'msg_01', traceparent: '00-...', totalDurationMs: 45, spans: [] };
        }
        if (path === '/v1/messages/templates/preview' && method === 'POST') {
          return { rendered: 'Hello Alex', missingVariables: [] };
        }
        return {};
      });

      const single = await client.messages.send({
        channel: Channel.EMAIL,
        recipient: 'alex@test.com',
        content: { subject: 'Hi', body: 'Hello' },
      });
      expect(single.publicId).toBe('msg_01');

      const bulk = await client.messages.sendBulk([
        { channel: Channel.EMAIL, recipient: 'u1@test.com', content: { body: '1' } },
        { channel: Channel.EMAIL, recipient: 'u2@test.com', content: { body: '2' } },
      ]);
      expect(bulk.total).toBe(2);

      const detail = await client.messages.get('msg_01');
      expect(detail.status).toBe(MessageStatus.DELIVERED);

      const timeline = await client.messages.getTimeline('msg_01');
      expect(timeline.timeline.length).toBe(1);

      const trace = await client.messages.getTrace('msg_01');
      expect(trace.totalDurationMs).toBe(45);

      const preview = await client.messages.previewTemplate({
        template: 'Hello {{name}}',
        variables: { name: 'Alex' },
      });
      expect(preview.rendered).toBe('Hello Alex');
    });
  });

  // --- Batches Resource ---
  describe('BatchesResource', () => {
    it('handles create, list, get, pause, resume, cancel', async () => {
      const client = createMockClient((path, method) => {
        if (path === '/v1/batches' && method === 'POST') {
          return { success: true, batch: { id: 'batch_01', state: 'INITIALIZING' } };
        }
        if (path === '/v1/batches' && method === 'GET') {
          return { success: true, batches: [{ id: 'batch_01' }] };
        }
        if (path === '/v1/batches/batch_01' && method === 'GET') {
          return { success: true, batch: { id: 'batch_01', totalCount: 100 } };
        }
        if (path === '/v1/batches/batch_01/pause' && method === 'POST') {
          return { success: true, batch: { id: 'batch_01', state: 'PAUSED' } };
        }
        if (path === '/v1/batches/batch_01/resume' && method === 'POST') {
          return { success: true, batch: { id: 'batch_01', state: 'PROCESSING' } };
        }
        if (path === '/v1/batches/batch_01/cancel' && method === 'POST') {
          return { success: true, batch: { id: 'batch_01', state: 'CANCELLED' } };
        }
        return {};
      });

      const created = await client.batches.create({ totalCount: 100 });
      expect(created.batch.id).toBe('batch_01');

      const list = await client.batches.list();
      expect(list.batches.length).toBe(1);

      const batch = await client.batches.get('batch_01');
      expect(batch.batch.totalCount).toBe(100);

      const paused = await client.batches.pause('batch_01');
      expect(paused.batch.state).toBe(BatchState.PAUSED);

      const resumed = await client.batches.resume('batch_01');
      expect(resumed.batch.state).toBe(BatchState.PROCESSING);

      const cancelled = await client.batches.cancel('batch_01');
      expect(cancelled.batch.state).toBe(BatchState.CANCELLED);
    });
  });

  // --- Suppressions Resource ---
  describe('SuppressionsResource', () => {
    it('handles add, addBulk, list, listAutoPaging, delete', async () => {
      const client = createMockClient((path, method) => {
        if (path === '/v1/suppressions' && method === 'POST') {
          return { success: true, suppression: { id: 'supp_01', identifier: 'bounced@test.com' } };
        }
        if (path === '/v1/suppressions/bulk' && method === 'POST') {
          return { success: true, count: 2, suppressions: [{ id: 's1' }, { id: 's2' }] };
        }
        if (path === '/v1/suppressions' && method === 'GET') {
          return { items: [{ id: 'supp_01', identifier: 'bounced@test.com' }], total: 1 };
        }
        if (path === '/v1/suppressions/supp_01' && method === 'DELETE') {
          return { success: true };
        }
        return {};
      });

      const add = await client.suppressions.add({
        identifier: 'bounced@test.com',
        reason: SuppressionReason.HARD_BOUNCE,
      });
      expect(add.suppression.id).toBe('supp_01');

      const bulk = await client.suppressions.addBulk([
        { identifier: 'a@test.com', reason: SuppressionReason.UNSUBSCRIBE },
      ]);
      expect(bulk.count).toBe(2);

      const list = await client.suppressions.list({ search: 'bounced' });
      expect(list.items.length).toBe(1);

      const streamed = await client.suppressions.listAutoPaging().autoPagingToArray();
      expect(streamed.length).toBe(1);

      const del = await client.suppressions.delete('supp_01');
      expect(del.success).toBe(true);
    });
  });

  // --- Webhooks Resource ---
  describe('WebhooksResource', () => {
    it('handles subscriptions create, list, delete, test', async () => {
      const client = createMockClient((path, method) => {
        if (path === '/v1/webhook-subscriptions' && method === 'POST') {
          return { success: true, subscription: { id: 'sub_01', url: 'https://webhook.site/test' } };
        }
        if (path === '/v1/webhook-subscriptions' && method === 'GET') {
          return { subscriptions: [{ id: 'sub_01' }] };
        }
        if (path === '/v1/webhook-subscriptions/sub_01' && method === 'DELETE') {
          return { success: true };
        }
        if (path === '/v1/webhook-subscriptions/sub_01/test' && method === 'POST') {
          return { success: true, message: 'Ping queued' };
        }
        return {};
      });

      const sub = await client.webhooks.subscriptions.create({
        url: 'https://webhook.site/test',
        events: ['message.delivered'],
      });
      expect(sub.subscription.id).toBe('sub_01');

      const list = await client.webhooks.subscriptions.list();
      expect(list.subscriptions.length).toBe(1);

      const ping = await client.webhooks.subscriptions.test('sub_01');
      expect(ping.message).toBe('Ping queued');

      const del = await client.webhooks.subscriptions.delete('sub_01');
      expect(del.success).toBe(true);
    });
  });

  // --- DLQ Resource ---
  describe('DlqResource', () => {
    it('handles list, listAutoPaging, replay, replayMutated', async () => {
      const client = createMockClient((path, method) => {
        if (path === '/v1/dlq' && method === 'GET') {
          return { items: [{ publicId: 'msg_f1' }], total: 1 };
        }
        if (path === '/v1/dlq/replay' && method === 'POST') {
          return { replayedCount: 1, messageIds: ['msg_f1'] };
        }
        if (path === '/v1/dlq/replay-mutated' && method === 'POST') {
          return { dryRun: true, matchedMessagesCount: 5, simulation: { riskLevel: 'LOW' } };
        }
        return {};
      });

      const list = await client.dlq.list();
      expect(list.items.length).toBe(1);

      const streamed = await client.dlq.listAutoPaging().autoPagingToArray();
      expect(streamed.length).toBe(1);

      const replayed = await client.dlq.replay(['msg_f1']);
      expect(replayed.replayedCount).toBe(1);

      const sim = await client.dlq.replayMutated({ dryRun: true });
      expect(sim.simulation?.riskLevel).toBe('LOW');
    });
  });

  // --- Sandbox Resource ---
  describe('SandboxResource', () => {
    it('handles listMessages, clearMessages', async () => {
      const client = createMockClient((path, method) => {
        if (path === '/v1/sandbox/messages' && method === 'GET') {
          return { messages: [{ publicId: 'msg_sb_1' }] };
        }
        if (path === '/v1/sandbox/messages' && method === 'DELETE') {
          return { success: true, count: 1 };
        }
        return {};
      });

      const list = await client.sandbox.listMessages();
      expect(list.messages.length).toBe(1);

      const clear = await client.sandbox.clearMessages();
      expect(clear.count).toBe(1);
    });
  });

  // --- Reports Resource ---
  describe('ReportsResource', () => {
    it('handles getOverview, getTeams, getCategories, getCampaigns, getCampaignDetails, export', async () => {
      const client = createMockClient((path, _method) => {
        if (path === '/v1/admin/reports/overview') {
          return { summary: { totalSent: 1000, totalDelivered: 990 } };
        }
        if (path === '/v1/admin/reports/teams') {
          return { teams: [{ teamId: 'team_1', monthlyBudget: 500 }] };
        }
        if (path === '/v1/admin/reports/categories') {
          return { categories: [{ category: 'BILLING', totalSent: 200 }] };
        }
        if (path === '/v1/admin/reports/campaigns') {
          return { campaigns: [{ campaignId: 'cmp_1', name: 'Welcome' }] };
        }
        if (path === '/v1/admin/reports/campaigns/cmp_1') {
          return { campaignId: 'cmp_1', funnel: { accepted: 100, delivered: 98 } };
        }
        if (path === '/v1/admin/reports/export') {
          return 'campaignId,name,sent\ncmp_1,Welcome,100';
        }
        return {};
      });

      const overview = await client.reports.getOverview();
      expect(overview.summary.totalSent).toBe(1000);

      const teams = await client.reports.getTeams();
      expect(teams.teams.length).toBe(1);

      const categories = await client.reports.getCategories();
      expect(categories.categories.length).toBe(1);

      const campaigns = await client.reports.getCampaigns();
      expect(campaigns.campaigns.length).toBe(1);

      const campaign = await client.reports.getCampaignDetails('cmp_1');
      expect(campaign.funnel.delivered).toBe(98);

      const csv = await client.reports.export('campaigns', 'csv');
      expect(csv).toContain('campaignId,name,sent');
    });
  });

  // --- Admin Resource ---
  describe('AdminResource', () => {
    it('handles telemetry, providers, circuit overrides, canary, catalog, audit logs, policies', async () => {
      const client = createMockClient((path, method) => {
        if (path === '/v1/admin/overview') return { totalTenants: 5 };
        if (path === '/v1/admin/telemetry/live') return { throughputRps: 150, latency: { p95Ms: 12 } };
        if (path === '/v1/admin/providers') return [{ providerId: 'sendgrid', state: 'CLOSED' }];
        if (path === '/v1/admin/providers/sendgrid/circuit' && method === 'POST') {
          return { success: true, state: 'FORCE_HALF_OPEN', rampPercentage: 20 };
        }
        if (path === '/v1/admin/providers/twilio/canary' && method === 'POST') {
          return { healthy: true, latencyMs: 22 };
        }
        if (path === '/v1/admin/providers/catalog') return { providers: [{ id: 'sendgrid' }] };
        if (path === '/v1/admin/providers/configured') return [{ id: 'cfg_1', providerId: 'sendgrid' }];
        if (path === '/v1/admin/providers/register') return { success: true, provider: { id: 'cfg_1' } };
        if (path === '/v1/admin/providers/configured/cfg_1' && method === 'DELETE') return { success: true };
        if (path === '/v1/admin/providers/test-connection')
          return { success: true, providerId: 'sendgrid', latencyMs: 18, message: 'OK' };
        if (path === '/v1/admin/audit-logs')
          return { items: [{ id: 'log_1', action: 'PROVIDER_REGISTER' }], total: 1, page: 1, limit: 50 };
        if (path === '/v1/admin/policies') return [{ id: 'pol_1', type: 'RATE_LIMIT' }];
        return {};
      });

      const overview = await client.admin.getOverview();
      expect(overview.totalTenants).toBe(5);

      const tel = await client.admin.getLiveTelemetry();
      expect(tel.throughputRps).toBe(150);

      const provs = await client.admin.listProviders();
      expect(provs.length).toBe(1);

      const circuit = await client.admin.setCircuitState('sendgrid', 'FORCE_HALF_OPEN', 20);
      expect(circuit.state).toBe('FORCE_HALF_OPEN');

      const canary = await client.admin.triggerCanary('twilio');
      expect(canary.healthy).toBe(true);

      const catalog = await client.admin.getProviderCatalog();
      expect(catalog.providers).toBeDefined();

      const configured = await client.admin.listConfiguredProviders();
      expect(configured.length).toBe(1);

      const reg = await client.admin.registerProvider({
        providerId: 'sendgrid',
        channel: Channel.EMAIL,
        credentials: { SENDGRID_API_KEY: 'sg_123' },
      });
      expect(reg.success).toBe(true);

      const del = await client.admin.deleteConfiguredProvider('cfg_1');
      expect(del.success).toBe(true);

      const testConn = await client.admin.testProviderConnection({
        providerId: 'sendgrid',
        credentials: { SENDGRID_API_KEY: 'sg_123' },
      });
      expect(testConn.success).toBe(true);

      const logs = await client.admin.listAuditLogs();
      expect(logs.items.length).toBe(1);

      const policies = await client.admin.listPolicies();
      expect(policies.length).toBe(1);
    });
  });
});
