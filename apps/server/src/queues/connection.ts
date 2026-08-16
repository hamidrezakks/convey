import { RedisClient } from 'bun';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface BunRedisPipeline {
  get(key: string): this;
  set(key: string, value: string, ...args: (string | number)[]): this;
  del(...keys: (string | string[])[]): this;
  mget(...keys: (string | string[])[]): this;
  exists(...keys: (string | string[])[]): this;
  hset(key: string, fieldOrObj: string | Record<string, unknown>, value?: unknown): this;
  hget(key: string, field: string): this;
  hgetall(key: string): this;
  hincrby(key: string, field: string, increment: number): this;
  expire(key: string, seconds: number): this;
  sadd(key: string, ...members: (string | number)[]): this;
  srem(key: string, ...members: (string | number)[]): this;
  publish(channel: string, message: string): this;
  exec(): Promise<[Error | null, unknown][]>;
}

export class BunNativeRedis {
  public client: RedisClient;
  public readonly url: string;
  private readonly eventHandlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor(url: string = env.REDIS_URL) {
    this.url = url;
    this.client = new RedisClient(url);
  }

  get connected(): boolean {
    return this.client.connected;
  }

  async get(key: string): Promise<string | null> {
    const val = await this.client.get(key);
    return val !== null && val !== undefined ? String(val) : null;
  }

  async set(key: string, value: string | number, ...args: (string | number)[]): Promise<string | boolean | null> {
    if (args.length === 0) {
      return (await this.client.set(key, String(value))) as string;
    }
    return (await this.client.send('SET', [key, String(value), ...args.map(String)])) as string | boolean | null;
  }

  async setnx(key: string, value: string | number): Promise<number | boolean> {
    return (await this.client.setnx(key, String(value))) as number | boolean;
  }

  async setex(key: string, seconds: number, value: string | number): Promise<string> {
    return (await this.client.setex(key, seconds, String(value))) as string;
  }

  async del(...keys: (string | string[])[]): Promise<number> {
    const flatKeys = (keys as unknown[]).flat() as string[];
    if (flatKeys.length === 0) return 0;
    return (await this.client.del(...flatKeys)) as number;
  }

  async incr(key: string): Promise<number> {
    return (await this.client.incr(key)) as number;
  }

  async decr(key: string): Promise<number> {
    return (await this.client.decr(key)) as number;
  }

  async expire(key: string, seconds: number): Promise<number | boolean> {
    return (await this.client.expire(key, seconds)) as number | boolean;
  }

  async ttl(key: string): Promise<number> {
    return (await this.client.ttl(key)) as number;
  }

  async mget(...keys: (string | string[])[]): Promise<(string | null)[]> {
    const flatKeys = (keys as unknown[]).flat() as string[];
    if (flatKeys.length === 0) return [];
    const res = (await this.client.mget(...flatKeys)) as (string | null)[] | null;
    return (res || []).map((v) => (v !== null && v !== undefined ? String(v) : null));
  }

  async exists(...keys: (string | string[])[]): Promise<number> {
    const flatKeys = (keys as unknown[]).flat() as string[];
    if (flatKeys.length === 0) return 0;
    return (await this.client.exists(...flatKeys)) as number;
  }

  async hget(key: string, field: string): Promise<string | null> {
    const val = await this.client.hget(key, field);
    return val !== null && val !== undefined ? String(val) : null;
  }

  async hset(key: string, fieldOrObj: string | Record<string, unknown>, value?: unknown): Promise<number> {
    if (typeof fieldOrObj === 'object' && fieldOrObj !== null) {
      const entries: string[] = [];
      for (const [k, v] of Object.entries(fieldOrObj)) {
        entries.push(k, String(v ?? ''));
      }
      if (entries.length === 0) return 0;
      return (await this.client.send('HSET', [key, ...entries])) as number;
    }
    return (await this.client.hset(key, fieldOrObj, String(value ?? ''))) as number;
  }

