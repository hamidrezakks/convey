import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, type Transaction } from '../../db';
import { outbox, teamOwners, webhookSubscriptions } from '../../db/schema';
import { generateMessageId } from '../../utils/id';
import { validateWebhookUrl } from '../../utils/webhook-destination';

export const WebhookSubscriptionsService = {
  async createSubscription(params: { tenantId: string; team: string; url: string; events: string[]; secret?: string }) {
    validateWebhookUrl(params.url);
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

    if (matchingSubs.length)
      await db.insert(outbox).values(
        matchingSubs.map((sub) => ({
          id: generateMessageId(),
          messageId: String(payload.messageId || sub.id),
          type: 'webhook.customer',
          payload: { subscriptionId: sub.id, eventType, payload },
        })),
      );
  },

  async triggerEventForTeam(
    team: string,
    eventType: string,
    payload: Record<string, unknown>,
    tx: Transaction | typeof db = db,
  ) {
    const [owner] = await tx.select().from(teamOwners).where(eq(teamOwners.team, team));
    if (!owner) return;
    const subs = await tx
      .select()
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.team, team),
          eq(webhookSubscriptions.tenantId, owner.tenantId),
          eq(webhookSubscriptions.active, true),
        ),
      );
    const matching = subs.filter((sub) => sub.events.includes(eventType) || sub.events.includes('*'));
    if (matching.length)
      await tx.insert(outbox).values(
        matching.map((sub) => ({
          id: generateMessageId(),
          messageId: String(payload.messageId || sub.id),
          type: 'webhook.customer',
          payload: { subscriptionId: sub.id, eventType, payload },
        })),
      );
  },
};
