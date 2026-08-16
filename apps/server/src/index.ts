import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { Counter, Histogram, Registry } from 'prom-client';
import { bootstrapService } from './bootstrap';
import { env } from './config/env';
import { queryClient } from './db';
import { adminController } from './modules/admin/admin.controller';
import { batchesController } from './modules/messaging/batches.controller';
import { dlqController } from './modules/messaging/dlq.controller';
import { messagingController } from './modules/messaging/messaging.controller';

import { sandboxController } from './modules/messaging/sandbox.controller';
import { providerCircuitBreaker } from './modules/providers/core/circuit-breaker';
import { suppressionsController } from './modules/suppressions/suppressions.controller';
import { webhookSubscriptionsController } from './modules/webhooks/webhook-subscriptions.controller';
import { webhooksController } from './modules/webhooks/webhooks.controller';

import { redisClient } from './queues/connection';
import { logger } from './utils/logger';
import { appReadiness } from './utils/readiness';
import { shutdownOrchestrator } from './utils/shutdown';

// Prometheus Metrics Registry
export const metricsRegistry = new Registry();

export const httpRequestsTotal = new Counter({
  name: 'convey_http_requests_total',
  help: 'Total HTTP requests processed by Convey',
  labelNames: ['method', 'path', 'status'],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'convey_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

export const messagesAcceptedTotal = new Counter({
  name: 'convey_messages_accepted_total',
  help: 'Total messages accepted for asynchronous dispatch',
  labelNames: ['team', 'category', 'priority'],
  registers: [metricsRegistry],
});

export const dlqReplaysTotal = new Counter({
  name: 'convey_dlq_replays_total',
  help: 'Total failed messages replayed via DLQ',
  labelNames: ['team'],
  registers: [metricsRegistry],
});

export const circuitTripsTotal = new Counter({
  name: 'convey_circuit_breaker_trips_total',
  help: 'Total provider circuit breaker trip events',
  labelNames: ['providerId', 'state'],
  registers: [metricsRegistry],
});

export const whatsappSessionOptimizationsTotal = new Counter({
  name: 'convey_whatsapp_session_optimizations_total',
  help: 'Total WhatsApp template messages converted to zero-cost plain text session messages',
  labelNames: ['providerId'],
  registers: [metricsRegistry],
});

export const whatsappSessionInboundTotal = new Counter({
  name: 'convey_whatsapp_session_inbound_total',
  help: 'Total inbound WhatsApp customer messages extending 24-hour service windows',
  labelNames: ['providerId'],
  registers: [metricsRegistry],
});

export const whatsappSessionCostSavedUsdTotal = new Counter({
  name: 'convey_whatsapp_session_cost_saved_usd_total',
  help: 'Total estimated USD saved by optimizing template messages to session text messages',
  labelNames: ['providerId'],
  registers: [metricsRegistry],
});

import { TraceContext } from './utils/trace-context';

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Convey Communication Service API',
          version: '1.0.0',
          description: 'High-performance, resilient multi-tenant communication infrastructure service.',
        },
        tags: [
          { name: 'Messages', description: 'Message send and status endpoints' },
          { name: 'Webhooks', description: 'Provider webhooks, open tracking, and client receipts' },
        ],
      },
    }),
  )
  .options('/*', ({ set }) => {
    set.headers['access-control-allow-origin'] = '*';
    set.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
    set.headers['access-control-allow-headers'] = 'Content-Type, Authorization, x-api-key, traceparent';
    return new Response(null, { status: 204, headers: set.headers });
  })
  .derive(({ request, path, set }) => {
    set.headers['access-control-allow-origin'] = '*';
    set.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
    set.headers['access-control-allow-headers'] = 'Content-Type, Authorization, x-api-key, traceparent';
    const pathname =
      path || (request.url.indexOf('/', 8) !== -1 ? request.url.slice(request.url.indexOf('/', 8)) : request.url);
    httpRequestsTotal.inc({ method: request.method, path: pathname });
    const traceCtx = TraceContext.extractOrCreate({ traceparent: request.headers.get('traceparent') || undefined });
    return {
      startTime: performance.now(),
      traceCtx,
      pathname,
    };
  })
  .afterResponse(({ request, startTime, pathname }: { request: Request; startTime?: number; pathname?: string }) => {
    const durationSeconds = (performance.now() - (startTime || performance.now())) / 1000;
    httpRequestDuration.observe({ method: request.method, path: pathname || request.url }, durationSeconds);
  })
  .get('/health', async () => {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';

    try {
      await queryClient.unsafe('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    try {
      await redisClient.ping();
      redisStatus = 'connected';
    } catch {
      redisStatus = 'error';
    }

    const currentReadiness = appReadiness.getStatus();
    const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';
    const statusCode = isHealthy && (env.NODE_ENV === 'test' || currentReadiness.ready) ? 200 : 503;

    return new Response(
      JSON.stringify({
        status: isHealthy ? 'ok' : 'degraded',
        ready: currentReadiness.ready,
        uptime: process.uptime(),
        db: dbStatus,
        redis: redisStatus,
        partitions: currentReadiness.partitions,
        circuitBreakers: providerCircuitBreaker.getCounts(),
        configuredProvidersCount: currentReadiness.configuredProvidersCount,
        configuredProvidersByChannel: currentReadiness.configuredProvidersByChannel,
        timestamp: new Date().toISOString(),
      }),
      { status: statusCode, headers: { 'Content-Type': 'application/json' } },
    );
  })
  .get('/health/readiness', async () => {
    const status = appReadiness.getStatus();
    const statusCode = status.ready ? 200 : 503;

    return new Response(
      JSON.stringify({
        ready: status.ready,
        uptime: process.uptime(),
        checks: {
          db: status.db,
          redis: status.redis,
          partitions: status.partitions,
        },
        circuitBreakers: {
          counts: providerCircuitBreaker.getCounts(),
          statuses: providerCircuitBreaker.getAllStatus(),
        },
        providers: {
          configuredCount: status.configuredProvidersCount,
          byChannel: status.configuredProvidersByChannel,
        },
        workers: status.activeWorkers,
        bootstrappedAt: status.bootstrappedAt,
        timestamp: new Date().toISOString(),
      }),
      { status: statusCode, headers: { 'Content-Type': 'application/json' } },
    );
  })
  .get('/health/liveness', () => {
    return new Response(
      JSON.stringify({
        status: 'alive',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  })
  .get('/metrics', async () => {
    const metrics = await metricsRegistry.metrics();
    return new Response(metrics, {
      status: 200,
      headers: { 'Content-Type': metricsRegistry.contentType },
    });
  })
  .use(messagingController)
  .use(adminController)
  .use(webhooksController)
  .use(dlqController)
  .use(sandboxController)
  .use(suppressionsController)
  .use(webhookSubscriptionsController)
  .use(batchesController);

if (env.NODE_ENV !== 'test' && import.meta.main) {
  shutdownOrchestrator.registerSignalListeners();
  bootstrapService()
    .then(() => {
      app.listen(env.PORT, () => {
        logger.info('Server', `🚀 Convey Service is running at http://localhost:${env.PORT}`);
        logger.info('Server', `📚 OpenAPI Documentation available at http://localhost:${env.PORT}/swagger`);
      });
    })
    .catch((err) => {
      logger.error('Bootstrap', 'Fatal error during Convey Service bootstrap', { error: err.message });
      process.exit(1);
    });
}

export { app };
