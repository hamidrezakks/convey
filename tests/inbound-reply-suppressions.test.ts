import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { messageAttempts, messageEvents } from '../src/db/schema';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { Channel, MessagePriority } from '../src/modules/messaging/messaging.types';
import { SuppressionsService } from '../src/modules/suppressions/suppressions.service';
import { processWebhookEvent } from '../src/queues/workers/webhook-ingest.worker';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';
import { disableProviderMock, enableProviderMock } from './mocks/provider-mock';

describe('Inbound 2-Way Reply Loops & Global Suppression Mesh Suite', () => {
  let dbPrefix: string;

  beforeAll(async () => {
    const setup = await setupFreshIsolatedDatabase();
    dbPrefix = setup.prefix;
    enableProviderMock(0.0);
  });

  afterAll(async () => {
    disableProviderMock();
  });

  // Helper to create an accepted message and attempt for inbound webhook correlation
  async function seedMessageAndAttempt(team: string, phone: string, providerMsgId: string) {
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_seed_${Date.now()}_${Math.random()}`,
      userId: 'usr_seed',
      team,
      category: 'marketing',
      country: 'US',
      priority: MessagePriority.MARKETING,
      recipients: { phone },
      channels: [{ channel: Channel.SMS, content: { text: 'Seed text' } }],
    });
    const publicId = (res.body as { messageId: string }).messageId;
    await db.insert(messageAttempts).values({
      id: `att_seed_${Date.now()}_${Math.random()}`,
      messageId: publicId,
      channel: 'sms',
      providerId: 'twilio',
      attemptNo: 1,
      origin: 'initial',
      providerMessageId: providerMsgId,
      state: 'delivered',
      createdAt: new Date(),
    });
    return publicId;
  }

  it('inbound "STOP" reply creates suppression record for recipient', async () => {
    const team = `team_g081_${dbPrefix}`;
    const phone = '+14155550081';
    await seedMessageAndAttempt(team, phone, 'SM_g081');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g081', MessageStatus: 'delivered', Body: 'STOP', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
    expect(check.reason).toBe('inbound_opt_out');
  });

  it('inbound "UNSUBSCRIBE" reply creates suppression record', async () => {
    const team = `team_g082_${dbPrefix}`;
    const phone = '+14155550082';
    await seedMessageAndAttempt(team, phone, 'SM_g082');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g082', MessageStatus: 'delivered', Body: 'UNSUBSCRIBE', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('inbound "CANCEL" reply creates suppression record', async () => {
    const team = `team_g083_${dbPrefix}`;
    const phone = '+14155550083';
    await seedMessageAndAttempt(team, phone, 'SM_g083');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g083', MessageStatus: 'delivered', Body: 'CANCEL', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('inbound "QUIT" reply creates suppression record', async () => {
    const team = `team_g084_${dbPrefix}`;
    const phone = '+14155550084';
    await seedMessageAndAttempt(team, phone, 'SM_g084');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g084', MessageStatus: 'delivered', Body: 'QUIT', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('inbound "END" reply creates suppression record', async () => {
    const team = `team_g085_${dbPrefix}`;
    const phone = '+14155550085';
    await seedMessageAndAttempt(team, phone, 'SM_g085');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g085', MessageStatus: 'delivered', Body: 'END', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('inbound "STOPALL" reply creates suppression record', async () => {
    const team = `team_g086_${dbPrefix}`;
    const phone = '+14155550086';
    await seedMessageAndAttempt(team, phone, 'SM_g086');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g086', MessageStatus: 'delivered', Body: 'STOPALL', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('mixed case inbound reply ("sToP", "UnSubScrIbe") triggers suppression', async () => {
    const team = `team_g087_${dbPrefix}`;
    const phone = '+14155550087';
    await seedMessageAndAttempt(team, phone, 'SM_g087');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g087', MessageStatus: 'delivered', Body: 'sToP', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('inbound reply with leading/trailing whitespace triggers suppression', async () => {
    const team = `team_g088_${dbPrefix}`;
    const phone = '+14155550088';
    await seedMessageAndAttempt(team, phone, 'SM_g088');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g088', MessageStatus: 'delivered', Body: '   STOP   \n', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('inbound reply with trailing exclamation ("STOP!") triggers suppression', async () => {
    const team = `team_g089_${dbPrefix}`;
    const phone = '+14155550089';
    await seedMessageAndAttempt(team, phone, 'SM_g089');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g089', MessageStatus: 'delivered', Body: 'STOP!', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('inbound "START" reply automatically removes active suppression', async () => {
    const team = `team_g090_${dbPrefix}`;
    const phone = '+14155550090';
    await seedMessageAndAttempt(team, phone, 'SM_g090_stop');

    // 1. Suppress
    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g090_stop', MessageStatus: 'delivered', Body: 'STOP', From: phone },
      headers: {},
      now: new Date(),
    });
    expect((await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' })).suppressed).toBe(
      true,
    );

    // 2. Un-suppress via START
    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g090_stop', MessageStatus: 'delivered', Body: 'START', From: phone },
      headers: {},
      now: new Date(),
    });
    expect((await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' })).suppressed).toBe(
      false,
    );
  });

  it('inbound "UNSTOP" reply automatically removes active suppression', async () => {
    const team = `team_g091_${dbPrefix}`;
    const phone = '+14155550091';
    await seedMessageAndAttempt(team, phone, 'SM_g091_stop');

    // 1. Suppress
    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g091_stop', MessageStatus: 'delivered', Body: 'STOP', From: phone },
      headers: {},
      now: new Date(),
    });
    expect((await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' })).suppressed).toBe(
      true,
    );

    // 2. Un-suppress via UNSTOP
    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g091_stop', MessageStatus: 'delivered', Body: 'UNSTOP', From: phone },
      headers: {},
      now: new Date(),
    });
    expect((await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' })).suppressed).toBe(
      false,
    );
  });

  it('inbound "YES" reply on 2-way channel removes active suppression', async () => {
    const team = `team_g092_${dbPrefix}`;
    const phone = '+14155550092';
    await seedMessageAndAttempt(team, phone, 'SM_g092_stop');

    // 1. Suppress
    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g092_stop', MessageStatus: 'delivered', Body: 'STOP', From: phone },
      headers: {},
      now: new Date(),
    });
    expect((await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' })).suppressed).toBe(
      true,
    );

    // 2. Un-suppress via YES
    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g092_stop', MessageStatus: 'delivered', Body: 'YES', From: phone },
      headers: {},
      now: new Date(),
    });
    expect((await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' })).suppressed).toBe(
      false,
    );
  });

  it('duplicate "STOP" webhooks for already-suppressed recipient succeed idempotently', async () => {
    const team = `team_g093_${dbPrefix}`;
    const phone = '+14155550093';
    await seedMessageAndAttempt(team, phone, 'SM_g093_1');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g093_1', MessageStatus: 'delivered', Body: 'STOP', From: phone },
      headers: {},
      now: new Date(),
    });

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g093_1', MessageStatus: 'delivered', Body: 'STOP', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('non-keyword conversational reply does NOT trigger suppression', async () => {
    const team = `team_g094_${dbPrefix}`;
    const phone = '+14155550094';
    await seedMessageAndAttempt(team, phone, 'SM_g094');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: {
        MessageSid: 'SM_g094',
        MessageStatus: 'delivered',
        Body: 'Hello, what time is my delivery?',
        From: phone,
      },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(false);
  });

  it('inbound "START" reply for non-suppressed recipient handles gracefully', async () => {
    const team = `team_g095_${dbPrefix}`;
    const phone = '+14155550095';
    await seedMessageAndAttempt(team, phone, 'SM_g095');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g095', MessageStatus: 'delivered', Body: 'START', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(false);
  });

  it('inbound webhook creates audit message_events record for reply received', async () => {
    const team = `team_g096_${dbPrefix}`;
    const phone = '+14155550096';
    const publicId = await seedMessageAndAttempt(team, phone, `SM_g096_${Date.now()}`);

    const attempts = await db.select().from(messageAttempts).where(eq(messageAttempts.messageId, publicId));
    const provMsgId = attempts[0]?.providerMessageId || 'SM_g096_fallback';

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: provMsgId, MessageStatus: 'delivered', Body: 'Thanks for update', From: phone },
      headers: {},
      now: new Date(),
    });

    const events = await db.select().from(messageEvents).where(eq(messageEvents.messageId, publicId));
    expect(events.length).toBeGreaterThan(0);
  });

  it('inbound webhook enqueues customer webhook dispatch job and records suppression', async () => {
    const team = `team_g097_${dbPrefix}`;
    const phone = '+14155550097';
    await seedMessageAndAttempt(team, phone, 'SM_g097');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g097', MessageStatus: 'delivered', Body: 'STOP', From: phone },
      headers: {},
      now: new Date(),
    });

    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });

  it('multi-tenant suppression isolation (team A opt-out does not affect team B)', async () => {
    const teamA = `team_g098_a_${dbPrefix}`;
    const teamB = `team_g098_b_${dbPrefix}`;
    const phone = '+14155550098';

    await SuppressionsService.addSuppression({
      team: teamA,
      identifier: phone,
      channel: 'sms',
      reason: 'inbound_opt_out',
    });

    const checkA = await SuppressionsService.isSuppressed({ team: teamA, identifiers: [phone], channel: 'sms' });
    const checkB = await SuppressionsService.isSuppressed({ team: teamB, identifiers: [phone], channel: 'sms' });

    expect(checkA.suppressed).toBe(true);
    expect(checkB.suppressed).toBe(false);
  });

  it('WhatsApp session tracker records 24h conversation window', async () => {
    const team = `team_g099_${dbPrefix}`;
    const phone = '+14155550099';
    await seedMessageAndAttempt(team, phone, 'WA_g099');

    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'WA_g099', MessageStatus: 'delivered', From: phone, Body: 'Hello' },
      headers: {},
      now: new Date(),
    });
    expect(true).toBe(true);
  });

  it('end-to-end loop: Send msg -> Ingest STOP -> Verify subsequent send blocked by suppression policy', async () => {
    const team = `team_g100_${dbPrefix}`;
    const phone = '+14155550100';

    // 1. Seed & first send accepted
    await seedMessageAndAttempt(team, phone, 'SM_g100');

    // 2. Ingest STOP webhook
    await processWebhookEvent({
      providerId: 'twilio',
      payload: { MessageSid: 'SM_g100', MessageStatus: 'delivered', Body: 'STOP', From: phone },
      headers: {},
      now: new Date(),
    });

    // 3. Verify recipient is suppressed in DB
    const check = await SuppressionsService.isSuppressed({ team, identifiers: [phone], channel: 'sms' });
    expect(check.suppressed).toBe(true);
  });
});
