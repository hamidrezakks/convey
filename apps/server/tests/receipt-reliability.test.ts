import { beforeAll, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db';
import {
  messageAttempts,
  messageEvents,
  messages,
  outbox,
  reportHourly,
  teamOwners,
  tenants,
  webhookSubscriptions,
} from '../src/db/schema';
import { buildMessageAndOutboxRecords } from '../src/modules/messaging/messaging.service';
import { Channel } from '../src/modules/messaging/messaging.types';
import {
  findCorrelatedAttempt,
  handleStatusUpdate,
  processSingleWebhookEvent,
} from '../src/queues/workers/webhook-ingest.worker';
import { resolveMonotonicState } from '../src/utils/message-state';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';

beforeAll(async () => {
  await setupFreshIsolatedDatabase();
});

test('success evidence never regresses', () => {
  for (const current of ['delivered', 'opened', 'read']) {
    for (const next of ['failed', 'bounced', 'dispatched']) expect(resolveMonotonicState(current, next)).toBe(current);
  }
  expect(resolveMonotonicState('read', 'delivered')).toBe('read');
  expect(resolveMonotonicState('failed', 'delivered')).toBe('delivered');
  expect(resolveMonotonicState('cancelled', 'delivered')).toBe('cancelled');
});

test('unmatched receipts fail for bounded queue retry instead of being acknowledged', async () => {
  await expect(
    processSingleWebhookEvent(
      { providerMessageId: 'not-persisted-yet', normalizedStatus: 'delivered', timestamp: new Date(), rawPayload: {} },
      'test-provider',
      new Date(),
    ),
  ).rejects.toThrow('before its attempt');
});

test('provider collision isolation and concurrent receipts produce one notification and metric', async () => {
  const now = new Date();
  const team = `receipt_${crypto.randomUUID()}`;
  const { messageRecord, publicId } = buildMessageAndOutboxRecords(
    {
      team,
      userId: 'receipt-user',
      category: 'test',
      country: 'US',
      idempotencyKey: crypto.randomUUID(),
      recipients: { email: 'recipient@example.com' },
      channels: [{ channel: Channel.EMAIL, content: { subject: 'test', text: 'test' } }],
    },
    now,
    false,
  );
  await db.insert(messages).values(messageRecord);
  await db.insert(tenants).values({ id: 'receipt-tenant', name: 'Receipt tenant', slug: 'receipt-tenant' });
  await db.insert(teamOwners).values({ team, tenantId: 'receipt-tenant' });
  await db.insert(webhookSubscriptions).values({
    id: `sub_${team}`,
    tenantId: 'receipt-tenant',
    team,
    url: 'https://example.com/webhook',
    secret: 'test-secret',
    events: ['*'],
  });
  const common = {
    messageId: publicId,
    channel: 'email',
    attemptNo: 1,
    origin: 'initial',
    state: 'dispatched',
    providerMessageId: 'collision',
    createdAt: now,
  };
  const [attempt] = await db
    .insert(messageAttempts)
    .values({ ...common, id: `attempt_${team}`, providerId: 'provider-a' })
    .returning();
  await db
    .insert(messageAttempts)
    .values({ ...common, id: `other_${team}`, providerId: 'provider-b', createdAt: new Date(now.getTime() + 1) });
  expect((await findCorrelatedAttempt('provider-a', 'collision', new Date(now.getTime() + 100)))?.id).toBe(attempt.id);
  const event = { providerMessageId: 'collision', normalizedStatus: 'delivered', timestamp: now, rawPayload: {} };
  await Promise.all([handleStatusUpdate(attempt, event, now), handleStatusUpdate(attempt, event, now)]);
  await handleStatusUpdate(attempt, { ...event, normalizedStatus: 'failed' }, now);
  const [msg] = await db.select().from(messages).where(eq(messages.publicId, publicId));
  expect(msg.state).toBe('delivered');
  const events = await db
    .select()
    .from(messageEvents)
    .where(and(eq(messageEvents.messageId, publicId), eq(messageEvents.type, 'delivery.delivered')));
  expect(events).toHaveLength(1);
  const notifications = await db
    .select()
    .from(outbox)
    .where(and(eq(outbox.messageId, publicId), eq(outbox.type, 'webhook.customer')));
  expect(notifications).toHaveLength(1);
  expect(notifications[0].payload.subscriptionId).toBe(`sub_${team}`);
  expect(JSON.stringify(notifications[0].payload)).not.toContain('collision');
  const [metric] = await db.select().from(reportHourly).where(eq(reportHourly.team, team));
  expect(metric.deliveredCount).toBe(1);
});
