import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';
import { sql } from 'drizzle-orm';

import { app } from '../src';
import { db } from '../src/db';
import { budgetLedger, budgetPolicies, budgetUsage, campaigns, messageEvents, messages } from '../src/db/schema';
import { ReportingService } from '../src/modules/reports/reporting.service';
import { generateMessageId } from '../src/utils/id';

describe('Reporting & Multi-Dimension Analytics Test Suite', () => {
  const testTeamA = `team_growth_${Date.now()}`;
  const testTeamB = `team_security_${Date.now()}`;
  const testCampaign1 = `cmp_black_friday_${Date.now()}`;
  const testCampaign2 = `cmp_otp_auth_${Date.now()}`;

  beforeAll(async () => {
    // 1. Seed Budget Policy for Test Team A
    const policyId = `pol_${Date.now()}`;
    await db.insert(budgetPolicies).values({
      id: policyId,
      team: testTeamA,
      currency: 'USD',
      monthlyBudgetUsd: '2500.0000',
      hardStop: 'true',
    });

    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    await db.insert(budgetUsage).values({
      id: `${policyId}_${month}`,
      policyId,
      month,
      currency: 'USD',
      usedUsd: '450.5000',
    });

    // 2. Register Campaign Metadata
    await db.insert(campaigns).values({
      id: `camp_${Date.now()}`,
      tenantId: 'default-tenant',
      externalId: testCampaign1,
      team: testTeamA,
      name: 'Black Friday Super Promo',
      state: 'active',
      status: 'active',
    });

    // 3. Seed Messages for Campaign 1 (Team A, Category: Marketing)
    // 8 delivered, 2 failed
    for (let i = 0; i < 10; i++) {
      const isDelivered = i < 8;
      const msgId = generateMessageId();
      const publicId = `msg_01JAX${Date.now()}${i}`;

      await db.insert(messages).values({
        id: msgId,
        publicId,
        userId: `usr_${i}`,
        team: testTeamA,
        category: 'marketing',
        country: 'US',
        campaignId: testCampaign1,
        state: isDelivered ? 'delivered' : 'failed',
        priority: 'normal',
        isSandbox: false,
        recipients: { email: `user${i}@example.com` },
        channels: [{ channel: Channel.WHATSAPP, content: { text: 'Sale!' } }],
        createdAt: now,
        completedAt: isDelivered ? now : undefined,
      });

      // Insert ledger row for cost tracking
      await db.insert(budgetLedger).values({
        id: `led_${Date.now()}_${i}`,
        messageId: publicId,
        team: testTeamA,
        amountUsd: '0.0150',
        currency: 'USD',
        exchangeRate: '1.00000000',
        amountInPolicyCurrency: '0.0150',
        channel: 'whatsapp',
        providerId: 'twilio-whatsapp',
        createdAt: now,
      });

      if (isDelivered && i < 4) {
        // 4 opened events
        await db.insert(messageEvents).values({
          id: `ev_${Date.now()}_${i}`,
          messageId: publicId,
          channel: 'whatsapp',
          type: 'DELIVERY_OPENED',
          source: 'webhook',
          occurredAt: now,
          createdAt: now,
        });
      }
    }

    // 4. Seed Messages for Campaign 2 (Team B, Category: Auth)
    // 5 delivered, 0 failed
    for (let i = 0; i < 5; i++) {
      const msgId = generateMessageId();
      const publicId = `msg_01JAXAUTH${Date.now()}${i}`;

      await db.insert(messages).values({
        id: msgId,
        publicId,
        userId: `usr_auth_${i}`,
        team: testTeamB,
        category: 'auth',
        country: 'US',
        campaignId: testCampaign2,
        state: 'delivered',
        priority: 'high',
        isSandbox: false,
        recipients: { phone: '+15551234567' },
        channels: [{ channel: Channel.SMS, content: { text: 'Your OTP is 123456' } }],
        createdAt: now,
        completedAt: now,
      });

      await db.insert(budgetLedger).values({
        id: `led_auth_${Date.now()}_${i}`,
        messageId: publicId,
        team: testTeamB,
        amountUsd: '0.0075',
        currency: 'USD',
        exchangeRate: '1.00000000',
        amountInPolicyCurrency: '0.0075',
        channel: 'sms',
        providerId: 'twilio-sms',
        createdAt: now,
      });
    }
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await db.delete(messages).where(sql`${messages.campaignId} IN (${testCampaign1}, ${testCampaign2})`);
      await db.delete(campaigns).where(sql`${campaigns.externalId} IN (${testCampaign1}, ${testCampaign2})`);
    } catch {
      // Ignore
    }
  });

  describe('ReportingService Core Unit Tests', () => {
    it('calculates accurate overall summary KPIs and delivery rate', async () => {
      const report = await ReportingService.getReportingOverview({
        teamId: testTeamA,
      });

      expect(report).toBeDefined();
      expect(report.summary.totalSent).toBeGreaterThanOrEqual(10);
      expect(report.summary.totalDelivered).toBeGreaterThanOrEqual(8);
      expect(report.summary.totalFailed).toBeGreaterThanOrEqual(2);
      expect(report.summary.deliveryRatePercent).toBe(80.0);
      expect(report.summary.failRatePercent).toBe(20.0);
      expect(report.summary.openRatePercent).toBe(50.0); // 4 opened / 8 delivered
      expect(report.summary.totalCostUsd).toBeGreaterThanOrEqual(0.15);
    });

    it('aggregates team budget utilization and metrics per team', async () => {
      const report = await ReportingService.getTeamReports({
        teamId: testTeamA,
      });

      expect(report.teams.length).toBe(1);
      const teamA = report.teams[0];
      expect(teamA.teamId).toBe(testTeamA);
      expect(teamA.monthlyBudget).toBe(2500.0);
      expect(teamA.usedBudgetUsd).toBe(450.5);
      expect(teamA.budgetUtilizationPercent).toBe(18.02); // 450.5 / 2500 * 100
      expect(teamA.metrics.deliveryRatePercent).toBe(80.0);
      expect(teamA.metrics.openRatePercent).toBe(50.0);
    });

    it('groups metrics and costs by communication category', async () => {
      const report = await ReportingService.getCategoryReports({
        teamId: testTeamA,
      });

      expect(report.categories.length).toBeGreaterThanOrEqual(1);
      const marketing = report.categories.find((c) => c.category === 'marketing');
      expect(marketing).toBeDefined();
      expect(marketing?.totalSent).toBeGreaterThanOrEqual(10);
      expect(marketing?.deliveryRatePercent).toBe(80.0);
      expect(marketing?.totalCostUsd).toBeGreaterThan(0);
    });

    it('aggregates performance metrics grouped by external campaignId', async () => {
      const report = await ReportingService.getCampaignReports({
        campaignId: testCampaign1,
      });

      expect(report.campaigns.length).toBe(1);
      const camp = report.campaigns[0];
      expect(camp.campaignId).toBe(testCampaign1);
      expect(camp.name).toBe('Black Friday Super Promo');
      expect(camp.team).toBe(testTeamA);
      expect(camp.category).toBe('marketing');
      expect(camp.metrics.sent).toBe(10);
      expect(camp.metrics.delivered).toBe(8);
      expect(camp.metrics.failed).toBe(2);
      expect(camp.metrics.deliveryRatePercent).toBe(80.0);
      expect(camp.costPerDeliveredUsd).toBeGreaterThan(0);
    });

    it('returns single campaign deep-dive details with funnel progression', async () => {
      const details = await ReportingService.getCampaignDetails(testCampaign1);

      expect(details).not.toBeNull();
      expect(details?.campaignId).toBe(testCampaign1);
      expect(details?.funnel.accepted).toBe(10);
      expect(details?.funnel.delivered).toBe(8);
      expect(details?.funnel.failed).toBe(2);
      expect(details?.metrics.deliveryRatePercent).toBe(80.0);
      expect(details?.channelBreakdown.length).toBeGreaterThan(0);
    });

    it('exports reporting data in CSV and JSON formats', async () => {
      const csvExport = await ReportingService.exportReport('campaigns', 'csv', {
        campaignId: testCampaign1,
      });
      expect(csvExport.contentType).toContain('text/csv');
      expect(csvExport.content).toContain(testCampaign1);
      expect(csvExport.content).toContain('Delivery Rate %');

      const jsonExport = await ReportingService.exportReport('teams', 'json', {
        teamId: testTeamA,
      });
      expect(jsonExport.contentType).toContain('application/json');
      expect(jsonExport.content).toContain(testTeamA);
    });
  });

  describe('Admin REST API Endpoints Verification', () => {
    it('GET /v1/admin/reports/overview returns 200 with summary KPIs', async () => {
      const res = await app.handle(new Request(`http://localhost/v1/admin/reports/overview?teamId=${testTeamA}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toBeDefined();
      expect(data.summary.totalSent).toBeGreaterThanOrEqual(10);
      expect(data.summary.deliveryRatePercent).toBe(80.0);
    });

    it('GET /v1/admin/reports/teams returns 200 with team list', async () => {
      const res = await app.handle(new Request(`http://localhost/v1/admin/reports/teams?teamId=${testTeamA}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.teams).toBeDefined();
      expect(data.teams.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /v1/admin/reports/categories returns 200 with category list', async () => {
      const res = await app.handle(new Request(`http://localhost/v1/admin/reports/categories?teamId=${testTeamA}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.categories).toBeDefined();
    });

    it('GET /v1/admin/reports/campaigns returns 200 with external campaign list', async () => {
      const res = await app.handle(new Request(`http://localhost/v1/admin/reports/campaigns?search=${testCampaign1}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.campaigns).toBeDefined();
      expect(data.campaigns.length).toBe(1);
      expect(data.campaigns[0].campaignId).toBe(testCampaign1);
    });

    it('GET /v1/admin/reports/campaigns/:campaignId returns 200 with drilldown details', async () => {
      const res = await app.handle(new Request(`http://localhost/v1/admin/reports/campaigns/${testCampaign1}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.campaignId).toBe(testCampaign1);
      expect(data.funnel).toBeDefined();
    });

    it('GET /v1/admin/reports/export returns downloadable CSV attachment', async () => {
      const res = await app.handle(
        new Request(`http://localhost/v1/admin/reports/export?type=campaigns&format=csv&campaignId=${testCampaign1}`),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const text = await res.text();
      expect(text).toContain(testCampaign1);
    });
  });
});
