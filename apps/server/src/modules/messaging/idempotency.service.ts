import { redisClient } from '../../queues/connection';
import { hashCanonicalObject } from '../../utils/crypto';
import { formatRedisKey } from '../../utils/redis-keys';
import { IdempotencyState, ReservationStatus } from './messaging.types';

export interface IdempotencyReservationResult {
  readonly status: ReservationStatus;
  readonly messageId?: string;
  readonly responsePayload?: Record<string, unknown>;
  readonly ownerToken?: string;
}

export interface IdempotencyRecordPayload {
  readonly state: IdempotencyState;
  readonly hash: string;
  readonly owner?: string;
  readonly messageId?: string;
  readonly responsePayload?: Record<string, unknown>;
  readonly createdAt?: string;
  readonly completedAt?: string;
}

export class IdempotencyConflictError extends Error {
  public readonly code = 'IDEMPOTENCY_CONFLICT';

  constructor(
    message = 'The idempotency key was previously used with a different request',
    public readonly team?: string,
    public readonly idempotencyKey?: string,
  ) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours

export function getIdempotencyKey(team: string, idempotencyKey: string): string {
  return formatRedisKey(`idem:${team}:${idempotencyKey}`);
}

export function generateOwnerToken(): string {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  return `owner_${timestamp}_${randomSuffix}`;
}

export async function deleteIdempotencyKeys(keys: readonly string[]): Promise<void> {
  if (!keys.length) return;
  await redisClient.del(...keys);
}

export function buildProcessingIdempotencyPayload(
  hash: string,
  ownerToken: string,
  createdAt = new Date().toISOString(),
): string {
  const payload: IdempotencyRecordPayload = {
    state: IdempotencyState.PROCESSING,
    hash,
    owner: ownerToken,
    createdAt,
  };
  return JSON.stringify(payload);
}

export function buildCompletedIdempotencyPayload(
  hash: string,
  messageId: string,
  responsePayload: Record<string, unknown>,
  completedAt = new Date().toISOString(),
): string {
  const payload: IdempotencyRecordPayload = {
    state: IdempotencyState.COMPLETED,
    hash,
    messageId,
    responsePayload,
    completedAt,
  };
  return JSON.stringify(payload);
}

export function parseExistingIdempotencyRecord(existingRaw: string, requestHash: string): IdempotencyReservationResult {
  const parsed = JSON.parse(existingRaw) as IdempotencyRecordPayload;
  if (parsed.hash !== requestHash) {
    throw new IdempotencyConflictError();
  }

  if (parsed.state === IdempotencyState.COMPLETED) {
    return {
      status: ReservationStatus.COMPLETED,
      messageId: parsed.messageId,
      responsePayload: parsed.responsePayload,
    };
  }

  throw new IdempotencyConflictError('A request with this idempotency key is currently processing');
}

export async function executeBulkAcquisitionPipeline(
  toAcquire: ReadonlyArray<{ index: number; key: string; value: string; ownerToken: string }>,
  results: Array<{ index: number; result?: IdempotencyReservationResult; error?: Error }>,
): Promise<void> {
  if (!toAcquire.length) return;

  const pipeline = redisClient.pipeline();
  for (const item of toAcquire) {
    pipeline.set(item.key, item.value, 'EX', DEFAULT_IDEMPOTENCY_TTL_SECONDS, 'NX');
  }
  const pipelineResults = await pipeline.exec();

  for (let k = 0; k < toAcquire.length; k++) {
    const item = toAcquire[k];
    const res = pipelineResults?.[k];
    const ok = res && res[1] === 'OK';
    if (ok) {
      results[item.index] = {
        index: item.index,
        result: {
          status: ReservationStatus.ACQUIRED,
          ownerToken: item.ownerToken,
        },
      };
    } else {
      results[item.index] = {
        index: item.index,
        error: new IdempotencyConflictError('Failed to acquire idempotency lock'),
      };
    }
  }
}

export async function executeBulkCompletionPipeline(
  items: ReadonlyArray<{
    team: string;
    idempotencyKey: string;
    requestPayload: unknown;
    messageId: string;
    responsePayload: Record<string, unknown>;
  }>,
  nowIso = new Date().toISOString(),
): Promise<void> {
  if (!items.length) return;
  const pipeline = redisClient.pipeline();

  for (const item of items) {
    const key = getIdempotencyKey(item.team, item.idempotencyKey);
    const requestHash = hashCanonicalObject(item.requestPayload);
    const value = buildCompletedIdempotencyPayload(requestHash, item.messageId, item.responsePayload, nowIso);
    pipeline.set(key, value, 'EX', DEFAULT_IDEMPOTENCY_TTL_SECONDS);
  }
  await pipeline.exec();
}

export async function pollIdempotencyCompletion(
  key: string,
  requestHash: string,
  retries = 5,
  delayMs = 100,
): Promise<IdempotencyReservationResult | null> {
  for (let i = 0; i < retries; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const retryVal = await redisClient.get(key);
    if (retryVal) {
      try {
        return parseExistingIdempotencyRecord(retryVal, requestHash);
      } catch (err) {
        if (err instanceof IdempotencyConflictError && err.message.includes('currently processing')) {
          continue;
        }
        throw err;
      }
    }
  }
  return null;
}

export const IdempotencyService = {
  async reserve(team: string, idempotencyKey: string, requestPayload: unknown): Promise<IdempotencyReservationResult> {
    const key = getIdempotencyKey(team, idempotencyKey);
    const requestHash = hashCanonicalObject(requestPayload);
    const ownerToken = generateOwnerToken();
    const value = buildProcessingIdempotencyPayload(requestHash, ownerToken);

    // Fast-path: 1 Redis RTT SET NX acquisition
    const acquired = await redisClient.set(key, value, 'EX', DEFAULT_IDEMPOTENCY_TTL_SECONDS, 'NX');
    if (acquired === 'OK') {
      return {
        status: ReservationStatus.ACQUIRED,
        ownerToken,
      };
    }

    // Key exists -> fetch payload to verify hash or handle completion polling
    const existing = await redisClient.get(key);
    if (existing) {
      const parsed = JSON.parse(existing) as IdempotencyRecordPayload;
      if (parsed.hash !== requestHash) {
        throw new IdempotencyConflictError(
          'The idempotency key was previously used with a different request',
          team,
          idempotencyKey,
        );
      }

      if (parsed.state === IdempotencyState.COMPLETED) {
        return {
          status: ReservationStatus.COMPLETED,
          messageId: parsed.messageId,
          responsePayload: parsed.responsePayload,
        };
      }

      // If state is still processing from another concurrent contender, poll for completion
      const polledResult = await pollIdempotencyCompletion(key, requestHash);
      if (polledResult) return polledResult;
      throw new IdempotencyConflictError(
        'A request with this idempotency key is currently processing',
        team,
        idempotencyKey,
      );
    }

    return IdempotencyService.reserve(team, idempotencyKey, requestPayload);
  },

  async complete(
    team: string,
    idempotencyKey: string,
    requestPayload: unknown,
    messageId: string,
    responsePayload: Record<string, unknown>,
    ownerToken = '',
  ): Promise<void> {
    const key = getIdempotencyKey(team, idempotencyKey);
    const requestHash = hashCanonicalObject(requestPayload);
    const value = buildCompletedIdempotencyPayload(requestHash, messageId, responsePayload);

    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if not current then
        redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
        return 1
      end
      if ARGV[1] ~= '' then
        local ok, parsed = pcall(cjson.decode, current)
        if ok and parsed and parsed.owner and parsed.owner ~= ARGV[1] then
          return 0
        end
      end
      redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
      return 1
    `;

    await redisClient.eval(luaScript, 1, key, ownerToken, value, DEFAULT_IDEMPOTENCY_TTL_SECONDS);
  },

  async release(team: string, idempotencyKey: string, ownerToken = ''): Promise<void> {
    const key = getIdempotencyKey(team, idempotencyKey);
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if not current then return 1 end
      if ARGV[1] ~= '' then
        local ok, parsed = pcall(cjson.decode, current)
        if ok and parsed and parsed.owner and parsed.owner ~= ARGV[1] then
          return 0
        end
      end
      redis.call('DEL', KEYS[1])
      return 1
    `;
    await redisClient.eval(luaScript, 1, key, ownerToken);
  },

  async reserveBulk(
    items: ReadonlyArray<{ team: string; idempotencyKey: string; requestPayload: unknown }>,
  ): Promise<Array<{ index: number; result?: IdempotencyReservationResult; error?: Error }>> {
    if (!items.length) return [];

    const keys = items.map((item) => getIdempotencyKey(item.team, item.idempotencyKey));
    const existingValues = await redisClient.mget(...keys);
    const nowIso = new Date().toISOString();

    const results: Array<{ index: number; result?: IdempotencyReservationResult; error?: Error }> = new Array(
      items.length,
    );
    const toAcquire: Array<{ index: number; key: string; value: string; ownerToken: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const existing = existingValues[i];
      const requestHash = hashCanonicalObject(item.requestPayload);

      if (existing) {
        try {
          const res = parseExistingIdempotencyRecord(existing, requestHash);
          results[i] = { index: i, result: res };
        } catch (err) {
          results[i] = { index: i, error: err as Error };
        }
        continue;
      }

      const ownerToken = generateOwnerToken();
      const value = buildProcessingIdempotencyPayload(requestHash, ownerToken, nowIso);
      toAcquire.push({ index: i, key: keys[i], value, ownerToken });
    }

    await executeBulkAcquisitionPipeline(toAcquire, results);
    return results;
  },

  async completeBulk(
    items: ReadonlyArray<{
      team: string;
      idempotencyKey: string;
      requestPayload: unknown;
      messageId: string;
      responsePayload: Record<string, unknown>;
    }>,
  ): Promise<void> {
    await executeBulkCompletionPipeline(items);
  },

  async releaseBulk(items: ReadonlyArray<{ team: string; idempotencyKey: string }>): Promise<void> {
    const keys = items.map((item) => getIdempotencyKey(item.team, item.idempotencyKey));
    await deleteIdempotencyKeys(keys);
  },
};
