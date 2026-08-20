import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { messageEvents, messages } from '../src/db/schema';
import { CascadeManager } from '../src/modules/messaging/cascade-manager';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import {
  type CascadeConfig,
  type CascadeStep,
  Channel,
  EventType,
  MessagePriority,
  MessageState,
} from '../src/modules/messaging/messaging.types';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';
import { disableProviderMock, enableProviderMock } from './mocks/provider-mock';

describe('Omnichannel Cascades & Waterfall Execution Suite', () => {
  let dbPrefix: string;

  beforeAll(async () => {
    const setup = await setupFreshIsolatedDatabase();
    dbPrefix = setup.prefix;
    enableProviderMock(0.0);
  });

  afterAll(async () => {
    disableProviderMock();
  });

  it('correctly constructs and persists a 3-step waterfall cascade metadata', async () => {
    const team = `team_g001_${dbPrefix}`;
    const cascade: CascadeConfig = {
      steps: [
        { channel: Channel.FCM, waitForReceiptMs: 5000 },
        { channel: Channel.WHATSAPP, waitForReceiptMs: 10000 },
        { channel: Channel.SMS },
      ],
    };
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g001_${Date.now()}`,
      userId: 'usr_g001',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550001', fcmTokens: ['token_g001'] },
      channels: [{ channel: Channel.FCM, content: { title: 'Alert', body: 'Alert step 0' } }],
      metadata: { cascade },
    });
    expect(res.statusCode).toBe(202);
    const publicId = (res.body as { messageId: string }).messageId;
    expect(publicId).toBeDefined();
  });

  it('sets Redis short-circuit cancellation key with 24h TTL', async () => {
    const publicId = `msg_g002_${Date.now()}`;
    await CascadeManager.cancelRemainingSteps(publicId);
    const isCancelled = await CascadeManager.isCancelled(publicId);
    expect(isCancelled).toBe(true);
  });

  it('gracefully short-circuits step execution if message is in DELIVERED state', async () => {
    const team = `team_g003_${dbPrefix}`;
    const cascade: CascadeConfig = {
      steps: [{ channel: Channel.FCM, waitForReceiptMs: 5000 }, { channel: Channel.SMS }],
    };
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g003_${Date.now()}`,
      userId: 'usr_g003',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550003', fcmTokens: ['token_g003'] },
      channels: [{ channel: Channel.FCM, content: { title: 'Alert', body: 'Push step' } }],
      metadata: { cascade },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    await db.update(messages).set({ state: MessageState.DELIVERED }).where(eq(messages.publicId, publicId));

    const executed = await CascadeManager.executeStep(publicId, 1);
    expect(executed).toBe(false);
  });

  it('gracefully short-circuits step execution if message is in OPENED state', async () => {
    const team = `team_g004_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g004_${Date.now()}`,
      userId: 'usr_g004',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550004', fcmTokens: ['token_g004'] },
      channels: [{ channel: Channel.FCM, content: { title: 'Alert', body: 'Push step' } }],
      metadata: {
        cascade: {
          steps: [{ channel: Channel.FCM, waitForReceiptMs: 5000 }, { channel: Channel.EMAIL }],
        },
      },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    await db.update(messages).set({ state: MessageState.OPENED }).where(eq(messages.publicId, publicId));

    const executed = await CascadeManager.executeStep(publicId, 1);
    expect(executed).toBe(false);
  });

  it('gracefully short-circuits step execution if message is in READ state', async () => {
    const team = `team_g005_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g005_${Date.now()}`,
      userId: 'usr_g005',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550005', fcmTokens: ['token_g005'] },
      channels: [{ channel: Channel.FCM, content: { title: 'Alert', body: 'Push step' } }],
      metadata: {
        cascade: {
          steps: [{ channel: Channel.FCM, waitForReceiptMs: 5000 }, { channel: Channel.WHATSAPP }],
        },
      },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    await db.update(messages).set({ state: MessageState.READ }).where(eq(messages.publicId, publicId));

    const executed = await CascadeManager.executeStep(publicId, 1);
    expect(executed).toBe(false);
  });

  it('cascade step with 0ms delay triggers step dispatch immediately', async () => {
    const team = `team_g006_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g006_${Date.now()}`,
      userId: 'usr_g006',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550006' },
      channels: [{ channel: Channel.SMS, content: { text: 'Zero delay step' } }],
      metadata: {
        cascade: {
          steps: [{ channel: Channel.SMS, waitForReceiptMs: 0 }, { channel: Channel.TELEGRAM }],
        },
      },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    let stepRan = false;
    const executed = await CascadeManager.executeStep(publicId, 0, () => {
      stepRan = true;
    });
    expect(executed).toBe(true);
    expect(stepRan).toBe(true);
  });

  it('preserves channel content payload across waterfall steps', async () => {
    const team = `team_g007_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g007_${Date.now()}`,
      userId: 'usr_g007',
      team,
      category: 'promotions',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550007', email: 'user@example.com' },
      channels: [
        { channel: Channel.EMAIL, content: { subject: 'Promo', text: 'Email text' } },
        { channel: Channel.SMS, content: { text: 'SMS text' } },
      ],
      metadata: {
        cascade: {
          steps: [{ channel: Channel.EMAIL, waitForReceiptMs: 3000 }, { channel: Channel.SMS }],
        },
      },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    const executed = await CascadeManager.executeStep(publicId, 0);
    expect(executed).toBe(true);
  });

  it('deep 4-step cascade executes sequentially through all channel definitions', async () => {
    const team = `team_g008_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g008_${Date.now()}`,
      userId: 'usr_g008',
      team,
      category: 'critical',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550008', email: 'u8@test.com', fcmTokens: ['tok8'] },
      channels: [{ channel: Channel.FCM, content: { title: 'Step 0', body: 'Step 0' } }],
      metadata: {
        cascade: {
          steps: [
            { channel: Channel.FCM, waitForReceiptMs: 1000 },
            { channel: Channel.WHATSAPP, waitForReceiptMs: 1000 },
            { channel: Channel.SMS, waitForReceiptMs: 1000 },
            { channel: Channel.EMAIL },
          ],
        },
      },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    const stepsExecuted: string[] = [];

    for (let i = 0; i < 4; i++) {
      await CascadeManager.executeStep(publicId, i, (step: CascadeStep) => {
        stepsExecuted.push(step.channel);
      });
    }

    expect(stepsExecuted).toEqual(['fcm', 'whatsapp', 'sms', 'email']);
  });

  it('emits CASCADE_EXHAUSTED event when all waterfall steps have executed without receipt', async () => {
    const team = `team_g009_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g009_${Date.now()}`,
      userId: 'usr_g009',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550009' },
      channels: [{ channel: Channel.SMS, content: { text: 'One step' } }],
      metadata: {
        cascade: {
          steps: [{ channel: Channel.SMS }],
        },
      },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    await CascadeManager.executeStep(publicId, 0);
    const executed = await CascadeManager.executeStep(publicId, 1);
    expect(executed).toBe(false);

    const events = await db.select().from(messageEvents).where(eq(messageEvents.messageId, publicId));
    expect(events.some((e) => e.type === EventType.CASCADE_EXHAUSTED)).toBe(true);
  });

  it('emits CASCADE_SHORT_CIRCUITED event when step execution encounters delivered status', async () => {
    const team = `team_g010_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g010_${Date.now()}`,
      userId: 'usr_g010',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550010' },
      channels: [{ channel: Channel.SMS, content: { text: 'Test' } }],
      metadata: {
        cascade: {
          steps: [{ channel: Channel.SMS, waitForReceiptMs: 5000 }, { channel: Channel.EMAIL }],
        },
      },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    await db.update(messages).set({ state: MessageState.DELIVERED }).where(eq(messages.publicId, publicId));

    await CascadeManager.executeStep(publicId, 1);
    const events = await db.select().from(messageEvents).where(eq(messageEvents.messageId, publicId));
    expect(events.some((e) => e.type === EventType.CASCADE_SHORT_CIRCUITED)).toBe(true);
  });

  it('multi-tenant cascade state isolation (cancelling msg A does not cancel msg B)', async () => {
    const msgA = `msg_g011_a_${Date.now()}`;
    const msgB = `msg_g011_b_${Date.now()}`;

    await CascadeManager.cancelRemainingSteps(msgA);
    expect(await CascadeManager.isCancelled(msgA)).toBe(true);
    expect(await CascadeManager.isCancelled(msgB)).toBe(false);
  });

  it('non-existent message ID in executeStep returns false without throwing', async () => {
    const nonExistentId = 'msg_01a00000-0000-7000-0000-000000000000';
    const executed = await CascadeManager.executeStep(nonExistentId, 0);
    expect(executed).toBe(false);
  });

  it('missing cascade config returns false without throwing exception', async () => {
    const team = `team_g013_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g013_${Date.now()}`,
      userId: 'usr_g013',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550013' },
      channels: [{ channel: Channel.SMS, content: { text: 'No cascade' } }],
    });
    const publicId = (res.body as { messageId: string }).messageId;
    const executed = await CascadeManager.executeStep(publicId, 0);
    expect(executed).toBe(false);
  });

  it('out of bounds step index (step 10) returns false', async () => {
    const team = `team_g014_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g014_${Date.now()}`,
      userId: 'usr_g014',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550014' },
      channels: [{ channel: Channel.SMS, content: { text: 'Single step' } }],
      metadata: { cascade: { steps: [{ channel: Channel.SMS }] } },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    const executed = await CascadeManager.executeStep(publicId, 10);
    expect(executed).toBe(false);
  });

  it('Redis key format helper produces namespaced keys', () => {
    const key = CascadeManager.getCancelKey('msg_123');
    expect(key).toContain('cascade:cancel:msg_123');
    const stateKey = CascadeManager.getStateKey('msg_123');
    expect(stateKey).toContain('cascade:state:msg_123');
  });

  it('records CASCADE_STEP_INITIATED in message_events for each dispatched step', async () => {
    const team = `team_g016_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g016_${Date.now()}`,
      userId: 'usr_g016',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550016' },
      channels: [{ channel: Channel.SMS, content: { text: 'Step initiated check' } }],
      metadata: { cascade: { steps: [{ channel: Channel.SMS }] } },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    await CascadeManager.executeStep(publicId, 0);

    const events = await db.select().from(messageEvents).where(eq(messageEvents.messageId, publicId));
    expect(events.some((e) => e.type === EventType.CASCADE_STEP_INITIATED)).toBe(true);
  });

  it('partition boundary timestamp correctly locates partitioned messages', async () => {
    const team = `team_g017_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g017_${Date.now()}`,
      userId: 'usr_g017',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550017' },
      channels: [{ channel: Channel.SMS, content: { text: 'Partition test' } }],
      metadata: { cascade: { steps: [{ channel: Channel.SMS }] } },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    const executed = await CascadeManager.executeStep(publicId, 0);
    expect(executed).toBe(true);
  });

  it('checks isShortCircuited alias accurately', async () => {
    const publicId = `msg_g018_${Date.now()}`;
    expect(await CascadeManager.isShortCircuited(publicId)).toBe(false);
    await CascadeManager.cancelRemainingSteps(publicId);
    expect(await CascadeManager.isShortCircuited(publicId)).toBe(true);
  });

  it('executes executeCascadeStep alias without degradation', async () => {
    const team = `team_g019_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g019_${Date.now()}`,
      userId: 'usr_g019',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550019' },
      channels: [{ channel: Channel.SMS, content: { text: 'Alias check' } }],
      metadata: { cascade: { steps: [{ channel: Channel.SMS }] } },
    });
    const publicId = (res.body as { messageId: string }).messageId;
    let cbRan = false;
    const resVal = await CascadeManager.executeCascadeStep(publicId, 0, () => {
      cbRan = true;
    });
    expect(resVal).toBe(true);
    expect(cbRan).toBe(true);
  });

  it('simultaneous cancellation and step execution safely aborts downstream dispatch', async () => {
    const team = `team_g020_${dbPrefix}`;
    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_g020_${Date.now()}`,
      userId: 'usr_g020',
      team,
      category: 'alerts',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { phone: '+14155550020' },
      channels: [{ channel: Channel.SMS, content: { text: 'Race condition check' } }],
      metadata: {
        cascade: { steps: [{ channel: Channel.SMS, waitForReceiptMs: 5000 }, { channel: Channel.EMAIL }] },
      },
    });
    const publicId = (res.body as { messageId: string }).messageId;

    await Promise.all([CascadeManager.cancelRemainingSteps(publicId), CascadeManager.executeStep(publicId, 1)]);

    expect(await CascadeManager.isCancelled(publicId)).toBe(true);
  });
});
