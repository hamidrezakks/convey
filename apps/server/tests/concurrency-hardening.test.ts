import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db';
import { budgetPolicies, budgetUsage, messageAttempts, messages, outbox } from '../src/db/schema';
import { DlqService } from '../src/modules/messaging/dlq.service';
import {
  AttemptOrigin,
  Channel,
  MessagePriority,
  MessageState,
  OutboxState,
  OutboxType,
} from '../src/modules/messaging/messaging.types';
import { PolicyEngine, updateMonthlyBudgetUsage } from '../src/modules/policies/policy-engine';
import { ErrorCategory } from '../src/modules/providers/core/provider-types';
import { MicroBatchIngestionPipeline } from '../src/modules/webhooks/micro-batch-ingestion';
import { processOutboxBatchForShard } from '../src/queues/workers/outbox-relay.worker';
import { handlePermanentFailure, handleSendSuccess } from '../src/queues/workers/provider-send.worker';
import { generateMessageId } from '../src/utils/id';

describe('Concurrency Hardening & Planetary-Scale Resilience Test Suite', () => {
  const testPrefix = `harden_${Date.now()}`;
  const testPolicyId = `pol_${testPrefix}`;
  const testTeam = `team_${testPrefix}`;
  const testMonth = '2026-08';

  beforeAll(async () => {
    // Seed test budget policy
    await db.insert(budgetPolicies).values({
      id: testPolicyId,
      team: testTeam,
      monthlyBudgetUsd: '100.0000',
      hardStop: 'true',
    });
  });

  afterAll(async () => {
    // Cleanup seeded records
    try {
      await db.delete(budgetUsage).where(eq(budgetUsage.policyId, testPolicyId));
      await db.delete(budgetPolicies).where(eq(budgetPolicies.id, testPolicyId));
    } catch {}
  });

  describe('1. Atomic High-Concurrency Budget Usage UPSERT', () => {
    it('handles 50 concurrent financial ledger increments with zero duplicate key crashes or lost updates', async () => {
      const concurrentIncrements = 50;
      const amountPerMessage = 0.005; // $0.005 USD per message
      const expectedTotalUsd = (concurrentIncrements * amountPerMessage).toFixed(4); // '0.2500'

      const now = new Date();

      // Launch 50 concurrent worker threads updating the budget simultaneously
      const updatePromises: Promise<void>[] = [];
      for (let i = 0; i < concurrentIncrements; i++) {
        updatePromises.push(updateMonthlyBudgetUsage(testPolicyId, testMonth, amountPerMessage, now));
      }

      // Guarantee all concurrent operations resolve cleanly
      await Promise.all(updatePromises);

      // Verify exact database state
      const usageRecords = await db
        .select()
        .from(budgetUsage)
        .where(and(eq(budgetUsage.policyId, testPolicyId), eq(budgetUsage.month, testMonth)));

      expect(usageRecords.length).toBe(1);
      expect(Number.parseFloat(usageRecords[0].usedUsd)).toBeCloseTo(0.25, 4);
      expect(usageRecords[0].usedUsd).toBe(expectedTotalUsd);
    });

    it('PolicyEngine.recordLedger correctly increments usage and records ledger row atomically', async () => {
      const msgId = generateMessageId();
      await PolicyEngine.recordLedger({
        messageId: msgId,
        team: testTeam,
        amountUsd: 0.01,
        channel: 'email',
        providerId: 'ses',
      });

      const check = await PolicyEngine.checkBudget(testTeam);
      expect(check.allowed).toBe(true);
      expect(check.usedUsd).toBeGreaterThan(0.25);
    });
  });

  describe('2. Two-Phase Outbox Relay Pipeline', () => {
    it('processes virtual shard batches in two phases and marks records PROCESSED', async () => {
      const shardId = 7;
      const now = new Date();
      const outboxIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const outboxId = generateMessageId();
        const messageId = generateMessageId();
        outboxIds.push(outboxId);

        await db.insert(outbox).values({
          id: outboxId,
          messageId,
          shardId,
          type: OutboxType.MESSAGE_DISPATCH,
          payload: { publicId: messageId, priority: MessagePriority.TRANSACTIONAL, team: testTeam },
          state: OutboxState.PENDING,
          availableAt: new Date(now.getTime() - 1000),
          createdAt: now,
        });
      }

      const processedCount = await processOutboxBatchForShard(shardId, 50);
      expect(processedCount).toBeGreaterThanOrEqual(0);

      // Verify records are marked PROCESSED in DB
      for (const id of outboxIds) {
        const rows = await db.select().from(outbox).where(eq(outbox.id, id));
        expect(rows[0].state).toBe(OutboxState.PROCESSED);
        expect(rows[0].processedAt).not.toBeNull();
      }
    });
  });

  describe('3. High-Throughput Webhook Micro-Batch Engine', () => {
    it('enqueues and flushes micro-batches of webhook events to database', async () => {
      const pipeline = new MicroBatchIngestionPipeline();
      const eventId1 = generateMessageId();
      const eventId2 = generateMessageId();

      pipeline.enqueueEvent({
        eventId: eventId1,
        provider: 'sendgrid',
        eventType: 'delivered',
        timestamp: Date.now(),
        payload: { messageId: generateMessageId(), channel: 'email' },
      });

      pipeline.enqueueEvent({
        eventId: eventId2,
        provider: 'twilio',
        eventType: 'delivered',
        timestamp: Date.now(),
        payload: { messageId: generateMessageId(), channel: 'sms' },
      });

      const flushedCount = await pipeline.flush();
      expect(flushedCount).toBe(2);

      pipeline.stopAutoFlush();
    });
  });

  describe('4. Batched DLQ Querying & Bulk Replay', () => {
    it('lists failed messages using batched attempt queries without N+1 waterfalls', async () => {
      const failedMsgId = generateMessageId();
      const now = new Date();

      await db.insert(messages).values({
        id: failedMsgId.replace('msg_', ''),
        publicId: failedMsgId,
        userId: 'usr_test',
        team: testTeam,
        category: 'marketing',
        country: 'US',
        state: MessageState.FAILED,
        priority: MessagePriority.NORMAL,
        recipients: { email: 'dlq_test@example.com' },
        channels: [{ channel: Channel.EMAIL, content: { subject: 'DLQ Test' } }],
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(messageAttempts).values({
        id: generateMessageId(),
        messageId: failedMsgId,
        channel: 'email',
        providerId: 'ses',
        attemptNo: 3,
        origin: AttemptOrigin.INITIAL,
        state: MessageState.FAILED,
        errorCode: 'RECIPIENT_SUPPRESSED',
        errorCategory: ErrorCategory.PERMANENT,
        errorMessage: 'Recipient email address is suppressed',
        createdAt: now,
        updatedAt: now,
      });

      const dlqList = await DlqService.listFailedMessages({ team: testTeam, limit: 10 });
      expect(dlqList.total).toBeGreaterThanOrEqual(1);

      const target = dlqList.items.find((item) => item.messageId === failedMsgId);
      expect(target).toBeDefined();
      expect(target?.lastError?.code).toBe('RECIPIENT_SUPPRESSED');
      expect(target?.lastError?.providerId).toBe('ses');
    });

    it('replays failed DLQ messages in bulk and transitions them to ACCEPTED', async () => {
      const replayMsgId = generateMessageId();
      const now = new Date();

      await db.insert(messages).values({
        id: replayMsgId.replace('msg_', ''),
        publicId: replayMsgId,
        userId: 'usr_replay',
        team: testTeam,
        category: 'transactional',
        country: 'US',
        state: MessageState.FAILED,
        priority: MessagePriority.CRITICAL,
        recipients: { phone: '+15550001111' },
        channels: [{ channel: Channel.SMS, content: { text: 'Replay Test' } }],
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const replayResult = await DlqService.replayFailedMessages([replayMsgId]);
      expect(replayResult.replayedCount).toBe(1);
      expect(replayResult.messageIds).toContain(replayMsgId);

      const updatedRows = await db.select().from(messages).where(eq(messages.publicId, replayMsgId));
      expect([MessageState.ACCEPTED, MessageState.DISPATCHED, MessageState.DELIVERED]).toContain(
        updatedRows[0].state as MessageState,
      );
      expect(updatedRows[0].completedAt).toBeNull();
    });
  });

  describe('5. Omnichannel Multi-Channel State Protection', () => {
    it('preserves DELIVERED state when sibling channel encounters permanent failure', async () => {
      const multiMsgId = generateMessageId();
      const now = new Date();

      // Seed multi-channel message
      await db.insert(messages).values({
        id: multiMsgId.replace('msg_', ''),
        publicId: multiMsgId,
        userId: 'usr_multi',
        team: testTeam,
        category: 'alerts',
        country: 'US',
        state: MessageState.DISPATCHED,
        priority: MessagePriority.NORMAL,
        recipients: { email: 'multi@example.com', phone: '+15559998888' },
        channels: [
          { channel: Channel.EMAIL, content: { subject: 'Multi' } },
          { channel: Channel.SMS, content: { text: 'Multi' } },
        ],
        createdAt: now,
        updatedAt: now,
      });

      const seededRows = await db.select().from(messages).where(eq(messages.publicId, multiMsgId));
      const seededMsg = seededRows[0];

      // 1. First channel (Email) succeeds -> marks DELIVERED
      await handleSendSuccess({
        data: {
          publicId: multiMsgId,
          channel: Channel.EMAIL,
          origin: AttemptOrigin.INITIAL,
          attemptNo: 1,
        },
        adapterId: 'ses',
        providerMessageId: 'ses_msg_123',
        latencyMs: 45,
        msg: seededMsg,
        attemptId: generateMessageId(),
        now,
      });

      const deliveredCheck = await db.select().from(messages).where(eq(messages.publicId, multiMsgId));
      expect(deliveredCheck[0].state).toBe(MessageState.DELIVERED);

      // 2. Second channel (SMS) fails permanently -> must NOT overwrite DELIVERED
      await handlePermanentFailure({
        data: {
          publicId: multiMsgId,
          channel: Channel.SMS,
          origin: AttemptOrigin.INITIAL,
          attemptNo: 1,
        },
        adapterId: 'twilio',
        error: { code: 'INVALID_NUMBER', message: 'Carrier rejected number' },
        errorCategory: ErrorCategory.PERMANENT,
        isTransient: false,
        latencyMs: 120,
        msg: seededMsg,
        attemptId: generateMessageId(),
        now,
      });

      const finalCheck = await db.select().from(messages).where(eq(messages.publicId, multiMsgId));
      // Invariant: Top-level message state remains DELIVERED
      expect(finalCheck[0].state).toBe(MessageState.DELIVERED);
    });
  });
});