  async hmset(key: string, obj: Record<string, unknown>): Promise<string> {
    const entries: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      entries.push(k, String(v ?? ''));
    }
    if (entries.length === 0) return 'OK';
    return (await this.client.send('HSET', [key, ...entries])) as string;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const res = await this.client.hgetall(key);
    if (!res) return {};
    if (typeof res === 'object' && !Array.isArray(res)) {
      return res as Record<string, string>;
    }
    if (Array.isArray(res)) {
      const map: Record<string, string> = {};
      for (let i = 0; i < res.length; i += 2) {
        map[res[i]] = String(res[i + 1] ?? '');
      }
      return map;
    }
    return {};
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return (await this.client.hincrby(key, field, increment)) as number;
  }

  async sadd(key: string, ...members: (string | number)[]): Promise<number> {
    if (members.length === 0) return 0;
    return (await this.client.sadd(key, ...members.map(String))) as number;
  }

  async srem(key: string, ...members: (string | number)[]): Promise<number> {
    if (members.length === 0) return 0;
    return (await this.client.srem(key, ...members.map(String))) as number;
  }

  async smembers(key: string): Promise<string[]> {
    const res = (await this.client.smembers(key)) as string[] | null;
    return res || [];
  }

  async sismember(key: string, member: string | number): Promise<number | boolean> {
    return (await this.client.sismember(key, String(member))) as number | boolean;
  }

  async scard(key: string): Promise<number> {
    return (await this.client.scard(key)) as number;
  }

  async publish(channel: string, message: string): Promise<number> {
    return (await this.client.publish(channel, message)) as number;
  }

  async subscribe(channel: string, callback?: (err: Error | null, count?: number) => void): Promise<void> {
    try {
      await this.client.subscribe(channel);
      callback?.(null);
    } catch (err) {
      callback?.(err as Error);
    }
  }

  async unsubscribe(channel?: string): Promise<void> {
    if (channel) {
      await this.client.unsubscribe(channel);
    } else {
      await this.client.unsubscribe();
    }
  }

  async eval(script: string, numkeys: number, ...keysAndArgs: (string | number)[]): Promise<unknown> {
    return await this.client.send('EVAL', [script, String(numkeys), ...keysAndArgs.map(String)]);
  }

  async send(command: string, ...args: (string | number)[]): Promise<unknown> {
    return await this.client.send(command, args.map(String));
  }

  async flushall(): Promise<string> {
    return (await this.client.send('FLUSHALL', [])) as string;
  }

  async flushdb(): Promise<string> {
    return (await this.client.send('FLUSHDB', [])) as string;
  }

  async keys(pattern = '*'): Promise<string[]> {
    const res = (await this.client.send('KEYS', [pattern])) as string[] | null;
    return res || [];
  }

  pipeline(): BunRedisPipeline {
    const operations: Array<() => Promise<unknown>> = [];
    const pipe: BunRedisPipeline = {
      get: (key: string) => {
        operations.push(() => this.get(key));
        return pipe;
      },
      set: (key: string, value: string, ...args: (string | number)[]) => {
        operations.push(() => this.set(key, value, ...args));
        return pipe;
      },
      del: (...keys: (string | string[])[]) => {
        operations.push(() => this.del(...keys));
        return pipe;
      },
      mget: (...keys: (string | string[])[]) => {
        operations.push(() => this.mget(...keys));
        return pipe;
      },
      exists: (...keys: (string | string[])[]) => {
        operations.push(() => this.exists(...keys));
        return pipe;
      },
      hset: (key: string, fieldOrObj: string | Record<string, unknown>, value?: unknown) => {
        operations.push(() => this.hset(key, fieldOrObj, value));
        return pipe;
      },
      hget: (key: string, field: string) => {
        operations.push(() => this.hget(key, field));
        return pipe;
      },
      hgetall: (key: string) => {
        operations.push(() => this.hgetall(key));
        return pipe;
      },
      hincrby: (key: string, field: string, increment: number) => {
        operations.push(() => this.hincrby(key, field, increment));
        return pipe;
      },
      expire: (key: string, seconds: number) => {
        operations.push(() => this.expire(key, seconds));
        return pipe;
      },
      sadd: (key: string, ...members: (string | number)[]): BunRedisPipeline => {
        operations.push(() => this.sadd(key, ...members));
        return pipe;
      },
      srem: (key: string, ...members: (string | number)[]): BunRedisPipeline => {
        operations.push(() => this.srem(key, ...members));
        return pipe;
      },
      publish: (channel: string, message: string) => {
        operations.push(() => this.publish(channel, message));
        return pipe;
      },
      exec: async (): Promise<[Error | null, unknown][]> => {
        const results = await Promise.allSettled(operations.map((op) => op()));
        return results.map((r) => (r.status === 'fulfilled' ? [null, r.value] : [r.reason as Error, null]));
      },
    };
    return pipe;
  }

  duplicate(): BunNativeRedis {
    return new BunNativeRedis(this.url);
  }

  async ping(message?: string): Promise<string> {
    if (message) {
      return (await this.client.send('PING', [message])) as string;
    }
    return (await this.client.ping()) as string;
  }

  close(): void {
    this.client.close();
  }

  async quit(): Promise<void> {
    this.client.close();
  }

  on(event: string, handler: (...args: unknown[]) => void): this {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
    return this;
  }

  off(event: string, handler: (...args: unknown[]) => void): this {
    this.eventHandlers.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const handlers = this.eventHandlers.get(event);
    if (!handlers || handlers.size === 0) return false;
    for (const h of handlers) {
      try {
        h(...args);
      } catch (err) {
        logger.error('BunNativeRedis', `Error in event handler '${event}'`, err);
      }
    }
    return true;
  }
}

export const redisClient = new BunNativeRedis();

const parsedRedisUrl = new URL(env.REDIS_URL);
export const redisConnectionOptions = {
  url: env.REDIS_URL,
  host: parsedRedisUrl.hostname || 'localhost',
  port: Number.parseInt(parsedRedisUrl.port || '6379', 10),
  password: parsedRedisUrl.password || undefined,
  username: parsedRedisUrl.username || undefined,
  db: parsedRedisUrl.pathname ? Number.parseInt(parsedRedisUrl.pathname.replace('/', ''), 10) || 0 : 0,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};
