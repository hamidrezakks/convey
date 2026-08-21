/**
 * Convey Enterprise Communication Service - Master OpenAPI 3.1 Documentation & Specification
 *
 * Provides strongly-typed schemas, security definitions, and comprehensive multi-channel
 * request/response examples across all Convey communication engine endpoints.
 */

export const OpenAPIInfo = {
  title: 'Convey Enterprise Communication Service API',
  version: '1.0.0',
  description: `
## Convey Communication Infrastructure Platform

Convey is a planetary-scale, high-performance omnichannel communication and transactional messaging engine built for sub-15ms synchronous message acceptance.

### Key Architectural Capabilities
- **Sub-15ms Ingestion Fast-Path**: 1 Redis \`SET NX\` + 1 PostgreSQL transactional outbox write.
- **80+ Provider Channel Adapters**: SMS, Email, WhatsApp Business, Push (FCM, APNs, WebPush), Chat (Slack, Telegram, Discord), Viber, and Voice.
- **Automated WhatsApp 24-Hour Cost Optimization Engine**: Intercepts outbound WhatsApp messages to automatically send plain-text session messages at **$0.00 Meta template fee** within active 24-hour customer service windows.
- **Multi-Channel Fallback & Cascades**: Configurable waterfall routing with timeout thresholds and event-based short-circuiting.
- **Range-Partitioned Message Store**: Monthly PostgreSQL partition windows with zero external provider message ID exposure (\`msg_<ULID>\`).
- **Distributed W3C TraceContext**: Full-fidelity \`traceparent\` propagation across HTTP handlers, outbox relays, queue jobs, provider wire calls, and customer webhooks.
- **Deficit Round Robin Multi-Tenant Scheduler**: Fair quantum priority queueing across Enterprise, Pro, and Free tenant tiers.
  `,
  contact: {
    name: 'Convey Platform Engineering Team',
    url: 'https://convey.internal',
    email: 'engineering@convey.internal',
  },
  license: {
    name: 'Proprietary / Enterprise Edition',
    url: 'https://convey.internal/license',
  },
};

export const OpenAPIServers = [
  {
    url: 'http://localhost:3000',
    description: 'Local Development Environment',
  },
  {
    url: 'https://api.convey.internal',
    description: 'Production Multi-Region Cluster',
  },
  {
    url: 'https://sandbox.convey.internal',
    description: 'Isolated Mock Sandbox Simulation Environment',
  },
];

export const OpenAPITags = [
  {
    name: 'Messages',
    description:
      'Omnichannel message ingestion, real-time status lookups, audit timelines, W3C trace waterfalls, and template preview rendering.',
  },
  {
    name: 'Batches',
    description:
      'High-throughput atomic batch campaign contexts, pause/resume controls, and real-time completion analytics.',
  },
  {
    name: 'Dead Letter Queue (DLQ)',
    description: 'Failed message inspection, batch replay, and mutated payload replays with provider/recipient overrides.',
  },
  {
    name: 'Suppressions',
    description:
      'Compliance suppression list management (hard bounces, unsubscribes, spam complaints, and manual blocks).',
  },
  {
    name: 'Webhooks',
    description:
      'Customer outgoing webhook subscriptions, inbound provider delivery receipts, WhatsApp handshakes, and open tracking pixels.',
  },
  {
    name: 'Sandbox',
    description: 'Isolated mock test simulation environment for end-to-end integration testing without external provider fees.',
  },
  {
    name: 'Admin & Mission Control',
    description:
      'Real-time system telemetry, circuit breaker cockpit, 80+ provider registration studio, canary probes, and audit logs.',
  },
  {
    name: 'Health & Observability',
    description: 'Kubernetes health, readiness, and liveness probes, plus Prometheus metric exposition.',
  },
];

export const OpenAPISecuritySchemes = {
  ApiKeyAuth: {
    type: 'apiKey',
    in: 'header',
    name: 'x-api-key',
    description: 'Primary API Key authentication header (e.g., `cv_live_...` or `cv_sandbox_...`).',
  },
  BearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'API_KEY',
    description: 'Bearer token authentication header (`Authorization: Bearer <api_key>`).',
  },
};

export const CommonHeaders = {
  traceparent: {
    description: 'W3C Distributed TraceContext header (e.g. `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`).',
    schema: { type: 'string' },
    required: false,
  },
  'x-convey-sandbox': {
    description: 'Header to force sandbox simulation test mode for the request.',
    schema: { type: 'string', enum: ['true', 'false'] },
    required: false,
  },
  'x-convey-environment': {
    description: 'Explicit tenant environment target (`production` or `sandbox`).',
    schema: { type: 'string', enum: ['production', 'sandbox'] },
    required: false,
  },
};

export const StandardSecurityRequirement = [
  { ApiKeyAuth: [] },
  { BearerAuth: [] },
];

