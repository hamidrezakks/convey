import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { Channel } from '../src/modules/messaging/messaging.types';
import { SuppressionsService } from '../src/modules/suppressions/suppressions.service';
import { redisClient } from '../src/queues/connection';
import { closeAllProviderQueues } from '../src/queues/provider-queues';
import { messageDispatchWorker } from '../src/queues/workers/message-dispatch.worker';
import { hashString } from '../src/utils/crypto';
import { formatRedisKey } from '../src/utils/redis-keys';
import { SEEDED_API_KEY_RAW, seedDatabaseWithRealisticData } from './helpers/db-seeder';
import { disableProviderMock, enableProviderMock } from './mocks/provider-mock';

describe('Suppression & Blocklist Enterprise Suite', () => {
  beforeAll(async () => {
    enableProviderMock(0.0);
    await redisClient.flushall();
    await seedDatabaseWithRealisticData();
  });

  afterAll(async () => {
    disableProviderMock();
    await closeAllProviderQueues();
    await messageDispatchWorker.close();
  });

  it('1. Guarantees strict multi-tenant isolation (Team A suppression does not block Team B)', async () => {
    const email = 'isolation_user@example.com';

    await SuppressionsService.addSuppression({
      team: 'team_alpha',
      identifier: email,
      reason: 'Unsubscribed from Team Alpha',
    });

    const checkAlpha = await SuppressionsService.isSuppressed({
      team: 'team_alpha',
      identifiers: [email],
    });
    expect(checkAlpha.suppressed).toBe(true);

    const checkBeta = await SuppressionsService.isSuppressed({
      team: 'team_beta',
      identifiers: [email],
    });
    expect(checkBeta.suppressed).toBe(false);
  });

  it('2. Enforces channel-specific granular scoping (Email block allows SMS)', async () => {
    const phoneOrEmail = 'channel_scoped_user@example.com';

    await SuppressionsService.addSuppression({
      team: 'payments',
      identifier: phoneOrEmail,
      channel: Channel.EMAIL,
      reason: 'Email opt-out only',
    });

    const emailCheck = await SuppressionsService.isSuppressed({
      team: 'payments',
      identifiers: [phoneOrEmail],
      channel: Channel.EMAIL,
    });
    expect(emailCheck.suppressed).toBe(true);

    const smsCheck = await SuppressionsService.isSuppressed({
      team: 'payments',
      identifiers: [phoneOrEmail],
      channel: Channel.SMS,
    });
    expect(smsCheck.suppressed).toBe(false);
  });

  it('3. Enforces category-specific granular scoping (Marketing block allows Transactional OTP)', async () => {
    const userEmail = 'category_user@example.com';

    await SuppressionsService.addSuppression({
      team: 'payments',
      identifier: userEmail,
      category: 'marketing',
      reason: 'Unsubscribed from marketing newsletters',
    });

    const marketingCheck = await SuppressionsService.isSuppressed({
      team: 'payments',
      identifiers: [userEmail],
      category: 'marketing',
    });
    expect(marketingCheck.suppressed).toBe(true);

    const transactionalCheck = await SuppressionsService.isSuppressed({
      team: 'payments',
      identifiers: [userEmail],
      category: 'transactional',
    });
    expect(transactionalCheck.suppressed).toBe(false);
  });

  it('4. Respects temporal expiration timestamp (endsAt in past is ignored)', async () => {
    const tempUser = 'temp_blocked@example.com';
    const pastDate = new Date(Date.now() - 3600 * 1000);

    await SuppressionsService.addSuppression({
      team: 'payments',
      identifier: tempUser,
      reason: 'Temporary 1-hour block',
      endsAt: pastDate,
    });

    const check = await SuppressionsService.isSuppressed({
      team: 'payments',
      identifiers: [tempUser],
    });
    expect(check.suppressed).toBe(false);
  });

  it('5. Caches suppression lookups in Redis for sub-millisecond fast path ($O(1)$)', async () => {
    const cachedUser = 'redis_fastpath_user@example.com';

    await SuppressionsService.addSuppression({
      team: 'payments',
      identifier: cachedUser,
      reason: 'Redis Cache Test',
    });

    await SuppressionsService.isSuppressed({
      team: 'payments',
      identifiers: [cachedUser],
    });

    const hash = hashString(cachedUser.toLowerCase().trim());
    const redisKey = formatRedisKey(`suppression:payments:${hash}`);
    const cachedVal = await redisClient.get(redisKey);

    expect(cachedVal).not.toBeNull();
    const rules = JSON.parse(cachedVal || '[]');
    expect(rules).toHaveLength(1);
    expect(rules[0].reason).toBe('Redis Cache Test');
  });

  it('6. Supports bulk ingestion API (POST /v1/suppressions/bulk)', async () => {
    const bulkPayload = {
      items: [
        { identifier: 'bulk1@example.com', reason: 'Hard bounce' },
        { identifier: 'bulk2@example.com', reason: 'Spam complaint' },
        { identifier: '+15550001111', reason: 'SMS opt out', channel: 'sms' },
      ],
    };

    const res = await app.fetch(
      new Request('http://localhost/v1/suppressions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SEEDED_API_KEY_RAW },
        body: JSON.stringify(bulkPayload),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; count: number };
    expect(body.success).toBe(true);
    expect(body.count).toBe(3);

    const check = await SuppressionsService.isSuppressed({
      team: 'payments',
      identifiers: ['bulk1@example.com'],
    });
    expect(check.suppressed).toBe(true);
  });

  it('7. Supports paginated list queries & search (GET /v1/suppressions)', async () => {
    const res = await app.fetch(
      new Request('http://localhost/v1/suppressions?limit=2&offset=0&search=bounce', {
        method: 'GET',
        headers: { 'x-api-key': SEEDED_API_KEY_RAW },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { suppressions: Array<unknown>; total: number; limit: number; offset: number };
    expect(body.suppressions).toBeDefined();
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('8. Performs canonical phone number normalization (+1 (555) 000-1111 matches +15550001111)', async () => {
    await SuppressionsService.addSuppression({
      team: 'payments',
      identifier: '+1 (555) 888-9999',
      channel: 'sms',
      reason: 'SMS STOP request with formatting',
    });

    const check = await SuppressionsService.isSuppressed({
      team: 'payments',
      identifiers: ['+15558889999'],
      channel: 'sms',
    });
    expect(check.suppressed).toBe(true);
  });
});
