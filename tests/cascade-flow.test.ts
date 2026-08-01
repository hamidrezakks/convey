import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { messageEvents } from '../src/db/schema';
import { CascadeManager } from '../src/modules/messaging/cascade-manager';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import {
  CascadeCondition,
  type CascadeConfig,
  Channel,
  EventType,
  MessagePriority,
} from '../src/modules/messaging/messaging.types';
import { WebhooksService } from '../src/modules/webhooks/webhooks.service';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';
import { disableProviderMock, enableProviderMock } from './mocks/provider-mock';

describe('Adaptive Omnichannel Cascades (Intent-Driven Fallback Engine)', () => {
  let dbPrefix: string;

  beforeAll(async () => {
    const setup = await setupFreshIsolatedDatabase();
    dbPrefix = setup.prefix;
    enableProviderMock(0); // 100% mock success
  });

  afterAll(() => {
    disableProviderMock();
  });

  it('Executes step 0 immediately and schedules step 1 in a cascade configuration', async () => {
    const team = `team_${dbPrefix}`;
    const cascadeConfig: CascadeConfig = {
      enabled: true,
      steps: [
        {
          channel: Channel.PUSH,
          content: { title: 'Security Alert', body: 'Push Step 0' },
          waitForReceiptMs: 5000,
          condition: CascadeCondition.IF_UNOPENED,
        },
        {
          channel: Channel.WHATSAPP,
          content: { text: 'WhatsApp Step 1' },
          waitForReceiptMs: 10000,
          condition: CascadeCondition.IF_UNOPENED,
        },
        {
          channel: Channel.SMS,
          content: { text: 'SMS Step 2' },
          condition: CascadeCondition.ALWAYS,
        },
      ],
    };

    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_cascade_${Date.now()}`,
      userId: 'usr_cascade_1',
      team,
      category: 'security',
      country: 'US',
      priority: MessagePriority.TRANSACTIONAL,
      recipients: {
        email: 'user@example.com',
        phone: '+14155552671',
        whatsapp: '+14155552671',
        fcmTokens: ['fcm_token_123'],
      },
      channels: [{ channel: Channel.FCM, content: { title: 'Security Alert', body: 'Push Step 0' } }],
      cascade: cascadeConfig,
    });

    expect(res.statusCode).toBe(202);
    const publicId = (res.body as { messageId: string }).messageId;
    expect(publicId).toBeDefined();

    // Verify step 0 execution
    let executedSteps: string[] = [];
    const step0Executed = await CascadeManager.executeCascadeStep(publicId, 0, async (stepData) => {
      executedSteps.push(stepData.channel);
    });
    expect(step0Executed).toBe(true);
    expect(executedSteps).toContain('push');

    // Verify step 1 execution on timeout
    executedSteps = [];
    const step1Executed = await CascadeManager.executeCascadeStep(publicId, 1, async (stepData) => {
      executedSteps.push(stepData.channel);
    });
    expect(step1Executed).toBe(true);
    expect(executedSteps).toContain('whatsapp');
  });

  it('Short-circuits downstream cascade steps when a client open/read receipt is ingested', async () => {
    const team = `team_${dbPrefix}`;
    const cascadeConfig: CascadeConfig = {
      enabled: true,
      steps: [
        {
          channel: Channel.PUSH,
          content: { title: 'Verify Login', body: 'Push notification' },
          waitForReceiptMs: 5000,
          condition: CascadeCondition.IF_UNOPENED,
        },
        {
          channel: Channel.SMS,
          content: { text: 'Fallback SMS code: 123456' },
          condition: CascadeCondition.IF_UNOPENED,
        },
      ],
    };

    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_cascade_receipt_${Date.now()}`,
      userId: 'usr_cascade_receipt',
      team,
      category: 'auth',
      country: 'US',
      priority: MessagePriority.CRITICAL,
      recipients: {
        phone: '+14155559999',
        fcmTokens: ['fcm_token_short_circuit'],
      },
      channels: [{ channel: Channel.FCM, content: { title: 'Verify Login', body: 'Push notification' } }],
      cascade: cascadeConfig,
    });

    const publicId = (res.body as { messageId: string }).messageId;

    // Simulate Step 0 execution
    await CascadeManager.executeCascadeStep(publicId, 0);

    // Ingest client open receipt for Step 0
    await WebhooksService.ingestClientReceipt({
      messageId: publicId,
      channel: 'push',
      event: 'opened',
    });

    // Check that cascade is flagged as cancelled
    const isCancelled = await CascadeManager.isShortCircuited(publicId);
    expect(isCancelled).toBe(true);

    // Step 1 should be skipped / short-circuited
    let step1Ran = false;
    const step1Executed = await CascadeManager.executeCascadeStep(publicId, 1, async () => {
      step1Ran = true;
    });

    expect(step1Executed).toBe(false);
    expect(step1Ran).toBe(false);
  });

  it('Emits CASCADE_EXHAUSTED event when all waterfall steps have been processed', async () => {
    const team = `team_${dbPrefix}`;
    const cascadeConfig: CascadeConfig = {
      enabled: true,
      steps: [
        {
          channel: Channel.EMAIL,
          content: { subject: 'Final Notice', text: 'Email' },
          condition: CascadeCondition.ALWAYS,
        },
      ],
    };

    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_cascade_exhaust_${Date.now()}`,
      userId: 'usr_cascade_exhaust',
      team,
      category: 'billing',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { email: 'billing@example.com' },
      channels: [{ channel: Channel.EMAIL, content: { subject: 'Final Notice', text: 'Email' } }],
      cascade: cascadeConfig,
    });

    const publicId = (res.body as { messageId: string }).messageId;

    // Execute step 0
    await CascadeManager.executeCascadeStep(publicId, 0);

    // Attempt to execute step 1 (which does not exist)
    const step1Executed = await CascadeManager.executeCascadeStep(publicId, 1);
    expect(step1Executed).toBe(false);

    const events = await db.select().from(messageEvents).where(eq(messageEvents.messageId, publicId));
    const exhaustEvent = events.find((e) => e.type === EventType.CASCADE_EXHAUSTED);
    expect(exhaustEvent).toBeDefined();
  });
});
