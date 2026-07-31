import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { webhookSubscriptions } from '../../db/schema';
import { customerWebhookDispatchQueue } from '../../queues/queue-definitions';
import { generateMessageId } from '../../utils/id';

export const WebhookSubscriptionsService = {
  async createSubscription(params: {
    tenantId: string;
    team: string;
    url: string;
    events: string[];
    secret?: string;
  }) {
    const id = generateMessageId();
    const secret = params.secret || randomBytes(24).toString('hex');

    const [sub] = await db
      .insert(webhookSubscriptions)
      .values({
        id,
        tenantId: params.tenantId,
        team: params.team,
        url: params.url,
        secret,
        events: params.events,
        active: true,
      })
      .returning();

    return sub;
  },

  async listSubscriptions(tenantId: string, team: string) {
    return await db
      .select()
      .from(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.tenantId, tenantId), eq(webhookSubscriptions.team, team)));
  },

  async deleteSubscription(tenantId: string, team: string, id: string) {
    const deleted = await db
      .delete(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.id, id),
          eq(webhookSubscriptions.tenantId, tenantId),
          eq(webhookSubscriptions.team, team),
        ),
      )
      .returning();

    return deleted.length > 0;
  },

  async triggerEventForTenant(tenantId: string, team: string, eventType: string, payload: Record<string, unknown>) {
    const subs = await db
      .select()
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.tenantId, tenantId),
          eq(webhookSubscriptions.team, team),
          eq(webhookSubscriptions.active, true),
        ),
      );

    const matchingSubs = subs.filter((sub) => sub.events.includes(eventType) || sub.events.includes('*'));

    const jobs = matchingSubs.map((sub) => ({
      name: 'dispatch-webhook',
      data: {
        subscriptionId: sub.id,
        eventType,
        payload,
      },
    }));

    if (jobs.length > 0) {
      await customerWebhookDispatchQueue.addBulk(jobs);
    }
  },
};
