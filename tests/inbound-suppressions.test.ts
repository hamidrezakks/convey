import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '../src/db';
import { messageAttempts } from '../src/db/schema';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { Channel, MessagePriority } from '../src/modules/messaging/messaging.types';
import { SuppressionsService } from '../src/modules/suppressions/suppressions.service';
import { processWebhookEvent } from '../src/queues/workers/webhook-ingest.worker';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';
import { disableProviderMock, enableProviderMock } from './mocks/provider-mock';

describe('Inbound 2-Way Reply Loops & Automated Global Suppression Mesh', () => {
  let dbPrefix: string;

  beforeAll(async () => {
    const setup = await setupFreshIsolatedDatabase();
    dbPrefix = setup.prefix;
    enableProviderMock(0);
  });

  afterAll(() => {
    disableProviderMock();
  });

  it('Automatically creates suppression record when recipient replies STOP via inbound webhook', async () => {
    const team = `team_inbound_${dbPrefix}`;
    const recipientPhone = '+14155557788';

    // 1. Initial outbound message
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_inbound_${Date.now()}`,
      userId: 'usr_inbound_1',
      team,
      category: 'marketing',
      country: 'US',
      priority: MessagePriority.MARKETING,
      recipients: { phone: recipientPhone },
      channels: [{ channel: Channel.SMS, content: { text: 'Special offer today!' } }],
    });

    const publicId = (res.body as { messageId: string }).messageId;

    // Create an initial message attempt record
    const attemptId = `att_${Date.now()}`;
    await db.insert(messageAttempts).values({
      id: attemptId,
      messageId: publicId,
      channel: 'sms',
      providerId: 'twilio',
      attemptNo: 1,
      origin: 'initial',
      providerMessageId: `SM_inbound_${publicId}`,
      state: 'delivered',
      createdAt: new Date(),
    });

    // 2. Ingest inbound webhook from Twilio with "STOP"
    const now = new Date();
    await processWebhookEvent({
      providerId: 'twilio',
      payload: {
        MessageSid: `SM_inbound_${publicId}`,
        MessageStatus: 'delivered',
        Body: 'STOP',
        From: recipientPhone,
      },
      headers: {},
      now,
    });

    // 3. Verify suppression record created
    const suppCheck = await SuppressionsService.isSuppressed({
      team,
      identifiers: [recipientPhone],
      channel: 'sms',
    });

    expect(suppCheck.suppressed).toBe(true);
    expect(suppCheck.reason).toBe('inbound_opt_out');
  });

  it('Automatically un-suppresses recipient when they reply START', async () => {
    const team = `team_inbound_${dbPrefix}`;
    const recipientPhone = '+14155557788';

    // Ingest inbound webhook from Twilio with "START"
    const now = new Date();
    const attempts = await db.select().from(messageAttempts).limit(1);

    await processWebhookEvent({
      providerId: 'twilio',
      payload: {
        MessageSid: attempts[0]?.providerMessageId || 'SM_start',
        MessageStatus: 'delivered',
        Body: 'START',
        From: recipientPhone,
      },
      headers: {},
      now,
    });

    // Verify suppression is removed
    const suppCheck = await SuppressionsService.isSuppressed({
      team,
      identifiers: [recipientPhone],
      channel: 'sms',
    });

    expect(suppCheck.suppressed).toBe(false);
  });
});