// ============================================================================
// 1. REUSABLE COMPONENT SCHEMAS
// ============================================================================
export const OpenAPIComponentsSchemas = {
  // --- Error Responses ---
  ErrorResponse: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Standardized Convey Error Code',
            enum: [
              'VALIDATION_ERROR',
              'IDEMPOTENCY_CONFLICT',
              'UNAUTHORIZED',
              'FORBIDDEN',
              'NOT_FOUND',
              'RATE_LIMIT_EXCEEDED',
              'SUPPRESSED_RECIPIENT',
              'NO_PROVIDER_CONFIGURED',
              'SERVICE_UNAVAILABLE',
              'SERVER_ERROR',
            ],
            example: 'VALIDATION_ERROR',
          },
          message: {
            type: 'string',
            description: 'Human-readable diagnostic error message',
            example: 'Invalid message request payload',
          },
          details: {
            type: 'array',
            description: 'Detailed validation issue breakdown',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', example: 'recipients.phone' },
                code: { type: 'string', example: 'invalid_string' },
                message: { type: 'string', example: 'Must be a valid E.164 phone number' },
              },
            },
          },
        },
        required: ['code', 'message'],
      },
    },
    required: ['error'],
  },

  // --- Recipient Schema ---
  RecipientSchema: {
    type: 'object',
    description: 'Target recipient contact addresses and device tokens across channels',
    properties: {
      phone: {
        type: 'string',
        description: 'Normalized E.164 phone number for SMS and Voice',
        example: '+971501234567',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Recipient email address',
        example: 'customer@example.com',
      },
      whatsapp: {
        type: 'string',
        description: 'Normalized E.164 phone number for WhatsApp',
        example: '+971501234567',
      },
      telegramChatId: {
        type: 'string',
        description: 'Unique Telegram Chat or User ID',
        example: '123456789',
      },
      slack: {
        type: 'object',
        description: 'Target Slack channel identifier',
        properties: {
          channelId: { type: 'string', example: 'C0123456789' },
        },
      },
      fcmTokens: {
        type: 'array',
        description: 'Google Firebase Cloud Messaging device registration tokens',
        items: { type: 'string' },
        example: ['fcm_token_device_abc123xyz8877_alpha'],
      },
      apnsTokens: {
        type: 'array',
        description: 'Apple Push Notification service device hex tokens',
        items: { type: 'string' },
        example: ['apns_token_hex_device_64char_identifier_abc123'],
      },
    },
  },

  // --- Channel Schemas ---
  SmsChannelContent: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Plain text SMS message body', example: 'Your verification code is 432109.' },
    },
    required: ['text'],
  },

  EmailChannelContent: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Email subject line', example: 'Order Confirmation #ORD-10928' },
      html: { type: 'string', description: 'Rendered HTML email body', example: '<h2>Thank you for your order!</h2>' },
      text: { type: 'string', description: 'Plain text email body fallback', example: 'Thank you for your order!' },
      render: {
        type: 'object',
        description: 'Dynamic server-side template rendering specification',
        properties: {
          template: { type: 'string', example: 'shipping_status_update' },
          version: { type: 'string', example: 'v2.1' },
          locale: { type: 'string', example: 'en' },
          props: { type: 'object', example: { trackingNumber: 'TRK998811', carrier: 'DHL' } },
        },
        required: ['template'],
      },
    },
    required: ['subject'],
  },

  WhatsAppChannelContent: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Plain text session message (used when 24h interactive window is active)',
        example: 'Hello! Your support ticket #TK-482 has been resolved.',
      },
      template: {
        type: 'string',
        description: 'Pre-approved WhatsApp Business template name',
        example: 'order_dispatched',
      },
      language: {
        type: 'string',
        description: 'Template language code',
        example: 'en',
      },
      variables: {
        type: 'object',
        description: 'Key-value dictionary of template placeholders',
        example: { customer_name: 'Ahmed', order_id: 'ORD-10928', eta_minutes: '30' },
      },
    },
  },

  FcmChannelContent: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Notification title', example: 'Transfer Received 💰' },
      body: { type: 'string', description: 'Notification alert text', example: 'You received $150.00 from Jane Doe.' },
      data: { type: 'object', description: 'Custom key-value data dictionary', example: { transactionId: 'tx_998811' } },
    },
    required: ['title', 'body'],
  },

  ApnsChannelContent: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Notification title', example: 'New Team Invite' },
      body: { type: 'string', description: 'Notification body text', example: 'Sarah invited you to Project Phoenix.' },
      badge: { type: 'integer', description: 'iOS application badge count', example: 3 },
      sound: { type: 'string', description: 'Custom bundle sound file name', example: 'chime.aiff' },
      data: { type: 'object', description: 'Custom user dictionary', example: { inviteId: 'inv_776655' } },
    },
    required: ['title', 'body'],
  },

  SlackChannelContent: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Slack fallback mrkdwn text', example: '🚨 High Latency Warning' },
      blocks: { type: 'array', description: 'Slack Block Kit components array', items: { type: 'object' } },
    },
    required: ['text'],
  },

  TelegramChannelContent: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Telegram message text', example: '🔔 *Crypto Price Alert*\n*BTC* crossed *$105,000*' },
      parseMode: { type: 'string', enum: ['HTML', 'MarkdownV2'], example: 'HTML' },
    },
    required: ['text'],
  },

  ChannelRequest: {
    type: 'object',
    description: 'Polymorphic channel payload specification',
    properties: {
      channel: {
        type: 'string',
        enum: ['sms', 'email', 'whatsapp', 'fcm', 'apns', 'slack', 'telegram', 'chat', 'push', 'tool'],
        example: 'sms',
      },
      provider: {
        type: 'string',
        description: 'Optional explicit provider override (e.g. twilio, sendgrid, resend, cequens)',
        example: 'twilio',
      },
      content: {
        type: 'object',
        description: 'Channel-specific content payload',
      },
    },
    required: ['channel', 'content'],
  },

  // --- Fallback & Cascade Rules ---
  FallbackConfig: {
    type: 'object',
    description: 'Waterfall fallback rules triggered upon delivery failure or timeout',
    properties: {
      rules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            when: {
              type: 'object',
              properties: {
                channel: { type: 'string', example: 'whatsapp' },
                event: { type: 'string', enum: ['failed', 'not_delivered', 'not_read'], example: 'failed' },
                afterSeconds: { type: 'number', description: 'Wait window before triggering fallback', example: 120 },
              },
              required: ['channel', 'event'],
            },
            send: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  channel: { type: 'string', example: 'sms' },
                  content: { type: 'object' },
                },
                required: ['channel'],
              },
            },
          },
          required: ['when', 'send'],
        },
      },
    },
    required: ['rules'],
  },

  CascadeConfig: {
    type: 'object',
    description: 'Timed multi-channel progressive escalation cascade',
    properties: {
      enabled: { type: 'boolean', example: true },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            channel: { type: 'string', example: 'whatsapp' },
            providerId: { type: 'string', example: 'whatsapp-business' },
            waitForReceiptMs: { type: 'number', example: 60000 },
            condition: { type: 'string', enum: ['if_unopened', 'if_undelivered', 'always'], example: 'if_undelivered' },
          },
          required: ['channel'],
        },
      },
      cancelOnEvent: {
        type: 'array',
        items: { type: 'string', enum: ['DELIVERED', 'OPENED', 'CLICKED', 'CONVERTED'] },
        example: ['DELIVERED', 'OPENED'],
      },
    },
    required: ['steps'],
  },

  // --- Master Ingestion Request Schema ---
  SendMessageRequest: {
    type: 'object',
    description: 'Master omnichannel message ingestion request schema',
    properties: {
      idempotencyKey: {
        type: 'string',
        description: 'Unique client-provided idempotency key for exactly-once delivery guarantees',
        example: 'order_conf_10928',
      },
      userId: {
        type: 'string',
        description: 'Target end-user identifier in tenant application',
        example: 'usr_99182',
      },
      team: {
        type: 'string',
        description: 'Tenant team boundary identifier',
        example: 'payments',
      },
      category: {
        type: 'string',
        description: 'Message category for rate-limiting, policies, and suppression scoping',
        example: 'transactional',
      },
      country: {
        type: 'string',
        description: 'Two-letter ISO 3166-1 alpha-2 country code',
        example: 'AE',
      },
      priority: {
        type: 'string',
        description: 'Queue scheduling priority level',
        enum: ['critical', 'transactional', 'normal', 'marketing'],
        default: 'normal',
        example: 'transactional',
      },
      scheduledAt: {
        type: 'string',
        format: 'date-time',
        description: 'ISO 8601 future timestamp for deferred execution',
        example: '2026-08-25T15:00:00.000Z',
      },
      expiresAt: {
        type: 'string',
        format: 'date-time',
        description: 'ISO 8601 expiry timestamp after which message must not be dispatched',
        example: '2026-08-25T18:00:00.000Z',
      },
      isSandbox: {
        type: 'boolean',
        description: 'Set to true for isolated mock delivery testing without external provider costs',
        default: false,
        example: false,
      },
      recipients: {
        $ref: '#/components/schemas/RecipientSchema',
      },
      channels: {
        type: 'array',
        description: 'List of target delivery channels and contents',
        items: { $ref: '#/components/schemas/ChannelRequest' },
      },
      fallback: {
        $ref: '#/components/schemas/FallbackConfig',
      },
      cascade: {
        $ref: '#/components/schemas/CascadeConfig',
      },
      metadata: {
        type: 'object',
        description: 'Arbitrary tenant metadata dictionary preserved across lifecycles and webhooks',
        example: { orderId: 'ORD-10928', customerTier: 'gold' },
      },
    },
    required: ['idempotencyKey', 'userId', 'team', 'category', 'country', 'recipients', 'channels'],
  },

  // --- Bulk Ingestion Request Schema ---
  BulkSendMessageRequest: {
    type: 'object',
    description: 'High-throughput bulk message ingestion payload (up to 500 items per request)',
    properties: {
      messages: {
        type: 'array',
        items: { $ref: '#/components/schemas/SendMessageRequest' },
      },
    },
    required: ['messages'],
  },

  // --- Message Ingestion Response Schemas ---
  SendMessageAcceptedResponse: {
    type: 'object',
    description: 'Asynchronous message acceptance response returned within < 15ms',
    properties: {
      messageId: {
        type: 'string',
        description: 'Opaque public ULID message identifier (`msg_<ULID>`)',
        example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3',
      },
      state: {
        type: 'string',
        description: 'Initial lifecycle state of the message in the outbox pipeline',
        enum: ['accepted', 'scheduled'],
        example: 'accepted',
      },
      acceptedAt: {
        type: 'string',
        format: 'date-time',
        description: 'ISO 8601 timestamp when message was accepted into transactional outbox',
        example: '2026-08-21T10:00:00.000Z',
      },
      isSandbox: {
        type: 'boolean',
        description: 'Indicates whether message was ingested in sandbox test mode',
        example: false,
      },
    },
    required: ['messageId', 'state'],
  },

  BulkSendMessageAcceptedResponse: {
    type: 'object',
    description: 'Bulk ingestion acceptance response summary',
    properties: {
      total: { type: 'integer', description: 'Total number of items processed in the batch', example: 2 },
      items: {
        type: 'array',
        description: 'Per-item acceptance results matching input indices',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', example: 0 },
            statusCode: { type: 'integer', example: 202 },
            body: { $ref: '#/components/schemas/SendMessageAcceptedResponse' },
          },
          required: ['index', 'statusCode', 'body'],
        },
      },
    },
    required: ['total', 'items'],
  },

  // --- Message Status & Timeline Schemas ---
  MessageStatusResponse: {
    type: 'object',
    description: 'Real-time aggregate delivery status and per-channel attempt metrics',
    properties: {
      messageId: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
      state: {
        type: 'string',
        enum: ['accepted', 'scheduled', 'dispatched', 'delivered', 'failed', 'expired', 'cancelled', 'opened', 'read', 'bounced'],
        example: 'delivered',
      },
      userId: { type: 'string', example: 'usr_99182' },
      team: { type: 'string', example: 'payments' },
      category: { type: 'string', example: 'transactional' },
      country: { type: 'string', example: 'AE' },
      createdAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:00.000Z' },
      completedAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:01.250Z' },
      channels: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            channel: { type: 'string', example: 'whatsapp' },
            state: { type: 'string', example: 'delivered' },
            provider: { type: 'string', example: 'whatsapp-business' },
            attempts: { type: 'integer', example: 1 },
            deliveredAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:01.250Z' },
          },
        },
      },
      timeline: {
        type: 'array',
        description: 'Optional chronological lifecycle events (included when ?include=timeline)',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'delivery.delivered' },
            providerId: { type: 'string', example: 'whatsapp-business' },
            occurredAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:01.250Z' },
          },
        },
      },
    },
    required: ['messageId', 'state'],
  },

  DeliveryTraceResponse: {
    type: 'object',
    description: 'End-to-end W3C distributed trace waterfall and APM hop evaluation',
    properties: {
      messageId: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
      state: { type: 'string', example: 'delivered' },
      team: { type: 'string', example: 'payments' },
      category: { type: 'string', example: 'transactional' },
      totalDurationMs: { type: 'number', description: 'Total end-to-end delivery latency in milliseconds', example: 342.5 },
      summary: {
        type: 'object',
        properties: {
          ingestedAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:00.000Z' },
          completedAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:00.342Z' },
          deliveredAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:00.342Z' },
          chosenProvider: { type: 'string', example: 'twilio' },
          costUsd: { type: 'number', example: 0.0075 },
          attemptsCount: { type: 'integer', example: 1 },
        },
      },
      waterfall: {
        type: 'array',
        description: 'Chronological execution spans across ingestion, outbox, routing, and provider dispatch',
        items: {
          type: 'object',
          properties: {
            spanId: { type: 'string', example: 'span_01' },
            name: { type: 'string', example: 'http.ingest' },
            status: { type: 'string', enum: ['OK', 'FAILED', 'SKIPPED'], example: 'OK' },
            startOffsetMs: { type: 'number', example: 0 },
            durationMs: { type: 'number', example: 4.2 },
            details: { type: 'object' },
          },
        },
      },
    },
    required: ['messageId', 'state', 'totalDurationMs', 'summary', 'waterfall'],
  },

  // --- Batches Schemas ---
  BatchCreateRequest: {
    type: 'object',
    properties: {
      totalCount: { type: 'integer', minimum: 1, description: 'Total expected items in bulk campaign', example: 10000 },
      metadata: { type: 'object', description: 'Custom batch labels and campaign tags', example: { campaignName: 'Q3 Blast' } },
    },
    required: ['totalCount'],
  },

  BatchResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      batch: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Public batch identifier (`batch_<ULID>`)', example: 'batch_01J0N88XYZ...' },
          status: { type: 'string', enum: ['processing', 'completed', 'paused', 'cancelled', 'failed'], example: 'processing' },
          totalCount: { type: 'integer', example: 10000 },
          processedCount: { type: 'integer', example: 4500 },
          successCount: { type: 'integer', example: 4450 },
          failedCount: { type: 'integer', example: 50 },
          progressPercent: { type: 'number', example: 45.0 },
          throughputPerSec: { type: 'number', example: 850.2 },
          estimatedTimeRemainingSec: { type: 'number', example: 6.4 },
        },
        required: ['id', 'status', 'totalCount'],
      },
    },
    required: ['success', 'batch'],
  },

  // --- DLQ Schemas ---
  DlqReplayRequest: {
    type: 'object',
    properties: {
      messageIds: {
        type: 'array',
        description: 'Array of failed message ULIDs to reset and replay into outbox',
        items: { type: 'string' },
        example: ['msg_01J0N7C0W7X2R6S8V9Q9B1E4G3'],
      },
    },
    required: ['messageIds'],
  },

  DlqMutatedReplayRequest: {
    type: 'object',
    properties: {
      messageIds: { type: 'array', items: { type: 'string' }, example: ['msg_01J0N7C0W7X2R6S8V9Q9B1E4G3'] },
      mutations: {
        type: 'object',
        description: 'Modifications to apply prior to replay',
        properties: {
          recipients: { $ref: '#/components/schemas/RecipientSchema' },
          channels: { type: 'array', items: { $ref: '#/components/schemas/ChannelRequest' } },
          metadata: { type: 'object' },
        },
      },
      isSandbox: { type: 'boolean', default: false },
      dryRun: { type: 'boolean', default: false },
    },
    required: ['messageIds'],
  },

  // --- Suppressions Schemas ---
  SuppressionRecord: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'supp_01J0N...' },
      team: { type: 'string', example: 'payments' },
      identifier: { type: 'string', example: 'unsubscribed_user@example.com' },
      identifierType: { type: 'string', enum: ['email', 'phone', 'whatsapp', 'push', 'user_id'], example: 'email' },
      reason: { type: 'string', enum: ['HARD_BOUNCE', 'SPAM_COMPLAINT', 'UNSUBSCRIBE', 'MANUAL_BLOCK'], example: 'UNSUBSCRIBE' },
      channel: { type: 'string', example: 'email' },
      category: { type: 'string', example: 'marketing' },
      createdAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:00.000Z' },
    },
    required: ['id', 'identifier', 'reason'],
  },

  // --- Webhook Subscriptions Schemas ---
  WebhookSubscription: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'sub_01J0N...' },
      tenantId: { type: 'string', example: 'ten_default' },
      team: { type: 'string', example: 'payments' },
      url: { type: 'string', format: 'uri', example: 'https://api.merchant.com/webhooks/convey' },
      events: {
        type: 'array',
        items: { type: 'string' },
        example: ['message.delivered', 'message.failed', 'message.opened', 'message.read'],
      },
      secret: { type: 'string', description: 'HMAC-SHA256 signing secret for payload verification', example: 'whsec_9812739...' },
      createdAt: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:00.000Z' },
    },
    required: ['id', 'url', 'events'],
  },

  // --- Observability Schemas ---
  HealthCheckResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
      ready: { type: 'boolean', example: true },
      uptime: { type: 'number', example: 86400.25 },
      db: { type: 'string', enum: ['connected', 'disconnected', 'error'], example: 'connected' },
      redis: { type: 'string', enum: ['connected', 'disconnected', 'error'], example: 'connected' },
      partitions: { type: 'string', example: 'ready' },
      circuitBreakers: {
        type: 'object',
        properties: {
          closed: { type: 'integer', example: 88 },
          open: { type: 'integer', example: 0 },
          halfOpen: { type: 'integer', example: 0 },
        },
      },
      configuredProvidersCount: { type: 'integer', example: 88 },
      timestamp: { type: 'string', format: 'date-time', example: '2026-08-21T10:00:00.000Z' },
    },
    required: ['status', 'ready', 'uptime', 'db', 'redis', 'timestamp'],
  },
};

