import { describe, expect, it } from 'bun:test';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../src/db';
import { messageAttempts, messages, outbox } from '../src/db/schema';
import { IdempotencyConflictError } from '../src/modules/messaging/idempotency.service';
import { computePartitionWindow, MessagingService } from '../src/modules/messaging/messaging.service';
import {
  AttemptOrigin,
  Channel,
  ErrorCode,
  MessagePriority,
  MessageState,
  OutboxState,
  OutboxType,
  type SendMessageRequest,
  SystemOverloadError,
} from '../src/modules/messaging/messaging.types';
import { redisClient } from '../src/queues/connection';
import { pruneProcessedOutboxRecords } from '../src/queues/workers/outbox-relay.worker';
import { handleSendSuccess } from '../src/queues/workers/provider-send.worker';
import { processWebhookEvent } from '../src/queues/workers/webhook-ingest.worker';
import { HeapMemoryGuard } from '../src/utils/heap-guard';
import { generateMessageId } from '../src/utils/id';
import { appReadiness } from '../src/utils/readiness';
import { formatRedisKey } from '../src/utils/redis-keys';
import { GracefulShutdownOrchestrator } from '../src/utils/shutdown';

describe('Architecture & Resiliency Edge Cases Suite', () => {
  describe('1. Range Partition Pruning & ULID Window Computation', () => {
    it('calculates exact monthly partition boundaries from ULID timestamp', () => {
      const msgId = generateMessageId();
      const window = computePartitionWindow(msgId);

      expect(window.startDate).toBeInstanceOf(Date);
      expect(window.endDate).toBeInstanceOf(Date);
      expect(window.startDate.getTime()).toBeLessThan(window.endDate.getTime());

      // Start date should be the 1st of the previous/current month at 00:00:00 UTC
      expect(window.startDate.getUTCDate()).toBe(1);
      expect(window.startDate.getUTCHours()).toBe(0);
      expect(window.startDate.getUTCMinutes()).toBe(0);

      // End date should span into the next month boundary
      expect(window.endDate.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('handles cross-month partition querying with bounded indexes', async () => {
      const publicId = generateMessageId();
      const now = new Date();
      const { startDate, endDate } = computePartitionWindow(publicId);

      // Insert message and attempt
      await db.insert(messages).values({
        id: publicId,
        publicId,
        team: 'qa_partition_team',
        userId: 'usr_part_1',
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.CRITICAL,
        state: MessageState.ACCEPTED,
        recipients: { email: 'partition@example.com' },
        channels: [{ channel: Channel.EMAIL, content: { subject: 'Partition Test', text: 'part' } }],
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(messageAttempts).values({
        id: generateMessageId(),
        messageId: publicId,
        channel: Channel.EMAIL,
        providerId: 'ses',
        attemptNo: 1,
        origin: AttemptOrigin.INITIAL,
        state: MessageState.DELIVERED,
        queuedAt: now,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Verify partition-pruned select queries return precisely 1 record
      const prunedAttempts = await db
        .select()
        .from(messageAttempts)
        .where(
          and(
            eq(messageAttempts.messageId, publicId),
            gte(messageAttempts.createdAt, startDate),
            lte(messageAttempts.createdAt, endDate),
          ),
        );

      expect(prunedAttempts.length).toBe(1);
      expect(prunedAttempts[0].messageId).toBe(publicId);
    });
  });

  describe('2. Outbox Micro-Batch Retention Pruning & Storage Health', () => {
    it('purges processed outbox records older than retention horizon while preserving pending and fresh records', async () => {
      const now = Date.now();
      const oldProcessedDate = new Date(now - 48 * 3600 * 1000); // 48h ago (should be pruned)
      const freshProcessedDate = new Date(now - 2 * 3600 * 1000); // 2h ago (should be preserved)
      const oldPendingDate = new Date(now - 48 * 3600 * 1000); // 48h ago pending (MUST be preserved)

      const id1 = generateMessageId();
      const id2 = generateMessageId();
      const id3 = generateMessageId();

      await db.insert(outbox).values([
        {
          id: id1,
          messageId: generateMessageId(),
          type: OutboxType.MESSAGE_DISPATCH,
          payload: { test: true },
          state: OutboxState.PROCESSED,
          availableAt: oldProcessedDate,
          processedAt: oldProcessedDate,
          createdAt: oldProcessedDate,
        },
        {
          id: id2,
          messageId: generateMessageId(),
          type: OutboxType.MESSAGE_DISPATCH,
          payload: { test: true },
          state: OutboxState.PROCESSED,
          availableAt: freshProcessedDate,
          processedAt: freshProcessedDate,
          createdAt: freshProcessedDate,
        },
        {
          id: id3,
          messageId: generateMessageId(),
          type: OutboxType.MESSAGE_DISPATCH,
          payload: { test: true },
          state: OutboxState.PENDING,
          availableAt: oldPendingDate,
          createdAt: oldPendingDate,
        },
      ]);

      const deletedCount = await pruneProcessedOutboxRecords(24, 1000);
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      // Verify id1 is deleted
      const checkId1 = await db.select().from(outbox).where(eq(outbox.id, id1));
      expect(checkId1.length).toBe(0);

      // Verify id2 (fresh processed) is preserved
      const checkId2 = await db.select().from(outbox).where(eq(outbox.id, id2));
      expect(checkId2.length).toBe(1);

      // Verify id3 (old pending) is preserved
      const checkId3 = await db.select().from(outbox).where(eq(outbox.id, id3));
      expect(checkId3.length).toBe(1);
    });
  });

  describe('3. Redis Reverse Lookups & Webhook O(1) Ingestion Fast-Path', () => {
    it('writes reverse lookup index on send success and fast-paths webhook status update', async () => {
      const publicId = generateMessageId();
      const attemptId = generateMessageId();
      const providerMessageId = `prov_ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();

      // Seed base message
      await db.insert(messages).values({
        id: publicId,
        publicId,
        team: 'qa_reverse_team',
        userId: 'usr_rev_1',
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.NORMAL,
        state: MessageState.ACCEPTED,
        recipients: { email: 'reverse@example.com' },
        channels: [{ channel: Channel.EMAIL, content: { subject: 'Reverse Test', text: 'body' } }],
        createdAt: now,
        updatedAt: now,
      });

      const msgRecord = (await db.select().from(messages).where(eq(messages.publicId, publicId)))[0];

      // Simulate provider send success
      await handleSendSuccess({
        data: {
          publicId,
          channel: Channel.EMAIL,
          providerId: 'ses',
          content: { subject: 'Reverse Test', text: 'body' },
          recipient: { email: 'reverse@example.com' },
          origin: AttemptOrigin.INITIAL,
          attemptNo: 1,
        },
        adapterId: 'ses',
        providerMessageId,
        latencyMs: 42,
        msg: msgRecord,
        attemptId,
        now,
      });

      // Verify reverse Redis key was created
      const redisKey = formatRedisKey(`provmsg:ses:${providerMessageId}`);
      const cached = await redisClient.get(redisKey);
      expect(cached).toBeDefined();
      expect(cached).toContain(publicId);
      expect(cached).toContain(attemptId);

      // Ingest delivery webhook event using the providerMessageId
      await processWebhookEvent({
        providerId: 'ses',
        payload: {
          notificationType: 'Delivery',
          mail: { messageId: providerMessageId },
        },
        headers: {},
        now: new Date(),
      });

      // Verify message updated to DELIVERED
      const updatedMsg = (await db.select().from(messages).where(eq(messages.publicId, publicId)))[0];
      expect(updatedMsg.state).toBe(MessageState.DELIVERED);
    });
  });

  describe('4. Idempotency Multi-Tenant Scope & Conflict Rejection', () => {
    it('rejects conflicting request payloads on the same idempotency key with HTTP 409 error', async () => {
      const team = 'qa_idem_team';
      const key = `idem_key_${Date.now()}`;
      const payload1: SendMessageRequest = {
        team,
        userId: 'usr_idem_1',
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.NORMAL,
        idempotencyKey: key,
        recipients: { email: 'original@example.com' },
        channels: [{ channel: Channel.EMAIL, content: { subject: 'Original', text: 'original body' } }],
      };
      const payload2: SendMessageRequest = {
        team,
        userId: 'usr_idem_1',
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.NORMAL,
        idempotencyKey: key,
        recipients: { email: 'different@example.com' },
        channels: [{ channel: Channel.EMAIL, content: { subject: 'Different', text: 'different body' } }],
      };

      // First call succeeds
      const res1 = await MessagingService.acceptMessage(payload1);
      expect(res1.statusCode).toBe(202);

      // Re-sending exact same payload returns identical cached 202 response
      const res1Duplicate = await MessagingService.acceptMessage(payload1);
      expect(res1Duplicate.statusCode).toBe(202);
      expect(res1Duplicate.body).toEqual(res1.body);

      // Sending conflicting payload with the same key throws IdempotencyConflictError
      await expect(MessagingService.acceptMessage(payload2)).rejects.toThrow(IdempotencyConflictError);
    });

    it('releases idempotency reservation when channel recipient validation fails', async () => {
      const team = 'qa_release_team';
      const key = `release_key_${Date.now()}`;
      const invalidPayload: SendMessageRequest = {
        team,
        userId: 'usr_rel_1',
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.NORMAL,
        idempotencyKey: key,
        recipients: {}, // Missing required recipient
        channels: [{ channel: Channel.EMAIL, content: { subject: 'Test', text: 'body' } }],
      };

      // Should fail domain validation and release key
      await expect(MessagingService.acceptMessage(invalidPayload)).rejects.toThrow();

      // Valid retry with same key can now proceed cleanly
      const validPayload: SendMessageRequest = {
        team,
        userId: 'usr_rel_1',
        category: 'transactional',
        country: 'US',
        priority: MessagePriority.NORMAL,
        idempotencyKey: key,
        recipients: { email: 'valid@example.com' },
        channels: [{ channel: Channel.EMAIL, content: { subject: 'Test', text: 'body' } }],
      };

      const res = await MessagingService.acceptMessage(validPayload);
      expect(res.statusCode).toBe(202);
    });
  });

  describe('5. Bun Native Heap Guard & GC Hint Precision', () => {
    it('inspects Bun runtime memory and handles throttling bounds without exceptions', () => {
      const guard = new HeapMemoryGuard();
      const status = guard.getStatus();

      expect(status.heapUsedBytes).toBeGreaterThan(0);
      expect(status.heapTotalBytes).toBeGreaterThan(0);
      expect(status.heapUtilization).toBeGreaterThanOrEqual(0.0);
      expect(status.heapUtilization).toBeLessThanOrEqual(1.0);
      expect(typeof guard.shouldThrottle()).toBe('boolean');
    });

    it('SystemOverloadError carries HTTP 503 code and Retry-After header metadata', () => {
      const err = new SystemOverloadError('Memory overload', 10);
      expect(err.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(err.retryAfterSeconds).toBe(10);
      expect(err.name).toBe('SystemOverloadError');
    });
  });

  describe('6. Graceful Shutdown Idempotency', () => {
    it('GracefulShutdownOrchestrator can be called multiple times without throw', async () => {
      const orchestrator = new GracefulShutdownOrchestrator({ drainTimeoutMs: 100, closeConnections: false });
      // Multiple shutdown invocations must be idempotent and resolve cleanly
      await expect(orchestrator.shutdown()).resolves.toBeUndefined();
      await expect(orchestrator.shutdown()).resolves.toBeUndefined();
      appReadiness.setReady(true);
    });
  });
});
