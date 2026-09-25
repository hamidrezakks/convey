import { env } from '../../config/env';
import { db } from '../../db';
import { messageEvents } from '../../db/schema';
import { redisClient } from '../../queues/connection';
import { webhookIngestQueue } from '../../queues/queue-definitions';
import { hashString, safeTimingCompare } from '../../utils/crypto';
import { generateMessageId } from '../../utils/id';
import { formatRedisKey } from '../../utils/redis-keys';
import { CascadeManager } from '../messaging/cascade-manager';
import {
  AttemptState,
  type ClientReceiptPayload,
  EventSource,
  JobName,
  SystemProvider,
  WebhookStatus,
} from '../messaging/messaging.types';
import { ProviderRegistry } from '../providers/core/provider-registry';
import { verifyIngressSignature } from './signature';

export const WEBHOOK_DEDUPLICATION_TTL_SECONDS = 86_400; // 24 hours
export const TRACKING_PIXEL_DEDUPLICATION_TTL_SECONDS = 3_600; // 1 hour

export enum WebhookFlowType {
  STATUS = 'status',
  INCOMING = 'incoming',
  GENERAL = 'general',
}

export function resolveProviderAlias(providerId: string): string {
  const normalized = providerId.toLowerCase().trim();
  if (normalized === 'whatsapp') {
    return 'whatsapp-business';
  }
  return normalized;
}

export function verifyHubChallenge(
  _providerId: string,
  query: Record<string, string | undefined>,
): { verified: boolean; challenge?: string } {
  const mode = query['hub.mode'] || query.mode;
  const token = query['hub.verify_token'] || query.verify_token;
  const challenge = query['hub.challenge'] || query.challenge;

  if (mode !== 'subscribe' || !challenge || !token) {
    return { verified: false };
  }

  const expectedToken =
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.META_VERIFY_TOKEN;
  if (!expectedToken) return { verified: false };

  if (safeTimingCompare(token, expectedToken)) {
    return { verified: true, challenge };
  }

  return { verified: false };
}

export async function verifyWebhookSignature(
  mod: ReturnType<typeof ProviderRegistry.getModule>,
  req?: Request,
  rawString?: string,
): Promise<boolean> {
  if (!mod || !req || rawString === undefined) return false;
  if (mod.webhook?.verifySignature) return await mod.webhook.verifySignature(req, rawString);
  if (process.env.CONVEY_ALLOW_UNSIGNED_WEBHOOKS === 'true' && env.NODE_ENV !== 'production') return true;
  const secret =
    process.env[`CONVEY_WEBHOOK_SECRET_${mod.id.toUpperCase().replace(/-/g, '_')}`] ||
    process.env.CONVEY_WEBHOOK_SECRET;
  return verifyIngressSignature(req, rawString, secret);
}

export function extractEventId(headers: Record<string, string>, rawString: string): string {
  const rawId = headers['x-event-id'] || headers['stripe-signature'] || rawString.slice(0, 32);
  return rawId.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function deduplicateEvent(key: string, ttlSeconds = WEBHOOK_DEDUPLICATION_TTL_SECONDS): Promise<boolean> {
  const isNew = await redisClient.set(key, '1', 'EX', ttlSeconds, 'NX');
  return isNew !== null;
}

export function buildReceiptEventRecord(receipt: Record<string, unknown>, now = new Date()) {
  const messageId = receipt.messageId as string;
  const event = (receipt.event as string) || AttemptState.DELIVERED;
  return {
    id: generateMessageId(),
    messageId,
    channel: (receipt.channel as string) || 'unknown',
    providerId: SystemProvider.CLIENT_RECEIPT,
    type: `receipt.${event}`,
    source: EventSource.CLIENT,
    metadata: receipt,
    occurredAt: now,
    createdAt: now,
  };
}

export const WebhooksService = {
  verifyHubChallenge,
  resolveProviderAlias,

  async ingestWebhook(
    rawProviderId: string,
    payload: unknown,
    headers: Record<string, string>,
    req?: Request,
    flowType: WebhookFlowType = WebhookFlowType.GENERAL,
  ) {
    const providerId = resolveProviderAlias(rawProviderId);
    const mod = ProviderRegistry.getModule(providerId);
    const rawString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const isVerified = await verifyWebhookSignature(mod, req, rawString);
    if (!isVerified) {
      return { status: WebhookStatus.UNAUTHORIZED };
    }

    const eventId = hashString(rawString);
    const jobId = `webhook_${providerId}_${flowType}_${eventId}`;
    if (await webhookIngestQueue.getJob(jobId)) return { status: WebhookStatus.DUPLICATE_IGNORED };
    let parsedPayload = payload;
    if (typeof payload === 'string') {
      parsedPayload = req?.headers.get('content-type')?.includes('application/x-www-form-urlencoded')
        ? Object.fromEntries(new URLSearchParams(payload))
        : JSON.parse(payload);
    }
    // Queue persistence is the acknowledgement boundary; never acknowledge a failed enqueue.
    await webhookIngestQueue.add(
      JobName.PROCESS_WEBHOOK,
      {
        providerId,
        payload: parsedPayload,
        headers,
        flowType,
        receivedAt: new Date().toISOString(),
      },
      {
        jobId,
        removeOnComplete: { age: WEBHOOK_DEDUPLICATION_TTL_SECONDS },
        removeOnFail: { age: WEBHOOK_DEDUPLICATION_TTL_SECONDS },
      },
    );

    return { status: WebhookStatus.ACCEPTED, received: true };
  },

  async ingestTrackingPixel(token: string) {
    const isNew = await deduplicateEvent(
      formatRedisKey(`pixel-event:${token}`),
      TRACKING_PIXEL_DEDUPLICATION_TTL_SECONDS,
    );
    if (!isNew) return;

    await webhookIngestQueue.add(JobName.PROCESS_OPEN_PIXEL, {
      token,
      receivedAt: new Date().toISOString(),
    });
  },

  async ingestClientReceipt(receipt: ClientReceiptPayload) {
    if (!receipt.messageId) return;
    await db.insert(messageEvents).values(buildReceiptEventRecord(receipt));
    await CascadeManager.cancelRemainingSteps(receipt.messageId);
  },
};
