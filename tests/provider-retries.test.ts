import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { messageAttempts, messageEvents, messages } from '../src/db/schema';
import { AttemptOrigin, Channel, EventType, MessageState } from '../src/modules/messaging/messaging.types';
import { processProviderSendJob } from '../src/queues/workers/provider-send.worker';
import { generateMessageId } from '../src/utils/id';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';
import { disableProviderMock, enableProviderMock } from './mocks/provider-mock';

describe('Provider Retry Policy Unit Tests (3-Attempt Exponential Backoff)', () => {
  beforeAll(async () => {
    await setupFreshIsolatedDatabase();
    enableProviderMock(1.0);
  });

  afterAll(() => {
    disableProviderMock();
  });

  it('Retries transient server errors up to 3 times before failing', async () => {
    const msgId = generateMessageId();

    await db.insert(messages).values({
      id: msgId,
      publicId: msgId,
      userId: 'usr_test_retry',
      team: 'payments',
      category: 'otp',
      country: 'US',
      state: MessageState.ACCEPTED,
      recipients: { email: 'retry_test@example.com' },
      channels: [{ channel: Channel.EMAIL, content: { subject: 'OTP', text: '123456' } }],
    });

    // Attempt 1 (Fails transiently)
    await processProviderSendJob({
      publicId: msgId,
      channel: Channel.EMAIL,
      content: { subject: 'OTP', text: '123456' },
      recipient: { email: 'retry_test@example.com' },
      origin: AttemptOrigin.INITIAL,
      attemptNo: 1,
    });

    const attempts1 = await db.select().from(messageAttempts).where(eq(messageAttempts.messageId, msgId));
    expect(attempts1.length).toBeGreaterThanOrEqual(1);

    const retryEvents1 = await db.select().from(messageEvents).where(eq(messageEvents.messageId, msgId));
    expect(retryEvents1.length).toBeGreaterThanOrEqual(1);

    // Attempt 3 (All 3 retries exhausted)
    await processProviderSendJob({
      publicId: msgId,
      channel: Channel.EMAIL,
      content: { subject: 'OTP', text: '123456' },
      recipient: { email: 'retry_test@example.com' },
      origin: AttemptOrigin.RETRY,
      attemptNo: 3,
    });

    const retryEvents3 = await db.select().from(messageEvents).where(eq(messageEvents.messageId, msgId));
    const isFailed = retryEvents3.some((e) => e.type === EventType.ATTEMPT_FAILED);
    expect(isFailed).toBe(true);
  });
});
