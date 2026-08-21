export const ObservabilityDocs = {
  health: {
    tags: ['Health & Observability'],
    summary: 'Comprehensive Health Check & Subsystem Status',
    description:
      'Evaluates PostgreSQL connectivity, Redis cluster ping, monthly partition readiness, active circuit breaker counts, and configured provider tally.',
    responses: {
      '200': {
        description: 'System healthy and ready to process traffic',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HealthCheckResponse' },
          },
        },
      },
      '503': {
        description: 'System degraded (database/Redis disconnected or bootstrapping in progress)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HealthCheckResponse' },
          },
        },
      },
    },
  },

  readiness: {
    tags: ['Health & Observability'],
    summary: 'Kubernetes Readiness Probe',
    description:
      'Returns HTTP 200 when all worker loops, database partitions, and provider registries are initialized.',
    responses: {
      '200': { description: 'Container ready to receive ingress traffic' },
      '503': { description: 'Container initializing or during graceful shutdown' },
    },
  },

  liveness: {
    tags: ['Health & Observability'],
    summary: 'Kubernetes Liveness Probe',
    description: 'Returns HTTP 200 indicating process is alive and event loop is responsive.',
    responses: {
      '200': { description: 'Process alive' },
    },
  },

  metrics: {
    tags: ['Health & Observability'],
    summary: 'Prometheus Metrics Exposition',
    description: 'Exposes all platform metrics in standard Prometheus text format.',
    responses: {
      '200': {
        description: 'Prometheus metrics text output',
        content: { 'text/plain; version=0.0.4': { schema: { type: 'string' } } },
      },
    },
  },
};