// ============================================================================
// 2. EXHAUSTIVE MULTI-CHANNEL REQUEST EXAMPLES
// ============================================================================
export const MessageRequestExamples = {
  sms_otp: {
    summary: '1. SMS OTP Security Code',
    description: 'Dispatches an urgent one-time authentication code with E.164 phone normalization.',
    value: {
      idempotencyKey: 'idemp_sms_otp_99182',
      userId: 'usr_88219',
      team: 'payments',
      category: 'otp',
      country: 'AE',
      priority: 'critical',
      recipients: { phone: '+971501234567' },
      channels: [
        {
          channel: 'sms',
          content: { text: 'Your Convey verification security code is 432109. Valid for 5 minutes. Do not share this code.' },
        },
      ],
      metadata: { authFlow: '2fa_challenge', clientIp: '192.0.2.1' },
    },
  },

  email_html_receipt: {
    summary: '2. Email Direct HTML & Plaintext Receipt',
    description: 'Dispatches a transactional tax invoice containing rich styled HTML with plaintext fallback.',
    value: {
      idempotencyKey: 'idemp_email_receipt_77123',
      userId: 'usr_88219',
      team: 'orders',
      category: 'transactional',
      country: 'US',
      priority: 'transactional',
      recipients: { email: 'buyer@example.com' },
      channels: [
        {
          channel: 'email',
          content: {
            subject: 'Tax Invoice for Order #ORD-8877',
            html: '<div style="font-family: sans-serif;"><h2>Thank you for your order!</h2><p>Your payment of <strong>$49.99 USD</strong> has been approved.</p><hr/><p>Order ID: <code>ORD-8877</code></p></div>',
            text: 'Thank you for your order! Your payment of $49.99 USD for Order #ORD-8877 has been approved.',
          },
        },
      ],
      metadata: { orderId: 'ORD-8877', totalAmount: 49.99, currency: 'USD' },
    },
  },

  email_template_shipping: {
    summary: '3. Email Dynamic Template Engine Rendering',
    description: 'Renders dynamic localized template variables on server-side before dispatch.',
    value: {
      idempotencyKey: 'idemp_email_tmpl_66543',
      userId: 'usr_buyer_04',
      team: 'fulfillment',
      category: 'transactional',
      country: 'AE',
      recipients: { email: 'ahmed.customer@domain.ae' },
      channels: [
        {
          channel: 'email',
          content: {
            subject: 'Your package is out for delivery! 📦',
            render: {
              template: 'shipping_status_update',
              version: 'v2.1',
              locale: 'en',
              props: {
                recipientName: 'Ahmed',
                trackingNumber: 'CONVEY-TRK-998811',
                carrier: 'DHL Express',
                estimatedDeliveryTime: 'Today between 2:00 PM - 5:00 PM',
                trackingUrl: 'https://track.carrier.com/CONVEY-TRK-998811',
              },
            },
          },
        },
      ],
    },
  },

  whatsapp_utility_template: {
    summary: '4. WhatsApp Business Utility Template',
    description: 'Dispatches pre-approved Meta WhatsApp utility template with dynamic placeholder arguments.',
    value: {
      idempotencyKey: 'idemp_wa_tmpl_55432',
      userId: 'usr_99182',
      team: 'logistics',
      category: 'transactional',
      country: 'AE',
      recipients: { whatsapp: '+971501234567' },
      channels: [
        {
          channel: 'whatsapp',
          content: {
            template: 'order_dispatched',
            language: 'en',
            variables: {
              customer_name: 'Ahmed',
              order_id: 'ORD-10928',
              eta_minutes: '30',
            },
          },
        },
      ],
    },
  },

  whatsapp_session_text: {
    summary: '5. WhatsApp 24h Interactive Session ($0.00 Meta Fee)',
    description: 'Zero-cost freeform customer support message utilizing active 24-hour service window.',
    value: {
      idempotencyKey: 'idemp_wa_session_44321',
      userId: 'usr_support_99',
      team: 'support',
      category: 'transactional',
      country: 'AE',
      recipients: { whatsapp: '+971501234567' },
      channels: [
        {
          channel: 'whatsapp',
          content: {
            text: 'Hello Ahmed! Your support ticket #TK-482 has been updated. Our agent is on the line: how can we assist you today?',
          },
        },
      ],
    },
  },

  push_fcm_mobile: {
    summary: '6. Mobile Push Notification (Google FCM)',
    description: 'Dispatches high-priority Firebase push notification with rich data payload.',
    value: {
      idempotencyKey: 'idemp_fcm_push_33210',
      userId: 'usr_mobile_01',
      team: 'fintech',
      category: 'notification',
      country: 'US',
      priority: 'critical',
      recipients: { fcmTokens: ['fcm_token_device_abc123xyz8877_alpha_bravo'] },
      channels: [
        {
          channel: 'fcm',
          content: {
            title: 'Instant Transfer Received 💰',
            body: 'You received $150.00 USD from Jane Doe.',
            data: {
              transactionId: 'tx_99881122',
              action: 'OPEN_WALLET',
              accountRef: 'acc_priv_4410',
            },
          },
        },
      ],
    },
  },

  push_apns_ios: {
    summary: '7. Apple Push Notification (APNs iOS)',
    description: 'Dispatches native iOS push notification with badge counter and bundle chime sound.',
    value: {
      idempotencyKey: 'idemp_apns_push_22109',
      userId: 'usr_ios_02',
      team: 'social',
      category: 'notification',
      country: 'US',
      recipients: { apnsTokens: ['apns_token_hex_device_64char_identifier_abc123'] },
      channels: [
        {
          channel: 'apns',
          content: {
            title: 'New Team Invite',
            body: 'Sarah invited you to collaborate on Project Phoenix.',
            badge: 3,
            sound: 'chime.aiff',
            data: { inviteId: 'inv_776655', teamSlug: 'phoenix-eng' },
          },
        },
      ],
    },
  },

  slack_incident_alert: {
    summary: '8. Slack Channel Broadcast & Block Kit',
    description: 'Broadcasts rich markdown alert card to internal Slack operations channel.',
    value: {
      idempotencyKey: 'idemp_slack_alert_11098',
      userId: 'usr_devops_01',
      team: 'infra',
      category: 'alerts',
      country: 'US',
      recipients: { slack: { channelId: 'C0123456789' } },
      channels: [
        {
          channel: 'slack',
          content: {
            text: '🚨 *P1 Alert*: Elevated payment gateway latency detected (p99 > 850ms). Autoscaling triggered.',
            blocks: [
              {
                type: 'section',
                text: { type: 'mrkdwn', text: '🚨 *P1 Alert: High Latency Warning*\nProvider: `Stripe / Checkout`\nCurrent p99: `892ms`\nThreshold: `500ms`' },
              },
            ],
          },
        },
      ],
    },
  },

  telegram_bot_otp: {
    summary: '9. Telegram Bot Notification',
    description: 'Sends markdown-formatted alert directly to user Telegram chat ID.',
    value: {
      idempotencyKey: 'idemp_tg_alert_00987',
      userId: 'usr_tg_01',
      team: 'trading',
      category: 'alerts',
      country: 'AE',
      recipients: { telegramChatId: '123456789' },
      channels: [
        {
          channel: 'telegram',
          content: {
            text: '🔔 *Crypto Price Alert*\n*BTC/USDT* has crossed *$105,000* (+4.2% in 1h).',
            parseMode: 'HTML',
          },
        },
      ],
    },
  },

  multichannel_fallback_cascade: {
    summary: '10. Multi-Channel Fallback & Cascade Waterfall',
    description: 'Attempts WhatsApp primary delivery, automatically falling back to SMS upon failure/timeout.',
    value: {
      idempotencyKey: 'idemp_cascade_99887',
      userId: 'usr_multi_01',
      team: 'payments',
      category: 'transactional',
      country: 'AE',
      recipients: {
        whatsapp: '+971501234567',
        phone: '+971501234567',
        email: 'customer@acme.com',
      },
      channels: [
        {
          channel: 'whatsapp',
          content: { text: 'Your flight EK201 check-in is now open. Confirm your seat now.' },
        },
      ],
      fallback: {
        rules: [
          {
            when: { channel: 'whatsapp', event: 'failed', afterSeconds: 120 },
            send: [{ channel: 'sms', content: { text: 'Flight EK201 check-in open. Visit bit.ly/ek201 to check in.' } }],
          },
          {
            when: { channel: 'sms', event: 'failed' },
            send: [{ channel: 'email', content: { subject: 'Flight EK201 Check-In Open', text: 'Please complete your check-in online.' } }],
          },
        ],
      },
    },
  },

  scheduled_campaign_delivery: {
    summary: '11. Long-Term Scheduled Future Delivery (>30m)',
    description: 'Schedules campaign message for future date stored in PostgreSQL and promoted by worker.',
    value: {
      idempotencyKey: 'idemp_sched_88776',
      userId: 'usr_sched_01',
      team: 'marketing',
      category: 'marketing',
      country: 'US',
      scheduledAt: '2026-08-25T15:00:00.000Z',
      expiresAt: '2026-08-25T18:00:00.000Z',
      recipients: { email: 'vip_subscriber@example.com' },
      channels: [
        {
          channel: 'email',
          content: { subject: 'Exclusive VIP Early Access Starts Now!', text: 'Shop the VIP collection before anyone else.' },
        },
      ],
    },
  },

  sandbox_test_dispatch: {
    summary: '12. Zero-Cost Mock Sandbox Simulation',
    description: 'Dispatches simulated message for end-to-end integration testing without calling external vendor APIs.',
    value: {
      idempotencyKey: 'idemp_sandbox_77665',
      userId: 'usr_sandbox_01',
      team: 'payments',
      category: 'otp',
      country: 'AE',
      isSandbox: true,
      recipients: { phone: '+971500000001' },
      channels: [
        {
          channel: 'sms',
          content: { text: 'Sandbox Mock Dispatch Test OTP 999111' },
        },
      ],
    },
  },
};

