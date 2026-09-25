import { expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { Registry } from 'prom-client';
import { createHttpMetrics } from '../src/utils/http-metrics';

test('HTTP metrics use route templates and final response statuses', async () => {
  const registry = new Registry();
  const metrics = createHttpMetrics(registry);
  const app = new Elysia()
    .use(metrics.instrument)
    .get('/messages/:id', () => Response.json({ error: 'denied' }, { status: 403 }))
    .get('/ok', () => ({ ok: true }))
    .get('/failure', () => {
      throw new Error('failure');
    });
  for (let id = 0; id < 100; id++) await app.handle(new Request(`http://localhost/messages/${id}?secret=private`));
  await app.handle(new Request('http://localhost/ok'));
  await app.handle(new Request('http://localhost/failure'));
  for (let id = 0; id < 10; id++) await app.handle(new Request(`http://localhost/unknown/${id}`));
  const samples = (await metrics.requests.get()).values;
  expect(samples).toHaveLength(4);
  expect(samples.find((sample) => sample.labels.path === '/messages/:id')?.value).toBe(100);
  expect(samples.find((sample) => sample.labels.path === '/messages/:id')?.labels.status).toBe('403');
  expect(samples.find((sample) => sample.labels.path === '/ok')?.labels.status).toBe('200');
  expect(samples.find((sample) => sample.labels.path === '/failure')?.labels.status).toBe('500');
  expect(samples.find((sample) => sample.labels.path === '__unmatched__')?.labels.status).toBe('404');
  expect(await registry.metrics()).not.toContain('private');
});
