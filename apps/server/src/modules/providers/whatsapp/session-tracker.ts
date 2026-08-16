import { redisClient } from '../../../queues/connection';
import { logger } from '../../../utils/logger';
import { normalizePhoneNumber } from '../../../utils/recipients';
import { formatRedisKey } from '../../../utils/redis-keys';
import { WhatsAppMetrics } from './metrics';

export enum WhatsAppSessionTtl {
  DEFAULT_24H_SECONDS = 86_400, // 24 hours
  L1_CACHE_TTL_MS = 5_000, // 5 seconds micro L1 cache
}

export const DEFAULT_WA_SESSION_TTL_SECONDS = WhatsAppSessionTtl.DEFAULT_24H_SECONDS;
export const SESSION_L1_CACHE_TTL_MS = WhatsAppSessionTtl.L1_CACHE_TTL_MS;

export interface WhatsAppSessionMetadata {
  lastInboundAt: string;
  inboundCount: number;
  expiresAtMs: number;
}

export interface WhatsAppSessionInfo {
  active: boolean;
  remainingSeconds: number;
  metadata?: WhatsAppSessionMetadata;
}

// Sub-millisecond L1 In-Memory Cache to eliminate Redis RTT overhead on hot dispatch loops
const sessionL1Cache = new Map<string, { active: boolean; expiresAtMs: number }>();

function getL1Cache(key: string): boolean | null {
  const cached = sessionL1Cache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAtMs) {
    sessionL1Cache.delete(key);
    return null;
  }
  return cached.active;
}

function setL1Cache(key: string, active: boolean, ttlMs: number = WhatsAppSessionTtl.L1_CACHE_TTL_MS): void {
  // Prevent unbounded Map memory growth
  if (sessionL1Cache.size > 20_000) {
    sessionL1Cache.clear();
  }
  sessionL1Cache.set(key, { active, expiresAtMs: Date.now() + ttlMs });
}

function invalidateL1Cache(key: string): void {
  sessionL1Cache.delete(key);
}

export function getWhatsAppSessionKey(providerId: string, phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return formatRedisKey(`wa:session:${providerId}:${normalized}`);
}

/**
 * Lua Script: Atomically reads, increments count, sets timestamps and TTL in a single Redis RTT.
 * Prevents TOCTOU race conditions across distributed webhook worker replicas.
 */
const RECORD_INBOUND_LUA_SCRIPT = `
  local key = KEYS[1]
  local isoNow = ARGV[1]
  local ttlSec = tonumber(ARGV[2])
  local nowMs = tonumber(ARGV[3])

  local existing = redis.call('GET', key)
  local count = 1

  if existing then
    local ok, parsed = pcall(cjson.decode, existing)
    if ok and parsed and parsed.inboundCount then
      count = parsed.inboundCount + 1
    end
  end

  local expiresAt = nowMs + (ttlSec * 1000)
  local payload = cjson.encode({
    lastInboundAt = isoNow,
    inboundCount = count,
    expiresAtMs = expiresAt
  })

  redis.call('SET', key, payload, 'EX', ttlSec)
  return count
`;

/**
 * Record or refresh an inbound customer message, extending the 24-hour service window.
 * Uses atomic Lua script execution for 100% thread safety across worker replicas.
 */
export async function recordWhatsAppInboundMessage(
  providerId: string,
  rawPhone: string,
  ttlSeconds: number = WhatsAppSessionTtl.DEFAULT_24H_SECONDS,
): Promise<void> {
  if (!rawPhone || !providerId) return;

  const key = getWhatsAppSessionKey(providerId, rawPhone);
  const nowMs = Date.now();
  const isoNow = new Date(nowMs).toISOString();

  // Optimistically update L1 cache immediately
  setL1Cache(key, true);

  // Record Prometheus metrics
  WhatsAppMetrics.recordInboundMessage(providerId);

  try {
    if (typeof (redisClient as unknown as { eval: (...args: unknown[]) => unknown }).eval === 'function') {
      await redisClient.eval(RECORD_INBOUND_LUA_SCRIPT, 1, key, isoNow, String(ttlSeconds), String(nowMs));
    } else {
      // Fallback for mock/test environments
      const existingRaw = await redisClient.get(key);
      let inboundCount = 1;
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw) as WhatsAppSessionMetadata;
          inboundCount = (parsed.inboundCount || 0) + 1;
        } catch {
          inboundCount = 1;
        }
      }
      const metadata: WhatsAppSessionMetadata = {
        lastInboundAt: isoNow,
        inboundCount,
        expiresAtMs: nowMs + ttlSeconds * 1000,
      };
      await redisClient.set(key, JSON.stringify(metadata), 'EX', ttlSeconds);
    }
  } catch (err) {
    logger.warn('WhatsAppSessionTracker', `Failed to record session for ${rawPhone}: ${(err as Error).message}`);
  }
}

