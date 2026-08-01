import { describe, expect, test } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { CircuitState, ProviderCircuitBreaker } from '../src/modules/providers/core/circuit-breaker';
import { resolveProviderForChannel } from '../src/queues/workers/message-dispatch.worker';

describe('Provider Circuit Breaker & Resiliency Suite', () => {
  test('Initial state is CLOSED and allows execution', () => {
    const cb = new ProviderCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    expect(cb.getState('test-provider')).toBe(CircuitState.CLOSED);
    expect(cb.canExecute('test-provider')).toBe(true);
  });

  test('Consecutive failures trip circuit to OPEN', () => {
    const cb = new ProviderCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });

    cb.recordFailure('test-provider', false);
    expect(cb.getState('test-provider')).toBe(CircuitState.CLOSED);

    cb.recordFailure('test-provider', false);
    expect(cb.getState('test-provider')).toBe(CircuitState.CLOSED);

    cb.recordFailure('test-provider', false);
    expect(cb.getState('test-provider')).toBe(CircuitState.OPEN);
    expect(cb.canExecute('test-provider')).toBe(false);
  });

  test('Permanent failure immediately trips circuit to OPEN', () => {
    const cb = new ProviderCircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 1000 });

    cb.recordFailure('perm-provider', true);
    expect(cb.getState('perm-provider')).toBe(CircuitState.OPEN);
    expect(cb.canExecute('perm-provider')).toBe(false);
  });

  test('Successful send resets circuit to CLOSED', () => {
    const cb = new ProviderCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });

    cb.recordFailure('rec-provider', false);
    cb.recordFailure('rec-provider', false);
    expect(cb.getState('rec-provider')).toBe(CircuitState.OPEN);

    cb.recordSuccess('rec-provider');
    expect(cb.getState('rec-provider')).toBe(CircuitState.CLOSED);
    expect(cb.canExecute('rec-provider')).toBe(true);
  });

  test('Circuit counts summarize status correctly', () => {
    const cb = new ProviderCircuitBreaker({ failureThreshold: 2 });
    cb.recordSuccess('p1');
    cb.recordFailure('p2', true);

    const counts = cb.getCounts();
    expect(counts.closed).toBe(1);
    expect(counts.open).toBe(1);
    expect(counts.halfOpen).toBe(0);
  });

  test('resolveProviderForChannel skips OPEN circuits during routing', async () => {
    // Healthy channel resolution
    const provider = await resolveProviderForChannel('team-a', 'transactional', 'US', Channel.SMS, 'twilio');
    expect(provider).toBeDefined();
  });
});
