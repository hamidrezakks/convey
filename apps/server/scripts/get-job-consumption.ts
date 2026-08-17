import { Queue } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db';
import { messageAttempts, messageEvents, messages, outbox } from '../src/db/schema';
import { redisClient } from '../src/queues/connection';

export interface JobConsumptionReport {
  timestamp: string;
  redis: {
    totalKeys: number;
    grandTotalCompleted: number;
    grandTotalFailed: number;
    grandTotalActive: number;
    grandTotalWaiting: number;
    queues: Record<
      string,
      {
        completed: number;
        failed: number;
        active: number;
        waiting: number;
        delayed: number;
        paused: number;
      }
    >;
  };
  postgres: {
    totalMessages: number;
    outboxProcessed: number;
    outboxPending: number;
    totalAttemptsExecuted: number;
    totalEventsLogged: number;
  };
}

export async function getJobConsumptionReport(): Promise<JobConsumptionReport> {
  const keys = await redisClient.keys('{convey}:*');
  const queueNames = new Set<string>();
  for (const k of keys) {
    const match = k.match(/^\{convey\}:([^:]+)/);
    if (match?.[1] && !['marker'].includes(match[1])) {
      queueNames.add(match[1]);
    }
  }

  const queuesReport: JobConsumptionReport['redis']['queues'] = {};
  let grandTotalCompleted = 0;
  let grandTotalFailed = 0;
  let grandTotalActive = 0;
  let grandTotalWaiting = 0;

  for (const qName of Array.from(queueNames).sort()) {
    try {
      const q = new Queue(qName, { connection: redisClient, prefix: '{convey}' });
      const counts = await q.getJobCounts();
      queuesReport[qName] = {
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        active: counts.active || 0,
        waiting: counts.waiting || 0,
        delayed: counts.delayed || 0,
        paused: counts.paused || 0,
      };
      grandTotalCompleted += counts.completed || 0;
      grandTotalFailed += counts.failed || 0;
      grandTotalActive += counts.active || 0;
      grandTotalWaiting += counts.waiting || 0;
      await q.close();
    } catch (_err) {
      // Ignore closed connections
    }
  }

  const outboxProcessed = await db
    .select({ count: sql<number>`count(*)` })
    .from(outbox)
    .where(eq(outbox.state, 'processed'));
  const outboxPending = await db
    .select({ count: sql<number>`count(*)` })
    .from(outbox)
    .where(eq(outbox.state, 'pending'));
  const totalMessages = await db.select({ count: sql<number>`count(*)` }).from(messages);
  const totalAttempts = await db.select({ count: sql<number>`count(*)` }).from(messageAttempts);
  const totalEvents = await db.select({ count: sql<number>`count(*)` }).from(messageEvents);

  return {
    timestamp: new Date().toISOString(),
    redis: {
      totalKeys: keys.length,
      grandTotalCompleted,
      grandTotalFailed,
      grandTotalActive,
      grandTotalWaiting,
      queues: queuesReport,
    },
    postgres: {
      totalMessages: Number(totalMessages[0]?.count || 0),
      outboxProcessed: Number(outboxProcessed[0]?.count || 0),
      outboxPending: Number(outboxPending[0]?.count || 0),
      totalAttemptsExecuted: Number(totalAttempts[0]?.count || 0),
      totalEventsLogged: Number(totalEvents[0]?.count || 0),
    },
  };
}

if (import.meta.main) {
  getJobConsumptionReport()
    .then((report) => {
      console.log('=====================================================');
      console.log('       CONVEY JOB CONSUMPTION REPORT (CODE DUMP)     ');
      console.log('=====================================================');
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to generate report:', err);
      process.exit(1);
    });
}