// ============================================================================
// 3. COMPREHENSIVE RESPONSE EXAMPLES ACROSS ALL STATUS CODES
// ============================================================================
export const StandardResponseExamples = {
  // 202 Accepted
  accepted_immediate: {
    summary: '202 Accepted - Immediate Dispatch',
    description: 'Message successfully persisted into PostgreSQL transactional outbox.',
    value: {
      messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3',
      state: 'accepted',
      acceptedAt: '2026-08-21T10:00:00.000Z',
      isSandbox: false,
    },
  },

  accepted_scheduled: {
    summary: '202 Accepted - Deferred Scheduled Execution',
    description: 'Message scheduled for future execution timestamp.',
    value: {
      messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G4',
      state: 'scheduled',
      acceptedAt: '2026-08-21T10:00:00.000Z',
      isSandbox: false,
    },
  },

  accepted_sandbox: {
    summary: '202 Accepted - Sandbox Test Mode',
    description: 'Message accepted into isolated sandbox store.',
    value: {
      messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G5',
      state: 'accepted',
      acceptedAt: '2026-08-21T10:00:00.000Z',
      isSandbox: true,
    },
  },

  // 400 Bad Request
  bad_request_validation: {
    summary: '400 Bad Request - Schema Validation Error',
    description: 'Missing required field or invalid formatting (e.g. invalid phone number).',
    value: {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid message request payload',
        details: [
          { path: 'recipients.phone', code: 'invalid_string', message: 'Required E.164 phone number missing for SMS channel' },
        ],
      },
    },
  },

  // 401 Unauthorized
  unauthorized: {
    summary: '401 Unauthorized - Invalid or Missing API Key',
    description: 'Provided API Key is invalid, expired, or missing.',
    value: {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid API Key header (x-api-key or Authorization Bearer token)',
      },
    },
  },

  // 403 Forbidden
  forbidden: {
    summary: '403 Forbidden - Insufficient Permissions',
    description: 'API key does not possess permissions for the requested team boundary.',
    value: {
      error: {
        code: 'FORBIDDEN',
        message: 'API Key lacks permission to dispatch messages for team: payments',
      },
    },
  },

  // 404 Not Found
  not_found: {
    summary: '404 Not Found - Message Not Found',
    description: 'Message ID was not found within the active partition time window.',
    value: {
      error: {
        code: 'NOT_FOUND',
        message: 'Message msg_01J0N7C0W7X2R6S8V9Q9B1E4G3 not found in partition window',
      },
    },
  },

  // 409 Conflict
  idempotency_conflict: {
    summary: '409 Conflict - Idempotency Key Reused with Mismatched Payload',
    description: 'The same idempotency key was submitted with a different payload hash.',
    value: {
      error: {
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Idempotency key idemp_order_10928 already processed with a different request payload hash',
      },
    },
  },

  // 422 Unprocessable Entity
  suppression_blocked: {
    summary: '422 Unprocessable Entity - Recipient Suppressed',
    description: 'Recipient contact is on active suppression list due to hard bounce, unsubscribe, or spam complaint.',
    value: {
      error: {
        code: 'SUPPRESSED_RECIPIENT',
        message: 'Recipient customer@example.com is currently suppressed (Reason: UNSUBSCRIBE)',
      },
    },
  },

  // 429 Too Many Requests
  rate_limited: {
    summary: '429 Too Many Requests - Rate Limit Exceeded',
    description: 'Tenant or category dispatch rate limit quota exceeded.',
    value: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Tenant rate limit of 5,000 req/sec exceeded. Back off and retry after window reset.',
      },
    },
  },

  // 500 Internal Server Error
  server_error: {
    summary: '500 Internal Server Error - Unexpected System Fault',
    description: 'An unhandled exception occurred; transaction was cleanly rolled back.',
    value: {
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal dispatch pipeline error',
      },
    },
  },

  // 503 Service Unavailable
  service_unavailable: {
    summary: '503 Service Unavailable - System Overloaded / Load Shedding',
    description: 'Traffic governor active or all downstream provider circuit breakers tripped.',
    value: {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'System under extreme load, please retry later',
      },
    },
  },
};