/**
 * Check if a recipient has an active 24-hour customer service window.
 * Leverages sub-millisecond L1 cache before hitting Redis.
 */
export async function hasWhatsAppActiveSession(providerId: string, rawPhone: string): Promise<boolean> {
  if (!rawPhone || !providerId) return false;

  const key = getWhatsAppSessionKey(providerId, rawPhone);

  // Fast-path 1: Check L1 memory cache (0.01ms)
  const cachedState = getL1Cache(key);
  if (cachedState !== null) {
    return cachedState;
  }

  // Fast-path 2: Query Redis
  try {
    const exists = await redisClient.exists(key);
    const isActive = exists === 1;
    setL1Cache(key, isActive);
    return isActive;
  } catch (err) {
    logger.warn('WhatsAppSessionTracker', `Failed to check session for ${rawPhone}: ${(err as Error).message}`);
    return false; // Safe fallback to standard template send
  }
}

/**
 * Retrieve detailed session window information including remaining TTL and message count.
 */
export async function getWhatsAppSessionDetails(providerId: string, rawPhone: string): Promise<WhatsAppSessionInfo> {
  if (!rawPhone || !providerId) {
    return { active: false, remainingSeconds: 0 };
  }

  try {
    const key = getWhatsAppSessionKey(providerId, rawPhone);
    const [ttl, rawData] = await Promise.all([redisClient.ttl(key), redisClient.get(key)]);

    if (ttl <= 0 || !rawData) {
      invalidateL1Cache(key);
      return { active: false, remainingSeconds: 0 };
    }

    let metadata: WhatsAppSessionMetadata | undefined;
    try {
      metadata = JSON.parse(rawData) as WhatsAppSessionMetadata;
    } catch {
      metadata = undefined;
    }

    setL1Cache(key, true);

    return {
      active: true,
      remainingSeconds: ttl,
      metadata,
    };
  } catch (err) {
    logger.warn('WhatsAppSessionTracker', `Failed to fetch session details: ${(err as Error).message}`);
    return { active: false, remainingSeconds: 0 };
  }
}

/**
 * Batch check active 24-hour session windows across multiple recipient phones.
 * Combines sub-millisecond L1 cache with single-RTT Redis pipelining for ultra-high throughput.
 */
export async function hasActiveSessionsBatch(providerId: string, rawPhones: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (!rawPhones || rawPhones.length === 0 || !providerId) {
    return result;
  }

  const missingPhones: string[] = [];
  const missingKeys: string[] = [];

  // 1. Resolve from L1 Cache
  for (const phone of rawPhones) {
    const key = getWhatsAppSessionKey(providerId, phone);
    const cachedState = getL1Cache(key);
    if (cachedState !== null) {
      result.set(phone, cachedState);
    } else {
      missingPhones.push(phone);
      missingKeys.push(key);
    }
  }

  // If all phones were cache hits, return immediately without network call
  if (missingPhones.length === 0) {
    return result;
  }

  // 2. Fetch missing keys via Redis Pipeline in 1 RTT
  try {
    const pipeline = redisClient.pipeline();
    for (const key of missingKeys) {
      pipeline.exists(key);
    }

    const responses = await pipeline.exec();
    if (responses) {
      responses.forEach(([err, count], index) => {
        const phone = missingPhones[index];
        const key = missingKeys[index];
        const isActive = !err && count === 1;
        result.set(phone, isActive);
        setL1Cache(key, isActive);
      });
    }
  } catch (err) {
    logger.warn('WhatsAppSessionTracker', `Failed batch session check: ${(err as Error).message}`);
    for (const phone of missingPhones) {
      result.set(phone, false);
    }
  }

  return result;
}

/**
 * Manually delete/expire a session window and invalidate L1 cache.
 */
export async function clearWhatsAppSession(providerId: string, rawPhone: string): Promise<void> {
  if (!rawPhone || !providerId) return;
  const key = getWhatsAppSessionKey(providerId, rawPhone);
  invalidateL1Cache(key);

  try {
    await redisClient.del(key);
  } catch (err) {
    logger.warn('WhatsAppSessionTracker', `Failed to clear session: ${(err as Error).message}`);
  }
}

export const WhatsAppSessionTracker = {
  getSessionKey: getWhatsAppSessionKey,
  recordInboundMessage: recordWhatsAppInboundMessage,
  hasActiveSession: hasWhatsAppActiveSession,
  getSessionDetails: getWhatsAppSessionDetails,
  hasActiveSessionsBatch: hasActiveSessionsBatch,
  clearSession: clearWhatsAppSession,
};
