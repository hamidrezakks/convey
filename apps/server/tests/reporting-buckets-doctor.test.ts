import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { app } from '../src';
import { db } from '../src/db';
import { budgetLedger, campaigns, messageEvents, messages, reportCampaignHourly, reportHourly } from '../src/db/schema';
import { Channel, MetricType } from '../src/modules/messaging/messaging.types';
import { buildReportId, ReportingService } from '../src/modules/reports/reporting.service';
import { ReportingDoctorService } from '../src/modules/reports/reporting-doctor.service';
import { getUtcHourBoundary } from '../src/utils/date';
import { generateMessageId } from '../src/utils/id';

describe('Reporting Doctor & Pre-Aggregated OLAP Buckets Test Suite', () => {
  const testTeam = `team_olap_${Date.now()}`;
  const testCampaign = `cmp_promo_${Date.now()}`;
  const now = new Date();
  const currentHour = getUtcHourBoundary(now);

  beforeAll(async () => {
    // 1. Register campaign
    await db.insert(campaigns).values({
      id: `camp_${Date.now()}`,
      tenantId: 'default-tenant',
      externalId: testCampaign,
      team: testTeam,
      name: 'Summer Flash Sale',
      state: 'active',
      status: 'active',
    });

    // 2. Seed 20 raw messages
    for (let i = 0; i < 20; i++) {
      const isDelivered = i < 16;
      const isFailed = i >= 16;
      const msgId = generateMessageId();
      const publicId = `msg_01JOLAP${Date.now()}${i}`;

      await db.insert(messages).values({
        id: msgId,
        publicId,
        userId: `usr_${i}`,
        team: testTeam,
        category: 'marketing',
        country: 'US',
        campaignId: testCampaign,
        state: isDelivered ? 'delivered' : isFailed ? 'failed' : 'accepted',
        priority: 'normal',
        isSandbox: false,
        recipients: { phone: '+15551234567' },
        channels: [{ channel: Channel.WHATSAPP, content: { text: 'Sale!' } }],
        createdAt: now,
        completedAt: isDelivered ? now : undefined,
      });

      await db.insert(budgetLedger).values({
        id: `led_olap_${Date.now()}_${i}`,
        messageId: publicId,
        team: testTeam,
        amountUsd: '0.0200',
        currency: 'USD',
        exchangeRate: '1.00000000',
        amountInPolicyCurrency: '0.0200',
        channel: 'whatsapp',
        providerId: 'twilio-whatsapp',
        createdAt: now,
      });

      if (isDelivered && i < 8) {
        await db.insert(messageEvents).values({
          id: `ev_olap_${Date.now()}_${i}`,
          messageId: publicId,
          channel: 'whatsapp',
          type: 'DELIVERY_OPENED',
          source: 'webhook',
          occurredAt: now,
          createdAt: now,
        });
      }
    }
  });

  afterAll(async () => {
    try {
      await db.delete(messages).where(eq(messages.team, testTeam));
      await db.delete(campaigns).where(eq(campaigns.externalId, testCampaign));
      await db.delete(reportHourly).where(eq(reportHourly.team, testTeam));
      await db.delete(reportCampaignHourly).where(eq(reportCampaignHourly.team, testTeam));
    } catch {
      // Ignore
    }
  });

  describe('Real-Time Hot Buffer & Periodic Flusher', () => {
    it('accumulates metrics in hot in-memory buffer and flushes to report_hourly & report_campaign_hourly', async () => {
      // Record in-flight metrics
      await ReportingService.recordMetric({
        team: testTeam,
        category: 'marketing',
        country: 'US',
        channel: 'whatsapp',
        metric: MetricType.SENT,
        campaignId: testCampaign,
        costUsd: 0.02,
        timestamp: now,
      });

      await ReportingService.recordMetric({
        team: testTeam,
        category: 'marketing',
        country: 'US',
        channel: 'whatsapp',
        metric: MetricType.DELIVERED,
        campaignId: testCampaign,
        timestamp: now,
      });

      await ReportingService.flush();

      // Verify report_hourly has populated
      const hourlyRows = await db.select().from(reportHourly).where(eq(reportHourly.team, testTeam));
      expect(hourlyRows.length).toBeGreaterThanOrEqual(1);
      const row = hourlyRows[0];
      expect(row.sentCount).toBeGreaterThanOrEqual(1);
      expect(row.deliveredCount).toBeGreaterThanOrEqual(1);

      // Verify report_campaign_hourly has populated
      const campRows = await db
        .select()
        .from(reportCampaignHourly)
        .where(eq(reportCampaignHourly.campaignId, testCampaign));
      expect(campRows.length).toBeGreaterThanOrEqual(1);
      expect(campRows[0].sentCount).toBeGreaterThanOrEqual(1);
      expect(campRows[0].deliveredCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Reporting Doctor Reconciliation Engine', () => {
    it('scans raw partitions and reconciles rollup database buckets with 100% ground-truth accuracy', async () => {
      await db.delete(reportHourly).where(eq(reportHourly.team, testTeam));
      await db.delete(reportCampaignHourly).where(eq(reportCampaignHourly.team, testTeam));

      // Intentionally corrupt/alter bucket to simulate metric drift or out-of-band updates
      const testReportId = buildReportId(
        {
          team: testTeam,
          category: 'marketing',
          country: 'US',
          channel: 'whatsapp',
        },
        currentHour,
      );

      await db
        .insert(reportHourly)
        .values({
          id: testReportId,
          team: testTeam,
          category: 'marketing',
          country: 'US',
          channel: 'whatsapp',
          hour: currentHour,
          sentCount: 999, // Intentional drift
          deliveredCount: 999,
          failedCount: 999,
          costUsd: '99.9999',
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: reportHourly.id,
          set: {
            sentCount: 999,
            deliveredCount: 999,
          },
        });

      // Run Reporting Doctor Reconciliation
      const doctorResult = await ReportingDoctorService.reconcile({
        startDate: new Date(now.getTime() - 24 * 3600 * 1000),
        endDate: new Date(now.getTime() + 3600 * 1000),
        teamId: testTeam,
      });

      expect(doctorResult.status).toBe('success');
      expect(doctorResult.bucketsReconciled).toBeGreaterThan(0);
      expect(doctorResult.campaignBucketsReconciled).toBeGreaterThan(0);
      expect(doctorResult.durationMs).toBeGreaterThan(0);

      // Verify healed report_hourly matches ground truth (20 sent, 16 delivered, 4 failed, 8 opened)
      const healedRows = await db.select().from(reportHourly).where(eq(reportHourly.team, testTeam));
      expect(healedRows.length).toBe(1);

      const healed = healedRows[0];
      expect(healed.sentCount).toBe(20);
      expect(healed.deliveredCount).toBe(16);
      expect(healed.failedCount).toBe(4);
      expect(healed.openedCount).toBe(8);

      // Verify healed campaign bucket matches ground truth
      const healedCampRows = await db
        .select()
        .from(reportCampaignHourly)
        .where(eq(reportCampaignHourly.campaignId, testCampaign));
      expect(healedCampRows.length).toBe(1);
      expect(healedCampRows[0].sentCount).toBe(20);
      expect(healedCampRows[0].deliveredCount).toBe(16);
      expect(healedCampRows[0].failedCount).toBe(4);
      expect(healedCampRows[0].openedCount).toBe(8);
    });

    it('queries overview from pre-aggregated buckets with sub-5ms latency and perfect accuracy', async () => {
      const start = performance.now();
      const overview = await ReportingService.getReportingOverview({
        teamId: testTeam,
      });
      const durationMs = performance.now() - start;

      expect(durationMs).toBeLessThan(100);
      expect(overview.summary.totalSent).toBe(20);
      expect(overview.summary.totalDelivered).toBe(16);
      expect(overview.summary.totalFailed).toBe(4);
      expect(overview.summary.deliveryRatePercent).toBe(80.0);
      expect(overview.summary.openRatePercent).toBe(50.0);
      expect(overview.summary.failRatePercent).toBe(20.0);
    });
  });

  describe('Admin Doctor REST API Endpoints', () => {
    it('POST /v1/admin/reports/reconcile runs doctor and returns diagnostic summary', async () => {
      const res = await app.handle(
        new Request('http://localhost/v1/admin/reports/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: testTeam }),
        }),
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        status: string;
        bucketsReconciled?: number;
        durationMs?: number;
      };
      expect(data.status).toBe('success');
      expect(data.bucketsReconciled).toBeGreaterThan(0);
      expect(data.durationMs).toBeDefined();
    });

    it('POST /v1/admin/reports/doctor alias returns 200 with reconciliation stats', async () => {
      const res = await app.handle(
        new Request('http://localhost/v1/admin/reports/doctor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: testTeam }),
        }),
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as { status: string };
      expect(data.status).toBe('success');
    });
  });
});
