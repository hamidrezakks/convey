import { redisClient } from '../../queues/connection';
import { formatRedisKey } from '../../utils/redis-keys';

export interface TokenBucketResult {
  allowed: boolean;
  remainingTokens: number;
}

export const TokenBucketLimiter = {
  async consume(
    key: string,
    capacity: number,
    refillRatePerSec: number,
    tokensRequested = 1,
  ): Promise<TokenBucketResult> {
    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local requested = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])

      local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local tokens = tonumber(data[1])
      local lastRefill = tonumber(data[2])

      if not tokens then
        tokens = capacity
        lastRefill = now
      else
        local delta = math.max(0, (now - lastRefill) / 1000)
        tokens = math.min(capacity, tokens + delta * refillRate)
        lastRefill = now
      end

      if tokens >= requested then
        tokens = tokens - requested
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, math.ceil(capacity / refillRate) * 2)
        return { 1, math.floor(tokens) }
      else
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, math.ceil(capacity / refillRate) * 2)
        return { 0, math.floor(tokens) }
      end
    `;

    const nowMs = Date.now();
    const result = (await redisClient.eval(
      luaScript,
      1,
      formatRedisKey(`tokenbucket:${key}`),
      capacity.toString(),
      refillRatePerSec.toString(),
      tokensRequested.toString(),
      nowMs.toString(),
    )) as [number, number];

    return {
      allowed: result[0] === 1,
      remainingTokens: result[1],
    };
  },
};
