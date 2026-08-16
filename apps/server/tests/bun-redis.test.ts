import { describe, expect, it } from 'bun:test';
import { BunNativeRedis, redisClient, redisConnectionOptions } from '../src/queues/connection';

describe('Bun Native Redis Client Test Suite', () => {
  it('instantiates BunNativeRedis and parses connection options correctly', () => {
    expect(redisClient).toBeDefined();
    expect(redisClient).toBeInstanceOf(BunNativeRedis);
    expect(redisConnectionOptions.url).toBeDefined();
    expect(typeof redisConnectionOptions.port).toBe('number');
    expect(redisConnectionOptions.host).toBeDefined();
  });

  it('supports duplicate() to create isolated client instances', () => {
    const dup = redisClient.duplicate();
    expect(dup).toBeInstanceOf(BunNativeRedis);
    expect(dup.url).toBe(redisClient.url);
    expect(dup.client).not.toBe(redisClient.client);
  });

  it('constructs pipeline and queues multiple commands for batch execution', async () => {
    const pipe = redisClient.pipeline();
    expect(pipe).toBeDefined();

    pipe.set('test:pipe:1', 'val1');
    pipe.get('test:pipe:1');
    pipe.hset('test:pipe:hash', 'fieldA', '100');
    pipe.hget('test:pipe:hash', 'fieldA');
    pipe.sadd('test:pipe:set', 'item1', 'item2');
    pipe.expire('test:pipe:1', 60);

    expect(typeof pipe.exec).toBe('function');
  });

  it('exposes all native Redis string, hash, set, and pubsub operations', () => {
    expect(typeof redisClient.get).toBe('function');
    expect(typeof redisClient.set).toBe('function');
    expect(typeof redisClient.setnx).toBe('function');
    expect(typeof redisClient.setex).toBe('function');
    expect(typeof redisClient.del).toBe('function');
    expect(typeof redisClient.incr).toBe('function');
    expect(typeof redisClient.decr).toBe('function');
    expect(typeof redisClient.expire).toBe('function');
    expect(typeof redisClient.ttl).toBe('function');
    expect(typeof redisClient.mget).toBe('function');
    expect(typeof redisClient.hget).toBe('function');
    expect(typeof redisClient.hset).toBe('function');
    expect(typeof redisClient.hmset).toBe('function');
    expect(typeof redisClient.hgetall).toBe('function');
    expect(typeof redisClient.hincrby).toBe('function');
    expect(typeof redisClient.sadd).toBe('function');
    expect(typeof redisClient.srem).toBe('function');
    expect(typeof redisClient.smembers).toBe('function');
    expect(typeof redisClient.sismember).toBe('function');
    expect(typeof redisClient.scard).toBe('function');
    expect(typeof redisClient.publish).toBe('function');
    expect(typeof redisClient.subscribe).toBe('function');
    expect(typeof redisClient.eval).toBe('function');
    expect(typeof redisClient.send).toBe('function');
    expect(typeof redisClient.ping).toBe('function');
  });

  it('handles custom event listeners on, off, and emit', () => {
    let fired = false;
    const handler = (arg: string) => {
      fired = arg === 'test-payload';
    };

    redisClient.on('custom-test', handler);
    redisClient.emit('custom-test', 'test-payload');
    expect(fired).toBe(true);

    redisClient.off('custom-test', handler);
    fired = false;
    redisClient.emit('custom-test', 'test-payload');
    expect(fired).toBe(false);
  });
});
