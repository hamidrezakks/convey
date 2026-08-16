import { createHmac } from 'node:crypto';
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { webhookDeliveries, webhookSubscriptions } from '../../db/schema';
import { FullJitterRetry } from '../../utils/full-jitter-retry';
import { generateMessageId } from '../../utils/id';
import { logger } from '../../utils/logger';
import { formatBullMQPrefix } from '../../utils/redis-keys';
import { TraceContext, type TraceContextData } from '../../utils/trace-context';
import { redisConnectionOptions } from '../connection';
import { customerWebhookDispatchQueue } from '../queue-definitions';

export interface CustomerWebhookJobData {
  subscriptionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attemptNo?: number;
  traceContext?: TraceContextData;
}

export function computeWebhookSignature(secret: string, timestamp: number, payloadJson: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(`${timestamp}.${payloadJson}`);
  return `t=${timestamp},v1=${hmac.digest('hex')}`;
}

export async function processCustomerWebhookJob(data: CustomerWebhookJobData): Promise<void> {
  const { subscriptionId, eventType, payload } = data;
  const currentAttempt = data.attemptNo || 1;

  const subs = await db.select().from(webhookSubscriptions).where(eq(webhookSubscriptions.id, subscriptionId));

  if (!subs.length || !subs[0].active) {
    return;
  }

  const sub = subs[0];
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  const payloadJson = JSON.stringify({
    event: eventType,
    timestamp: now.toISOString(),
    data: payload,
  });

  const signature = computeWebhookSignature(sub.secret, timestamp, payloadJson);
  const traceCtx = data.traceContext ? TraceContext.createChild(data.traceContext) : TraceContext.create();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Convey-WebhookDispatcher/1.0',
    'X-Convey-Signature': signature,
  };
  TraceContext.injectHeaders(traceCtx, headers);

  const startTime = performance.now();
  let statusCode: number | null = null;
  let errorMsg: string | null = null;

  try {
    const res = await fetch(sub.url, {
      method: 'POST',
      headers,
      body: payloadJson,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    statusCode = res.status;
    if (!res.ok) {
      errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
    }
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Math.round(performance.now() - startTime);

  await db.insert(webhookDeliveries).values({
    id: generateMessageId(),
    subscriptionId: sub.id,
    tenantId: sub.tenantId,
    eventType,
    payload,
    statusCode,
    responseTimeMs: durationMs,
    error: errorMsg,
    createdAt: now,
  });

  // Full Jitter Backoff Retry on transient HTTP 5xx, 429, or network errors (up to 3 attempts)
  if (errorMsg && currentAttempt < 3 && (!statusCode || statusCode >= 500 || statusCode === 429)) {
    const delayMs = FullJitterRetry.calculateBackoffMs(currentAttempt, 1000, 15000);
    logger.warn(
      'WebhookDispatcher',
      `Transient delivery failure to ${sub.url} (Attempt ${currentAttempt}/3). Retrying in ${delayMs}ms. Error: ${errorMsg}`,
    );

    await customerWebhookDispatchQueue.add(
      'dispatch-customer-webhook',
      {
        ...data,
        attemptNo: currentAttempt + 1,
        traceContext: traceCtx,
      },
      { delay: delayMs },
    );
  } else if (errorMsg) {
    logger.warn('WebhookDispatcher', `Permanent delivery failure for subscription ${sub.id} (${sub.url}): ${errorMsg}`);
  }
}

export function createCustomerWebhookWorker() {
  return new Worker<CustomerWebhookJobData>(
    customerWebhookDispatchQueue.name,
    async (job) => {
      await processCustomerWebhookJob(job.data);
    },
    { connection: redisConnectionOptions, concurrency: 10, prefix: formatBullMQPrefix() },
  );
}

export const customerWebhookWorker = createCustomerWebhookWorker();
