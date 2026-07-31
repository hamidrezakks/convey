import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { reportHourly } from '../../db/schema';
import { getUtcHourBoundary } from '../../utils/date';
import { MetricType } from '../messaging/messaging.types';

export interface RecordMetricParams {
  team: string;
  category: string;
  country: string;
  channel: string;
  metric: MetricType;
  timestamp?: Date;
}

export function buildReportId(params: RecordMetricParams, hour: Date): string {
  const hourIso = hour.toISOString().replace(/[:.-]/g, '_');
  return `rep_${params.team}_${params.category}_${params.country}_${params.channel}_${hourIso}`;
}

interface MetricBucket {
  params: RecordMetricParams;
  hour: Date;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  read: number;
}

const metricBuckets = new Map<string, MetricBucket>();

export async function flushMetrics(): Promise<void> {
  if (metricBuckets.size === 0) return;

  const entries = Array.from(metricBuckets.entries());
  metricBuckets.clear();

  for (const [reportId, bucket] of entries) {
    const now = bucket.params.timestamp || new Date();
    await db
      .insert(reportHourly)
      .values({
        id: reportId,
        team: bucket.params.team,
        category: bucket.params.category,
        country: bucket.params.country,
        channel: bucket.params.channel,
        hour: bucket.hour,
        sentCount: bucket.sent,
        deliveredCount: bucket.delivered,
        failedCount: bucket.failed,
        openedCount: bucket.opened,
        readCount: bucket.read,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: reportHourly.id,
        set: {
          sentCount: bucket.sent > 0 ? sql`${reportHourly.sentCount} + ${bucket.sent}` : reportHourly.sentCount,
          deliveredCount:
            bucket.delivered > 0
              ? sql`${reportHourly.deliveredCount} + ${bucket.delivered}`
              : reportHourly.deliveredCount,
          failedCount:
            bucket.failed > 0 ? sql`${reportHourly.failedCount} + ${bucket.failed}` : reportHourly.failedCount,
          openedCount:
            bucket.opened > 0 ? sql`${reportHourly.openedCount} + ${bucket.opened}` : reportHourly.openedCount,
          readCount: bucket.read > 0 ? sql`${reportHourly.readCount} + ${bucket.read}` : reportHourly.readCount,
          updatedAt: now,
        },
      });
  }
}

let flusherTimer: ReturnType<typeof setInterval> | null = null;

export function startMetricsFlusher(intervalMs = 5000): void {
  if (flusherTimer || process.env.NODE_ENV === 'test') return;
  flusherTimer = setInterval(() => {
    ReportingService.flush().catch((err) => {
      console.error(`ReportingService background flush error: ${(err as Error).message}`);
    });
  }, intervalMs);
}

export function stopMetricsFlusher(): void {
  if (flusherTimer) {
    clearInterval(flusherTimer);
    flusherTimer = null;
  }
}

export const ReportingService = {
  flush: flushMetrics,
  startFlusher: startMetricsFlusher,
  stopFlusher: stopMetricsFlusher,

  async recordMetric(params: RecordMetricParams): Promise<void> {
    const now = params.timestamp || new Date();
    const hour = getUtcHourBoundary(now);
    const reportId = buildReportId(params, hour);

    let bucket = metricBuckets.get(reportId);
    if (!bucket) {
      bucket = { params, hour, sent: 0, delivered: 0, failed: 0, opened: 0, read: 0 };
      metricBuckets.set(reportId, bucket);
    }

    if (params.metric === MetricType.SENT) bucket.sent += 1;
    else if (params.metric === MetricType.DELIVERED) bucket.delivered += 1;
    else if (params.metric === MetricType.FAILED) bucket.failed += 1;
    else if (params.metric === MetricType.OPENED) bucket.opened += 1;
    else if (params.metric === MetricType.READ) bucket.read += 1;

    if (process.env.NODE_ENV === 'test') {
      await flushMetrics();
    }
  },
};
