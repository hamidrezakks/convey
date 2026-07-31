import { describe, expect, it } from 'bun:test';
import { QueueAutoscaler } from '../src/queues/queue-autoscaler';

describe('Adaptive BullMQ Queue Autoscaler', () => {
  it('computes recommended worker concurrency based on queue backlog depth', () => {
    const autoscaler = new QueueAutoscaler();

    const lowScale = autoscaler.computeOptimalConcurrency('email_queue', 0);
    expect(lowScale.recommendedConcurrency).toBe(2);

    const medScale = autoscaler.computeOptimalConcurrency('email_queue', 250);
    expect(medScale.recommendedConcurrency).toBe(5);

    const highScale = autoscaler.computeOptimalConcurrency('email_queue', 10000);
    expect(highScale.recommendedConcurrency).toBe(100);
  });
});
