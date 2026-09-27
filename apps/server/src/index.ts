import { cors } from '@elysia/cors';
import { openapi } from '@elysia/openapi';
import { Elysia } from 'elysia';
import { Counter, Histogram, Registry } from 'prom-client';
import { bootstrapService } from './bootstrap';
import { env } from './config/env';
import { queryClient } from './db';
import { adminController } from './modules/admin/admin.controller';
import { verifyApiAuth } from './modules/auth/auth.middleware';
import { batchesController } from './modules/messaging/batches.controller';
import { dlqController } from './modules/messaging/dlq.controller';
import { messagingController } from './modules/messaging/messaging.controller';
import { sandboxController } from './modules/messaging/sandbox.controller';
import { providerCircuitBreaker } from './modules/providers/core/circuit-breaker';
import { suppressionsController } from './modules/suppressions/suppressions.controller';
import { templatesController } from './modules/templates/templates.controller';
import { webhookSubscriptionsController } from './modules/webhooks/webhook-subscriptions.controller';
import { webhooksController } from './modules/webhooks/webhooks.controller';
import {
  ObservabilityDocs,
  OpenAPIComponentsSchemas,
  OpenAPIInfo,
  OpenAPISecuritySchemes,
  OpenAPIServers,
  OpenAPITags,
} from './openapi';
import { redisClient } from './queues/connection';
import { createHttpMetrics } from './utils/http-metrics';
import { logger } from './utils/logger';
import { createOperationalMetrics } from './utils/operational-metrics';
import { appReadiness } from './utils/readiness';
import { shutdownOrchestrator } from './utils/shutdown';
import { TraceContext } from './utils/trace-context';

// Prometheus Metrics Registry
export const metricsRegistry = new Registry();

const httpMetrics = createHttpMetrics(metricsRegistry);
const refreshOperationalMetrics = createOperationalMetrics(metricsRegistry);
export const httpRequestsTotal = httpMetrics.requests;
export const httpRequestDuration = httpMetrics.duration;

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

export const providerProxyRequestsTotal = new Counter({
  name: 'convey_provider_proxy_requests_total',
  help: 'Total outbound requests executed through transport proxies',
  labelNames: ['providerId', 'proxyType', 'status'],
  registers: [metricsRegistry],
});

export const providerProxyDuration = new Histogram({
  name: 'convey_provider_proxy_duration_seconds',
  help: 'Latency of outbound requests routed via transport proxies',
  labelNames: ['providerId', 'proxyType'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const providerProxyErrorsTotal = new Counter({
  name: 'convey_provider_proxy_errors_total',
  help: 'Total errors encountered during proxy transport execution',
  labelNames: ['providerId', 'proxyType', 'errorCode'],
  registers: [metricsRegistry],
});

export const whatsappSessionCostSavedUsdTotal = new Counter({
  name: 'convey_whatsapp_session_cost_saved_usd_total',
  help: 'Total estimated USD saved by optimizing template messages to session text messages',
  labelNames: ['providerId'],
  registers: [metricsRegistry],
});

const app = new Elysia()
  .use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-api-key',
        'traceparent',
        'x-convey-sandbox',
        'x-convey-environment',
      ],
    }),
  )
  .use(httpMetrics.instrument)
  .derive(({ request }) => ({
    traceCtx: TraceContext.extractOrCreate({ traceparent: request.headers.get('traceparent') || undefined }),
  }))
  .get('/health', { detail: ObservabilityDocs.health }, async () => {
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
  .get('/health/readiness', { detail: ObservabilityDocs.readiness }, async () => {
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
  .get('/health/liveness', { detail: ObservabilityDocs.liveness }, () => {
    return new Response(
      JSON.stringify({
        status: 'alive',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  })
  .get('/metrics', { detail: ObservabilityDocs.metrics }, async () => {
    await refreshOperationalMetrics();
    const metrics = await metricsRegistry.metrics();
    return new Response(metrics, {
      status: 200,
      headers: { 'Content-Type': metricsRegistry.contentType },
    });
  })
  .get('/v1/auth/session', async ({ headers }) => {
    const auth = await verifyApiAuth(headers);
    return (
      auth.errorResponse ||
      Response.json({
        tenantId: auth.tenantId,
        team: auth.team,
        keyName: auth.keyName,
        role: auth.role,
        scope: auth.scope,
        isSandbox: auth.isSandbox,
      })
    );
  })
  .use(messagingController)
  .use(adminController)
  .use(webhooksController)
  .use(dlqController)
  .use(sandboxController)
  .use(suppressionsController)
  .use(templatesController)
  .use(webhookSubscriptionsController)
  .use(batchesController)
  .use(
    openapi({
      path: '/swagger',
      documentation: {
        info: OpenAPIInfo,
        servers: OpenAPIServers,
        tags: OpenAPITags,
        components: {
          schemas: OpenAPIComponentsSchemas,
          securitySchemes: OpenAPISecuritySchemes,
        },
      },
    }),
  );

if (env.NODE_ENV !== 'test' && import.meta.main) {
  shutdownOrchestrator.registerSignalListeners();
  bootstrapService()
    .then(() => {
      app.listen({ port: env.PORT, hostname: '0.0.0.0', reusePort: true });
      logger.info('Server', `🚀 Convey Service is running at http://localhost:${env.PORT}`);
      logger.info('Server', `📚 OpenAPI Documentation available at http://localhost:${env.PORT}/swagger`);
    })
    .catch((err) => {
      logger.error('Bootstrap', 'Fatal error during Convey Service bootstrap', { error: err.message });
      process.exit(1);
    });
}

export { app };
