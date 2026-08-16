import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisClient.on('error', (err) => {
  logger.error('RedisClient', `Redis error: ${err.message}`, err);
});

export const redisConnectionOptions = {
  url: env.REDIS_URL,
};
