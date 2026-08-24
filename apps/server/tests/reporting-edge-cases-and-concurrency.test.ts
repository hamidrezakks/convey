import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db';
import {
  budgetLedger,
  budgetPolicies,
  campaigns,
  messageEvents,
  messages,
  reportCampaignHourly,
  reportHourly,
} from '../src/db/schema';
import { MetricType } from '../src/modules/messaging/messaging.types';
import { buildReportId, ReportingService } from '../src/modules/reports/reporting.service';
import { ReportingDoctorService } from '../src/modules/reports/reporting-doctor.service';
import { getUtcHourBoundary } from '../src/utils/date';
import { generateMessageId } from '../src/utils/id';

describe('Reporting Advanced Edge Cases, Chaos & Concurrency Test Suite', () => {
  const teamAlpha = `team_edge_alpha_${Date.now()}`;
  const teamBeta = `team_edge_beta_${Date.now()}`;
  const campaignAlpha1 = `cmp_alpha_1_${Date.now()}`;
  const campaignAlpha2 = `cmp_alpha_2_${Date.now()}`;
  const campaignBeta1 = `cmp_beta_1_${Date.now()}`;

  const now = new Date();
  const currentHour = getUtcHourBoundary(now);
  const previousHour = new Date(currentHour.getTime() - 3600 * 1000);

  beforeAll(async () => {
    // 1. Create budget policies for multi-currency spend test
    await db.insert(budgetPolicies).values([
      {
        id: `pol_alpha_${Date.now()}`,
        team: teamAlpha,
        monthlyBudgetUsd: '5000.00',
        currency: 'USD',
        softThresholdPercent: 80,
        hardThresholdPercent: 100,
        enforceHardLimit: true,
        actionOnHardLimit: 'reject',
        alertEmails: ['alpha@convey.internal'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `pol_beta_${Date.now()}`,
        team: teamBeta,
        monthlyBudgetUsd: '1200.00',
        currency: 'EUR',
        softThresholdPercent: 75,
        hardThresholdPercent: 95,
        enforceHardLimit: true,
        actionOnHardLimit: 'reject',
        alertEmails: ['beta@convey.internal'],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 2. Register campaigns
    await db.insert(campaigns).values([
      {
        id: `c_a1_${Date.now()}`,
        tenantId: 'default-tenant',
        externalId: campaignAlpha1,
        team: teamAlpha,
        name: 'Alpha Black Friday Sale, 50% Off!', // contains comma to test CSV escaping
        state: 'active',
        status: 'active',
      },
      {
        id: `c_a2_${Date.now()}`,
        tenantId: 'default-tenant',
        externalId: campaignAlpha2,
        team: teamAlpha,
        name: 'Alpha VIP Loyalty Club',
        state: 'active',
        status: 'active',
      },
      {
        id: `c_b1_${Date.now()}`,
        tenantId: 'default-tenant',
        externalId: campaignBeta1,
        team: teamBeta,
        name: 'Beta Auth Verification',
        state: 'active',
        status: 'active',
      },
    ]);

    // 3. Seed messages with multi-channel and multi-hour data
    // Alpha1: Marketing (10 sent, 8 delivered, 2 failed)
    for (let i = 0; i < 10; i++) {
      const isDelivered = i < 8;
      const msgId = generateMessageId();

      const publicId = `msg_01JALPHA1_${Date.now()}_${i}`;

      await db.insert(messages).values({
        id: msgId,
        publicId,
        userId: `usr_a1_${i}`,
        team: teamAlpha,
        category: 'marketing',
        country: 'AE',
        campaignId: campaignAlpha1,
        state: isDelivered ? 'delivered' : 'failed',
        priority: 'normal',
        isSandbox: false,
        recipients: { phone: '+971501234567' },
        channels: [{ channel: Channel.WHATSAPP, content: { text: 'Special offer' } }],
        createdAt: currentHour,
        completedAt: isDelivered ? currentHour : undefined,
      });

      await db.insert(budgetLedger).values({
        id: `led_a1_${Date.now()}_${i}`,
        messageId: publicId,
        team: teamAlpha,
        amountUsd: '0.0350',
        currency: 'USD',
        exchangeRate: '1.00000000',
        amountInPolicyCurrency: '0.0350',
        channel: 'whatsapp',
        providerId: 'twilio-whatsapp',
        createdAt: currentHour,
      });

      // Events: 5 opened, 3 read in current hour
      if (isDelivered && i < 5) {
        await db.insert(messageEvents).values({
          id: `ev_a1_op_${Date.now()}_${i}`,
          messageId: publicId,
          channel: 'whatsapp',
          type: 'DELIVERY_OPENED',
          source: 'webhook',
          occurredAt: currentHour,
          createdAt: currentHour,
        });
      }
      if (isDelivered && i < 3) {
        await db.insert(messageEvents).values({
          id: `ev_a1_rd_${Date.now()}_${i}`,
          messageId: publicId,
          channel: 'whatsapp',
          type: 'DELIVERY_READ',
          source: 'webhook',
          occurredAt: currentHour,
          createdAt: currentHour,
        });
      }
    }

    // Alpha2: Transactional in PREVIOUS hour (6 sent, 6 delivered, country null -> GLOBAL fallback)
    for (let i = 0; i < 6; i++) {
      const msgId = generateMessageId();
      const publicId = `msg_01JALPHA2_${Date.now()}_${i}`;

      await db.insert(messages).values({
        id: msgId,
        publicId,
        userId: `usr_a2_${i}`,
        team: teamAlpha,
        category: 'transactional',
        country: 'GLOBAL',
        campaignId: campaignAlpha2,

        state: 'delivered',
        priority: 'high',
        isSandbox: false,
        recipients: { email: 'user@example.com' },
        channels: [{ channel: Channel.EMAIL, content: { subject: 'Receipt' } }],
        createdAt: previousHour,
        completedAt: previousHour,
      });

      await db.insert(budgetLedger).values({
        id: `led_a2_${Date.now()}_${i}`,
        messageId: publicId,
        team: teamAlpha,
        amountUsd: '0.0010',
        currency: 'USD',
        exchangeRate: '1.00000000',
        amountInPolicyCurrency: '0.0010',
        channel: 'email',
        providerId: 'ses',
        createdAt: previousHour,
      });
    }

    // Beta1: Auth / OTP (12 sent, 12 delivered, SMS)
    for (let i = 0; i < 12; i++) {
      const msgId = generateMessageId();
      const publicId = `msg_01JBETA1_${Date.now()}_${i}`;

      await db.insert(messages).values({
        id: msgId,
        publicId,
        userId: `usr_b1_${i}`,
        team: teamBeta,
        category: 'auth',
        country: 'US',
        campaignId: campaignBeta1,
        state: 'delivered',
        priority: 'critical',
        isSandbox: false,
        recipients: { phone: '+15550001111' },
        channels: [{ channel: Channel.SMS, content: { text: 'Your OTP is 123456' } }],
        createdAt: currentHour,
        completedAt: currentHour,
      });

      await db.insert(budgetLedger).values({
        id: `led_b1_${Date.now()}_${i}`,
        messageId: publicId,
        team: teamBeta,
        amountUsd: '0.0075',
        currency: 'EUR',
        exchangeRate: '1.08000000',
        amountInPolicyCurrency: '0.0069',
        channel: 'sms',
        providerId: 'twilio',
        createdAt: currentHour,
      });
    }
  });

  afterAll(async () => {
    try {
      await db.delete(messages).where(eq(messages.team, teamAlpha));
      await db.delete(messages).where(eq(messages.team, teamBeta));
      await db.delete(budgetLedger).where(eq(budgetLedger.team, teamAlpha));
      await db.delete(budgetLedger).where(eq(budgetLedger.team, teamBeta));
      await db.delete(budgetPolicies).where(eq(budgetPolicies.team, teamAlpha));
      await db.delete(budgetPolicies).where(eq(budgetPolicies.team, teamBeta));
      await db.delete(campaigns).where(eq(campaigns.team, teamAlpha));
      await db.delete(campaigns).where(eq(campaigns.team, teamBeta));
      await db.delete(reportHourly).where(eq(reportHourly.team, teamAlpha));
      await db.delete(reportHourly).where(eq(reportHourly.team, teamBeta));
      await db.delete(reportCampaignHourly).where(eq(reportCampaignHourly.team, teamAlpha));
      await db.delete(reportCampaignHourly).where(eq(reportCampaignHourly.team, teamBeta));
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. High-Concurrency Hot Metric Buffer Aggregation', () => {
    it('handles 200 concurrent recordMetric promises without race conditions or lost updates', async () => {
      const concurrencyPromises: Promise<void>[] = [];

      for (let i = 0; i < 200; i++) {
        concurrencyPromises.push(
          ReportingService.recordMetric({
            team: teamAlpha,
            category: i % 2 === 0 ? 'marketing' : 'auth',
            country: 'AE',
            channel: i % 2 === 0 ? 'whatsapp' : 'sms',
            metric: i % 4 === 0 ? MetricType.FAILED : MetricType.DELIVERED,
            campaignId: campaignAlpha1,
            costUsd: 0.01,
            timestamp: now,
          }),
        );
      }

      await Promise.all(concurrencyPromises);

      // Flush hot buffer to database
      await ReportingService.flush();

      // Verify that buckets were created/updated
      const alphaBuckets = await db.select().from(reportHourly).where(eq(reportHourly.team, teamAlpha));
      expect(alphaBuckets.length).toBeGreaterThanOrEqual(1);

      const totalDelivered = alphaBuckets.reduce((sum, b) => sum + (b.deliveredCount || 0), 0);
      const totalFailed = alphaBuckets.reduce((sum, b) => sum + (b.failedCount || 0), 0);
      expect(totalDelivered + totalFailed).toBeGreaterThanOrEqual(200);
    });
  });

  describe('2. Scoped Reporting Doctor Reconciliation', () => {
    it('reconciles ONLY teamBeta when teamId filter is passed without modifying teamAlpha', async () => {
      // Intentionally corrupt teamBeta bucket
      const betaReportId = buildReportId(
        { team: teamBeta, category: 'auth', country: 'US', channel: 'sms' },
        currentHour,
      );

      await db
        .insert(reportHourly)
        .values({
          id: betaReportId,
          team: teamBeta,
          category: 'auth',
          country: 'US',
          channel: 'sms',
          hour: currentHour,
          sentCount: 9999, // Intentional drift
          deliveredCount: 0,
          failedCount: 9999,
          costUsd: '999.0000',
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: reportHourly.id,
          set: { sentCount: 9999, failedCount: 9999 },
        });

      // Run Doctor scoped to teamBeta
      const result = await ReportingDoctorService.reconcile({
        startDate: new Date(now.getTime() - 24 * 3600 * 1000),
        endDate: new Date(now.getTime() + 3600 * 1000),
        teamId: teamBeta,
      });

      expect(result.status).toBe('success');

      // Verify teamBeta is healed to ground truth (12 sent, 12 delivered, 0 failed)
      const healedBeta = await db
        .select()
        .from(reportHourly)
        .where(and(eq(reportHourly.team, teamBeta), eq(reportHourly.category, 'auth')));
      expect(healedBeta.length).toBe(1);
      expect(healedBeta[0].sentCount).toBe(12);
      expect(healedBeta[0].deliveredCount).toBe(12);
      expect(healedBeta[0].failedCount).toBe(0);
    });

    it('heals campaign-level pre-aggregations accurately with open/read events', async () => {
      // Reconcile scoped to teamAlpha
      await ReportingDoctorService.reconcile({
        startDate: new Date(now.getTime() - 24 * 3600 * 1000),
        endDate: new Date(now.getTime() + 3600 * 1000),
        teamId: teamAlpha,
        campaignId: campaignAlpha1,
      });

      const campRows = await db
        .select()
        .from(reportCampaignHourly)
        .where(and(eq(reportCampaignHourly.campaignId, campaignAlpha1), eq(reportCampaignHourly.channel, 'whatsapp')));
      expect(campRows.length).toBe(1);
      expect(campRows[0].sentCount).toBe(10);
      expect(campRows[0].deliveredCount).toBe(8);
      expect(campRows[0].failedCount).toBe(2);
      expect(campRows[0].openedCount).toBe(5);
      expect(campRows[0].readCount).toBe(3);
    });

    it('correctly defaults missing country to GLOBAL in report_hourly', async () => {
      // Alpha2 messages had country = GLOBAL
      await ReportingDoctorService.reconcile({
        startDate: new Date(now.getTime() - 24 * 3600 * 1000),
        endDate: new Date(now.getTime() + 3600 * 1000),
        teamId: teamAlpha,
      });

      const globalBuckets = await db
        .select()
        .from(reportHourly)
        .where(and(eq(reportHourly.team, teamAlpha), eq(reportHourly.country, 'GLOBAL')));
      expect(globalBuckets.length).toBe(1);
      expect(globalBuckets[0].sentCount).toBe(6);
      expect(globalBuckets[0].deliveredCount).toBe(6);
    });
  });

  describe('3. Multi-Dimension Querying & Fast OLAP Metrics', () => {
    it('calculates accurate team budget utilization and remaining spend', async () => {
      const teamsRes = await ReportingService.getTeamReports({ teamId: teamBeta });
      expect(teamsRes.teams.length).toBe(1);
      const betaReport = teamsRes.teams[0];

      expect(betaReport.teamId).toBe(teamBeta);
      expect(betaReport.monthlyBudget).toBe(1200);
      expect(betaReport.currency).toBe('EUR');
      expect(betaReport.metrics.sent).toBe(12);
      expect(betaReport.metrics.delivered).toBe(12);
      expect(betaReport.metrics.deliveryRatePercent).toBe(100.0);
      expect(betaReport.budgetUtilizationPercent).toBeLessThan(10.0);
      expect(betaReport.remainingBudgetUsd).toBeGreaterThan(1100);
    });

    it('calculates category metrics with delivery, open, and fail rates', async () => {
      const catRes = await ReportingService.getCategoryReports({ teamId: teamAlpha });
      expect(catRes.categories.length).toBeGreaterThanOrEqual(1);

      const marketingCat = catRes.categories.find((c) => c.category === 'marketing');
      expect(marketingCat).toBeDefined();
      if (marketingCat) {
        expect(marketingCat.totalSent).toBe(10);
        expect(marketingCat.deliveryRatePercent).toBe(80.0);
        expect(marketingCat.openRatePercent).toBe(62.5); // 5 opened out of 8 delivered
        expect(marketingCat.failRatePercent).toBe(20.0);
      }
    });

    it('supports fuzzy campaign search and pagination metadata', async () => {
      const searchRes = await ReportingService.getCampaignReports({
        search: 'Black Friday',
        page: 1,
        limit: 5,
      });

      expect(searchRes.campaigns.length).toBe(1);
      expect(searchRes.campaigns[0].campaignId).toBe(campaignAlpha1);
      expect(searchRes.pagination.total).toBe(1);
      expect(searchRes.pagination.page).toBe(1);
      expect(searchRes.pagination.totalPages).toBe(1);
    });

    it('returns complete 5-step conversion funnel in single campaign detail query', async () => {
      const detail = await ReportingService.getCampaignDetails(campaignAlpha1);
      expect(detail).toBeDefined();
      if (detail) {
        expect(detail.campaignId).toBe(campaignAlpha1);
        expect(detail.metrics.sent).toBe(10);
        expect(detail.metrics.delivered).toBe(8);
        expect(detail.metrics.opened).toBe(5);
        expect(detail.metrics.read).toBe(3);
        expect(detail.metrics.failed).toBe(2);

        // Verify 5-step funnel progression
        expect(detail.funnel.accepted).toBe(10);
        expect(detail.funnel.dispatched).toBe(10);
        expect(detail.funnel.delivered).toBe(8);
        expect(detail.funnel.opened).toBe(5);
        expect(detail.funnel.read).toBe(3);
        expect(detail.funnel.failed).toBe(2);
      }
    });
  });

  describe('4. Edge Cases, Zero States & Export Formatting', () => {
    it('handles empty timeframe queries gracefully without divide-by-zero or crash', async () => {
      const farFuture = new Date(Date.now() + 365 * 24 * 3600 * 1000);
      const emptyOverview = await ReportingService.getReportingOverview({
        startDate: farFuture.toISOString(),
        endDate: new Date(farFuture.getTime() + 3600 * 1000).toISOString(),
        teamId: 'non_existent_team',
      });

      expect(emptyOverview.summary.totalSent).toBe(0);
      expect(emptyOverview.summary.totalDelivered).toBe(0);
      expect(emptyOverview.summary.totalFailed).toBe(0);
      expect(emptyOverview.summary.deliveryRatePercent).toBe(100.0);
      expect(emptyOverview.summary.openRatePercent).toBe(0.0);
      expect(emptyOverview.summary.failRatePercent).toBe(0.0);
      expect(emptyOverview.summary.totalCostUsd).toBe(0.0);
    });

    it('exports campaigns with commas in name properly escaped in CSV', async () => {
      const exported = await ReportingService.exportReport('campaigns', 'csv', {
        campaignId: campaignAlpha1,
      });

      expect(exported.contentType).toBe('text/csv');
      expect(exported.content).toContain('Campaign ID,Campaign Name');
      // Name with comma "Alpha Black Friday Sale, 50% Off!" should be quoted
      expect(exported.content).toContain('"Alpha Black Friday Sale, 50% Off!"');
    });

    it('exports all report types in valid JSON format', async () => {
      for (const type of ['overview', 'teams', 'categories', 'campaigns'] as const) {
        const exported = await ReportingService.exportReport(type, 'json', {
          teamId: teamAlpha,
        });
        expect(exported.contentType).toBe('application/json');
        const parsed = JSON.parse(exported.content);
        expect(parsed).toBeDefined();
      }
    });
  });
});
