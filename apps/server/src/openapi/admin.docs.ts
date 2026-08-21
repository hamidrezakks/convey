import { CommonHeaders, StandardSecurityRequirement } from './openapi.docs';

export const AdminDocs = {
  overview: {
    tags: ['Admin & Mission Control'],
    summary: 'Get Platform System Overview KPIs',
    description:
      'Retrieves 24-hour total volume, delivery success rates, channel breakdown, and p95 latency percentiles.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'System overview summary and KPIs',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                metrics: { type: 'object' },
                timeseries: { type: 'array', items: { type: 'object' } },
                channelDistribution: { type: 'object' },
              },
            },
          },
        },
      },
    },
  },

  telemetryLive: {
    tags: ['Admin & Mission Control'],
    summary: 'Get Real-Time Engine Telemetry Snapshot',
    description:
      'Fetches real-time V8 heap memory usage, event-loop lag, active BullMQ queue depths, and worker counts.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Live engine telemetry metrics',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                heapUsedMb: { type: 'number', example: 84.5 },
                eventLoopLagMs: { type: 'number', example: 1.2 },
                queues: { type: 'object' },
                trafficGovernor: { type: 'object' },
              },
            },
          },
        },
      },
    },
  },

  messagesExplorer: {
    tags: ['Admin & Mission Control'],
    summary: 'Messages Explorer Query',
    description:
      'Search and inspect message records across teams, channels, states, date ranges, and full-text keywords.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    parameters: [
      { name: 'teamId', in: 'query', required: false, schema: { type: 'string', example: 'payments' } },
      { name: 'channel', in: 'query', required: false, schema: { type: 'string', example: 'sms' } },
      { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'delivered' } },
      { name: 'search', in: 'query', required: false, schema: { type: 'string', example: 'ORD-10928' } },
      { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 20 } },
    ],
    responses: {
      '200': {
        description: 'Paginated message records',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                total: { type: 'integer', example: 150 },
                messages: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
  },

  messageDetails: {
    tags: ['Admin & Mission Control'],
    summary: 'Get Message Details & Execution Waterfall',
    description: 'Retrieves complete message record, attempts history, and W3C distributed trace execution spans.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Message public ULID ID',
        schema: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
      },
    ],
    responses: {
      '200': {
        description: 'Message details and trace waterfall',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'object' },
                attempts: { type: 'array', items: { type: 'object' } },
                trace: { $ref: '#/components/schemas/DeliveryTraceResponse' },
              },
            },
          },
        },
      },
      '404': { description: 'Message not found' },
    },
  },

  auditLogs: {
    tags: ['Admin & Mission Control'],
    summary: 'List Immutable Administrative Audit Logs',
    description: 'Queries immutable security and operational audit trail records.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Audit log entries',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                total: { type: 'integer', example: 25 },
                logs: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
  },

  providersList: {
    tags: ['Admin & Mission Control'],
    summary: 'List Provider Matrix & Circuit Breaker Cockpit',
    description:
      'Lists all 80+ supported providers with live circuit breaker states, failure counts, and latency scores.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Provider matrix with circuit breaker states',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                providers: { type: 'array', items: { type: 'object' } },
                circuitBreakers: { type: 'object' },
              },
            },
          },
        },
      },
    },
  },

  circuitOverride: {
    tags: ['Admin & Mission Control'],
    summary: 'Manual Provider Circuit Breaker Override',
    description:
      'Manually force-closes, force-opens, or half-opens a provider circuit breaker with traffic ramp throttling.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    parameters: [{ name: 'providerId', in: 'path', required: true, schema: { type: 'string', example: 'twilio' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['CLOSE', 'FORCE_OPEN', 'FORCE_HALF_OPEN'], example: 'FORCE_HALF_OPEN' },
              rampPercentage: { type: 'number', example: 20 },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Circuit breaker state successfully updated' },
    },
  },

  canaryProbe: {
    tags: ['Admin & Mission Control'],
    summary: 'Trigger Synthetic Provider Canary Probe',
    description: 'Executes an immediate background synthetic probe to evaluate provider upstream health and latency.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    parameters: [{ name: 'providerId', in: 'path', required: true, schema: { type: 'string', example: 'twilio' } }],
    responses: {
      '200': { description: 'Canary probe result summary' },
    },
  },

  dlqReplay: {
    tags: ['Admin & Mission Control'],
    summary: 'Admin DLQ Replay Simulator',
    description: 'Executes or simulates (dry-run) replaying failed messages from the DLQ.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              dryRun: { type: 'boolean', default: false, example: true },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'DLQ replay summary' },
    },
  },

  suppressionsList: {
    tags: ['Admin & Mission Control'],
    summary: 'Admin List Suppressions',
    description: 'List all global and team-specific suppression records.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': { description: 'Suppression records list' },
    },
  },

  suppressionsAdd: {
    tags: ['Admin & Mission Control'],
    summary: 'Admin Add Manual Suppression',
    description: 'Manually blocks a recipient from receiving dispatches.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              teamId: { type: 'string', example: 'payments' },
              recipient: { type: 'string', example: 'blocked_user@example.com' },
              channel: { type: 'string', example: 'EMAIL' },
              reason: { type: 'string', example: 'MANUAL_BLOCK' },
            },
            required: ['recipient'],
          },
        },
      },
    },
    responses: {
      '200': { description: 'Suppression created' },
    },
  },

  suppressionsDelete: {
    tags: ['Admin & Mission Control'],
    summary: 'Admin Delete Suppression',
    description: 'Deletes a suppression record.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'supp_123' } }],
    responses: {
      '200': { description: 'Suppression deleted' },
    },
  },

  policiesList: {
    tags: ['Admin & Mission Control'],
    summary: 'List Rate-Limiting & Budget Policies',
    description: 'Retrieves all rate-limiting, budget caps, and multi-tenant quotas.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': { description: 'Active policy rules' },
    },
  },

  composerSendTest: {
    tags: ['Admin & Mission Control'],
    summary: 'Omnichannel Composer Live Test Send',
    description: 'Dispatches a test message from the Mission Control composer sandbox.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': { description: 'Test message dispatch result' },
    },
  },

  providersCatalog: {
    tags: ['Admin & Mission Control'],
    summary: 'Get Master 80+ Provider Catalog',
    description:
      'Retrieves metadata, required environment variables, supported channels, and schemas for all 80+ supported providers.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': { description: 'Complete provider catalog list' },
    },
  },

  providersConfigured: {
    tags: ['Admin & Mission Control'],
    summary: 'List Configured Provider Credentials',
    description: 'Lists all active configured providers from database and in-memory cache.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': { description: 'List of configured provider records' },
    },
  },

  providersRegister: {
    tags: ['Admin & Mission Control'],
    summary: 'Register or Update Provider Configuration',
    description:
      'Registers new provider credentials and configuration in PostgreSQL with instant Redis PubSub zero-downtime hot-reloading.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              providerId: { type: 'string', example: 'twilio' },
              channel: { type: 'string', example: 'sms' },
              baseCurrency: {
                type: 'string',
                example: 'USD',
                description: 'ISO-4217 Provider native billing currency (e.g. USD, EUR, AED, GBP)',
              },
              credentials: {
                type: 'object',
                example: { accountSid: 'ACxxx', authToken: 'authxxx', from: '+14155550100' },
              },
              isPrimary: { type: 'boolean', example: true },
              priority: { type: 'integer', example: 1 },
              weight: { type: 'integer', example: 100 },
            },
            required: ['providerId', 'channel', 'credentials'],
          },
        },
      },
    },
    responses: {
      '200': { description: 'Provider successfully registered and hot-reloaded' },
    },
  },

  providersDeleteConfigured: {
    tags: ['Admin & Mission Control'],
    summary: 'Delete Configured Provider',
    description: 'Removes a configured provider record.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'prov_config_123' } }],
    responses: {
      '200': { description: 'Provider configuration deleted' },
    },
  },

  providersTestConnection: {
    tags: ['Admin & Mission Control'],
    summary: 'Test Provider Credentials Connection',
    description: 'Validates API keys and credentials directly against upstream vendor endpoint.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              providerId: { type: 'string', example: 'twilio' },
              credentials: { type: 'object', example: { accountSid: 'ACxxx', authToken: 'authxxx' } },
            },
            required: ['providerId', 'credentials'],
          },
        },
      },
    },
    responses: {
      '200': { description: 'Connection test result' },
    },
  },

  providersSeedAll: {
    tags: ['Admin & Mission Control'],
    summary: 'Seed All 80+ Providers with Test Config',
    description: 'Pre-populates all 80+ supported providers with local mock credentials.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': { description: 'All providers seeded' },
    },
  },

  providersEnvExport: {
    tags: ['Admin & Mission Control'],
    summary: 'Export Provider Environment Variables',
    description: 'Exports sample .env formatted environment variable templates for all providers.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': { description: 'Exported environment variables' },
    },
  },
};
